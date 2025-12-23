import { Types } from 'mongoose';
import { EventModel } from '../models/Event.js';
import { IncidentModel } from '../models/Incident.js';
import { isoWeekRange, percentile } from '../utils.js';
import { CommitModel } from '../models/Commit.js';
import { config } from '../config.js';

export async function getWeekly(projectId: Types.ObjectId | string, week: string) {
  const pid = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
  const [from, to] = isoWeekRange(week);

  // 1) забираем все события недели по проекту
  const events = await EventModel.find({ projectId: pid, ts: { $gte: from, $lt: to } })
    .select('ts type repoId branch prId env meta')
    .sort({ ts: 1 })
    .lean();

  const byType = events.reduce((m: any, e: any) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
  const deploys = events.filter((e) => e.type === 'deploy_succeeded' || e.type === 'deploy_failed');
  const successes = deploys.filter((e) => e.type === 'deploy_succeeded');
  const fails = deploys.filter((e) => e.type === 'deploy_failed');

  // 2) DF / CFR
  const dfCount = successes.length;
  const cfrDen = deploys.length;
  const cfrNum = fails.length;
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
  const prodDeploySuccess = successes.filter((e: any) => e.env === 'prod');
  const prodDeploys = prodDeploySuccess.length;
  let prodDeploysWithSha = 0;
  const ltSamples: number[] = [];
  const MAX_SHAS = 200;
  let resolvedCount = 0;

  async function resolveCommitTs(repoFullName: string | undefined, sha: any): Promise<number | null> {
    if (!repoFullName || !sha || typeof sha !== 'string') return null;
    const cached = await CommitModel.findOne({ projectId: pid, repoFullName, sha }).lean();
    if (cached?.ts) return +new Date(cached.ts as any);
    // fetch from GitHub
    try {
      const url = `https://api.github.com/repos/${repoFullName}/commits/${encodeURIComponent(sha)}`;
      const headers: Record<string, string> = { 'User-Agent': 'dora-pulse' };
      if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
      const res = await fetch(url, { headers } as any);
      if (!res.ok) return null;
      const json: any = await res.json();
      const dateStr =
        json?.commit?.committer?.date ||
        json?.commit?.author?.date ||
        (json?.commit && json.committer?.date) ||
        undefined;
      if (!dateStr) return null;
      const tsNum = +new Date(dateStr);
      if (Number.isFinite(tsNum)) {
        await CommitModel.updateOne(
          { projectId: pid, repoFullName, sha },
          { $set: { ts: new Date(tsNum) } },
          { upsert: true },
        );
        return tsNum;
      }
      return null;
    } catch {
      return null;
    }
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

  const doraLt =
    ltSamples.length > 0
      ? {
          p50: percentile(ltSamples, 50) / 1000,
          p90: percentile(ltSamples, 90) / 1000,
        }
      : null;

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
      prMergesCount: mergedEvents.length,
    },
  };

  return result;
}
