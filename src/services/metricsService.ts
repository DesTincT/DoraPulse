import { Types } from 'mongoose';
import { EventModel } from '../models/Event.js';
import { IncidentModel } from '../models/Incident.js';
import { isoWeekRange, percentile } from '../utils.js';
import { CommitCacheModel } from '../models/CommitCache.js';
import { fetchCommitCommittedAt } from './githubApi.js';
import { ProjectModel } from '../models/Project.js';
import type { Event as EventDoc } from '../models/Event.js';
import { matchProdEnvironment } from './prodDeployment.js';

export async function getWeekly(projectId: Types.ObjectId | string, week: string) {
  const pid = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
  const [from, to] = isoWeekRange(week);

  // 1) забираем все события недели по проекту
  const events = (await EventModel.find({ projectId: pid, ts: { $gte: from, $lt: to } })
    .select('ts type repoId branch prId env meta')
    .sort({ ts: 1 })
    .lean()) as Pick<EventDoc, 'ts' | 'type' | 'env' | 'meta' | 'prId' | 'branch'>[];

  const byType = events.reduce((m: any, e: any) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
  const deploysAll = events.filter((e) => e.type === 'deploy_succeeded' || e.type === 'deploy_failed');
  const project = await ProjectModel.findById(pid).select('settings').lean();
  const isProdDeployEvent = (e: any) => {
    const depEnv = typeof e?.meta?.deploymentEnvironment === 'string' ? e.meta.deploymentEnvironment : undefined;
    return matchProdEnvironment(depEnv, (project as any)?.settings);
  };
  // Single definition: only events with a matched deployment environment are eligible for DF/CFR.
  const prodDeploysAll = deploysAll.filter(isProdDeployEvent);
  const successes = prodDeploysAll.filter((e) => e.type === 'deploy_succeeded');
  const fails = prodDeploysAll.filter((e) => e.type === 'deploy_failed');

  // 2) DF / CFR — group by distinct deployment and use last outcome within week (prod only)
  function deploymentGroupKey(e: any): string {
    const id = e?.meta?.deploymentId ?? e?.meta?.statusId;
    if (id != null) return `id:${id}`;
    const env = (e?.meta?.env || e?.env || '') as string;
    const repoFullName = (e?.meta?.repoFullName || '') as string;
    const sha = (e?.meta?.sha || '') as string;
    return `${repoFullName}:${sha}:${env}`;
  }
  const deployEventCountRaw = prodDeploysAll.length;
  const finalByDeployment = new Map<string, 'deploy_succeeded' | 'deploy_failed'>();
  // events are already sorted asc by ts; last write wins
  for (const e of prodDeploysAll) {
    const k = deploymentGroupKey(e);
    if (!k) continue;
    if (e.type === 'deploy_succeeded' || e.type === 'deploy_failed') {
      finalByDeployment.set(k, e.type);
    }
  }
  let distinctSucceeded = 0;
  let distinctFailed = 0;
  for (const t of finalByDeployment.values()) {
    if (t === 'deploy_succeeded') distinctSucceeded++;
    else if (t === 'deploy_failed') distinctFailed++;
  }
  const distinctTotal = distinctSucceeded + distinctFailed;
  const dfCount = distinctSucceeded;
  const cfrDen = distinctTotal;
  const cfrNum = distinctFailed;
  const cfrVal = cfrDen ? cfrNum / cfrDen : 0;

  // 3) MTTR (если импортированы инциденты)
  const incidents = await IncidentModel.find({
    projectId: pid,
    openedAt: { $lt: to },
    resolvedAt: { $gte: from },
  })
    .select('openedAt resolvedAt')
    .lean();
  const mttrSamples = incidents
    .filter((i) => i.resolvedAt)
    .map((i) => +new Date(i.resolvedAt!) - +new Date(i.openedAt));
  const mttrP50 = percentile(mttrSamples, 50) / 1000;
  const mttrP90 = percentile(mttrSamples, 90) / 1000;

  // 4) PR Cycle Time (ранее «Lead Time» по PR): merged_ts - created_at (или pr_open fallback)
  const mergedEvents = events.filter((e: any) => e.type === 'pr_merged' || e.type === 'pr_merge'); // legacy поддержка
  const openEvents = events.filter((e: any) => e.type === 'pr_open');

  const prCtSamples: number[] = [];

  for (const m of mergedEvents) {
    // 1) лучший вариант: meta.prCreatedAt (ms)
    const createdAtMs = typeof m.meta?.prCreatedAt === 'number' ? m.meta.prCreatedAt : undefined;

    if (createdAtMs) {
      prCtSamples.push(+new Date(m.ts as any) - createdAtMs);
      continue;
    }

    // 2) fallback: матч по номеру PR (meta.prNumber или prId) + (опционально) repoFullName
    const prNum =
      (typeof m.meta?.prNumber === 'number' ? m.meta.prNumber : undefined) ??
      (typeof (m as any).prId === 'number' ? (m as any).prId : undefined);

    if (!prNum) continue;

    const repo = m.meta?.repoFullName;

    const candidates = openEvents.filter((o) => {
      const oNum =
        (typeof o.meta?.prNumber === 'number' ? o.meta.prNumber : undefined) ??
        (typeof (o as any).prId === 'number' ? (o as any).prId : undefined);

      if (oNum !== prNum) return false;
      if (repo && o.meta?.repoFullName && o.meta.repoFullName !== repo) return false;
      return +new Date(o.ts as any) <= +new Date(m.ts as any);
    });

    if (candidates.length) {
      const lastOpen = candidates[candidates.length - 1];
      prCtSamples.push(+new Date(m.ts as any) - +new Date(lastOpen.ts as any));
    }
  }

  const prCtP50 = prCtSamples.length ? percentile(prCtSamples, 50) / 1000 : 0;
  const prCtP90 = prCtSamples.length ? percentile(prCtSamples, 90) / 1000 : 0;

  // 5) DORA Lead Time for Changes (commit -> prod deploy)
  const prodDeploySuccess = successes;
  const prodDeploys = prodDeploySuccess.length;
  let prodDeploysWithSha = 0;
  const ltSamples: number[] = [];
  const MAX_SHAS = 200;
  let resolvedCount = 0;

  async function resolveCommitTs(repoFullName: string | undefined, sha: any): Promise<number | null> {
    if (!repoFullName || !sha || typeof sha !== 'string') return null;
    const cached = await CommitCacheModel.findOne({ repoFullName, sha }).lean();
    if (cached?.committedAt) return +new Date(cached.committedAt as any);
    // fetch from GitHub (prefer author date, fallback committer)
    const committedAt = await fetchCommitCommittedAt(repoFullName, sha);
    if (!committedAt) return null;
    await CommitCacheModel.updateOne(
      { repoFullName, sha },
      { $set: { committedAt, fetchedAt: new Date() } },
      { upsert: true },
    );
    return +committedAt;
  }

  let processedShas = 0;
  for (const d of prodDeploySuccess) {
    const repoFullName: string | undefined = d.meta?.repoFullName;
    const shaSingle: any = d.meta?.sha;
    const shasArr: any[] | undefined = Array.isArray(d.meta?.shas) ? d.meta.shas : undefined;
    const shas: string[] = [];
    if (typeof shaSingle === 'string') shas.push(shaSingle);
    if (shasArr?.length) shas.push(...shasArr.filter((x) => typeof x === 'string'));
    if (shas.length) prodDeploysWithSha++;

    for (const sha of shas) {
      if (processedShas >= MAX_SHAS) break;
      const commitTs = await resolveCommitTs(repoFullName, sha);
      if (commitTs) {
        ltSamples.push(+new Date(d.ts as any) - commitTs);
        resolvedCount++;
      }
      processedShas++;
    }
    if (processedShas >= MAX_SHAS) break;
  }

  const ltSamplesSec = ltSamples.map((ms) => ms / 1000);
  const doraLt = {
    p50: ltSamplesSec.length ? percentile(ltSamplesSec, 50) : 0,
    p90: ltSamplesSec.length ? percentile(ltSamplesSec, 90) : 0,
    unit: 'sec',
    samples: ltSamplesSec.length,
  };

  // 6) Если совсем пусто — вернем структуру с нулями (не {}), плюс debug
  const result = {
    projectId: String(pid),
    week,
    df: { count: dfCount, byDay: {} as Record<string, number> },
    prCycleTime: { p50: prCtP50, p90: prCtP90 },
    leadTime: doraLt,
    cfr: { numerator: cfrNum, denominator: cfrDen, value: cfrVal },
    mttr: { p50: mttrP50 || 0, p90: mttrP90 || 0, incidents: incidents.length },
    coverage: {
      leadTime: { prodDeploys, prodDeploysWithSha, commitsResolved: resolvedCount },
      incidentsLinked: incidents.length ? 1 : 0,
    },
    debug: {
      from,
      to,
      totalEvents: events.length,
      byType,
      deployCountsByType: { succeeded: successes.length, failed: fails.length },
      deploysProd: prodDeploys,
      deploysProdWithSha: prodDeploysWithSha,
      distinctDeploymentsSucceeded: distinctSucceeded,
      distinctDeploymentsFailed: distinctFailed,
      distinctDeploymentsTotal: distinctTotal,
      deployEventCountRaw,
      commitsResolved: resolvedCount,
      leadTimeSamples: ltSamplesSec.length,
      prMergesCount: mergedEvents.length,
    },
  };

  return result;
}
