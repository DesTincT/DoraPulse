import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { EventModel } from '../models/Event.js';
import { RepoModel } from '../models/Repo.js';
import { PullRequestModel } from '../models/PullRequest.js';
import { WebhookDeliveryModel } from '../models/WebhookDelivery.js';
import { getLatestCompleteWeekKey, getWeekRange, getWeekRangeExclusive } from '../utils/week.js';
import { getIsoWeekDateRangeTz } from '../utils.js';
import { config } from '../config.js';
import { matchProdEnvironment, getEffectiveProdEnvironments } from './prodDeployment.js';

export type DiagnosticSeverity = 'info' | 'warn' | 'error';

export interface DiagnosticReason {
  code:
    | 'NO_WEBHOOKS_RECENT'
    | 'NO_PROD_DEPLOYS_MATCHED_ENV'
    | 'NO_MERGED_PRS_IN_RANGE'
    | 'WEEK_SELECTION_MISMATCH'
    | 'INSTALLATION_OR_PERMISSIONS_MISSING';
  severity: DiagnosticSeverity;
  message: string;
  fix?: string;
}

export interface ProjectSelftestResult {
  ok: true;
  now: string;
  latestCompleteWeekKey: string;
  weekKey: string;
  weekRange: { from: string; to: string };
  ingestion: {
    lastWebhookAt: string | null;
    webhooks15m: number;
    webhooks24h: number;
    duplicates15m: number;
    duplicates24h: number;
    failures15m: number;
    failures24h: number;
  };
  config: {
    prodEnvironments: string[];
    githubInstallationPresent: boolean;
    githubReposConfigured: boolean;
    repoMappingPresent: boolean;
  };
  dataPresence: {
    prsMergedInWeek: number;
    deploysInWeekTotal: number;
    deploysInWeekProd: number;
    lastMergedPrAt: string | null;
    lastProdDeployAt: string | null;
    // extra signals (backward-compatible additions)
    deployStatusEventsInWeek: number;
  };
  diagnosticReasons: DiagnosticReason[];
}

function toIso(d: unknown): string | null {
  if (!d) return null;
  const x = new Date(d as any);
  if (Number.isNaN(+x)) return null;
  return x.toISOString();
}

interface TsOnly {
  ts: Date;
}
interface DeployTs {
  ts: Date;
  meta?: { deploymentEnvironment?: string };
}

export async function computeProjectSelftest(projectId: string, weekParam?: string): Promise<ProjectSelftestResult> {
  const pid = new Types.ObjectId(projectId);
  const project = await ProjectModel.findById(pid).select('settings github githubInstallationId').lean();
  if (!project) throw new Error('project not found');

  const now = new Date();
  const latestCompleteWeekKey = getLatestCompleteWeekKey(now);
  const weekKey = weekParam && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(weekParam) ? weekParam : latestCompleteWeekKey;

  const { from, to } = getWeekRange(weekKey);
  const { from: fromExcl, toExclusive } = getWeekRangeExclusive(weekKey);

  // Ingestion (deliveries)
  const since15m = new Date(now.getTime() - 15 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const lastDelivery = await WebhookDeliveryModel.findOne({ provider: 'github', projectId: pid })
    .sort({ lastSeenAt: -1 })
    .select('lastSeenAt')
    .lean<{ lastSeenAt: Date }>();

  const [webhooks15m, webhooks24h, duplicates15m, duplicates24h, failures15m, failures24h] = await Promise.all([
    WebhookDeliveryModel.countDocuments({ provider: 'github', projectId: pid, lastSeenAt: { $gte: since15m } }),
    WebhookDeliveryModel.countDocuments({ provider: 'github', projectId: pid, lastSeenAt: { $gte: since24h } }),
    WebhookDeliveryModel.countDocuments({
      provider: 'github',
      projectId: pid,
      lastSeenAt: { $gte: since15m },
      status: 'duplicate',
    }),
    WebhookDeliveryModel.countDocuments({
      provider: 'github',
      projectId: pid,
      lastSeenAt: { $gte: since24h },
      status: 'duplicate',
    }),
    WebhookDeliveryModel.countDocuments({
      provider: 'github',
      projectId: pid,
      lastSeenAt: { $gte: since15m },
      status: 'failed',
    }),
    WebhookDeliveryModel.countDocuments({
      provider: 'github',
      projectId: pid,
      lastSeenAt: { $gte: since24h },
      status: 'failed',
    }),
  ]);

  // Config/mapping presence
  const settings: any = (project as any)?.settings || {};
  const prodEnvironments = getEffectiveProdEnvironments(settings?.prodEnvironments);

  const installationId: number | undefined =
    typeof settings?.github?.installationId === 'number'
      ? settings.github.installationId
      : typeof (project as any)?.githubInstallationId === 'number'
        ? (project as any).githubInstallationId
        : typeof (project as any)?.github?.installationId === 'number'
          ? (project as any).github.installationId
          : undefined;
  const githubInstallationPresent = !!installationId;
  const githubReposConfigured = Array.isArray(settings?.github?.repos) && settings.github.repos.length > 0;
  const repoMappingPresent = (await RepoModel.countDocuments({ projectId: pid })) > 0;

  // Data presence (week)
  const prsMergedInWeek = await EventModel.countDocuments({
    projectId: pid,
    type: 'pr_merged',
    ts: { $gte: fromExcl, $lt: toExclusive },
  });

  const deployStatusEventsInWeek = await EventModel.countDocuments({
    projectId: pid,
    type: { $in: ['deploy_succeeded', 'deploy_failed'] },
    ts: { $gte: fromExcl, $lt: toExclusive },
    'meta.deploymentEnvironment': { $type: 'string' },
  });

  // deploysInWeekTotal: matched production environment (success+fail), regardless of state
  const deployCandidates = await EventModel.find({
    projectId: pid,
    type: { $in: ['deploy_succeeded', 'deploy_failed'] },
    ts: { $gte: fromExcl, $lt: toExclusive },
  })
    .select('type ts meta.deploymentEnvironment')
    .lean();

  const matched = deployCandidates.filter((e: any) =>
    matchProdEnvironment(
      typeof e?.meta?.deploymentEnvironment === 'string' ? e.meta.deploymentEnvironment : undefined,
      settings,
    ),
  );
  const deploysInWeekTotal = matched.length;
  const deploysInWeekProd = matched.filter((e: any) => e.type === 'deploy_succeeded').length;

  const lastMerged = await EventModel.findOne({ projectId: pid, type: 'pr_merged' })
    .sort({ ts: -1 })
    .select('ts')
    .lean<TsOnly>();
  const lastProdDeploy = await EventModel.findOne({
    projectId: pid,
    type: 'deploy_succeeded',
    'meta.deploymentEnvironment': { $type: 'string' },
  })
    .sort({ ts: -1 })
    .select('ts meta.deploymentEnvironment')
    .lean<DeployTs>();
  const lastProdDeployMatched =
    lastProdDeploy &&
    matchProdEnvironment(
      typeof lastProdDeploy?.meta?.deploymentEnvironment === 'string'
        ? lastProdDeploy.meta.deploymentEnvironment
        : undefined,
      settings,
    )
      ? lastProdDeploy
      : null;

  // Diagnostics
  const diagnosticReasons: DiagnosticReason[] = [];

  const lastWebhookAt = toIso(lastDelivery?.lastSeenAt);
  if (!lastWebhookAt || (lastDelivery?.lastSeenAt && +new Date(lastDelivery.lastSeenAt) < +since24h)) {
    diagnosticReasons.push({
      code: 'NO_WEBHOOKS_RECENT',
      severity: 'error',
      message: 'No GitHub webhooks received recently (last 24h). Metrics may stay at zero.',
      fix: 'Check webhook/GitHub App installation, permissions, and that GitHub is delivering events to this API.',
    });
  }

  // If we saw deployment_status events but none match configured prod environments, explain why DF is zero
  if (deployStatusEventsInWeek > 0 && deploysInWeekTotal === 0) {
    diagnosticReasons.push({
      code: 'NO_PROD_DEPLOYS_MATCHED_ENV',
      severity: 'error',
      message: 'Deployment events exist, but none match the configured production environment names.',
      fix: 'Update Production Environments in the Mini App to match your GitHub Environment name(s).',
    });
  } else if (deployStatusEventsInWeek === 0) {
    diagnosticReasons.push({
      code: 'NO_PROD_DEPLOYS_MATCHED_ENV',
      severity: 'warn',
      message: 'No deployment_status events found in the selected week.',
      fix: 'Ensure your CI/CD emits GitHub deployment_status events for production deployments.',
    });
  }

  if (prsMergedInWeek === 0) {
    diagnosticReasons.push({
      code: 'NO_MERGED_PRS_IN_RANGE',
      severity: 'warn',
      message: 'No merged PR events found in the selected week.',
      fix: 'Merge a PR into the configured production branch for this project (prodRule.branch).',
    });
  }

  if (weekKey !== latestCompleteWeekKey) {
    // Only warn if selecting a different week could explain zeros.
    const latestRange = getWeekRangeExclusive(latestCompleteWeekKey);
    const latestHasAny = await EventModel.exists({
      projectId: pid,
      ts: { $gte: latestRange.from, $lt: latestRange.toExclusive },
    });
    const selectedHasAny = await EventModel.exists({ projectId: pid, ts: { $gte: fromExcl, $lt: toExclusive } });
    if (latestHasAny && !selectedHasAny) {
      diagnosticReasons.push({
        code: 'WEEK_SELECTION_MISMATCH',
        severity: 'info',
        message: `Selected week ${weekKey} has no events, but latest complete week ${latestCompleteWeekKey} does.`,
        fix: 'Switch to the latest complete week (or pass ?week=YYYY-Www).',
      });
    }
  }

  if (!githubInstallationPresent || (!githubReposConfigured && !repoMappingPresent)) {
    diagnosticReasons.push({
      code: 'INSTALLATION_OR_PERMISSIONS_MISSING',
      severity: 'warn',
      message: 'GitHub installation/repository mapping looks incomplete; ingestion may be missing events.',
      fix: 'Install/authorize the GitHub App and ensure the project is linked to the correct repositories.',
    });
  }

  // Sort: error > warn > info
  const weight: Record<DiagnosticSeverity, number> = { error: 0, warn: 1, info: 2 };
  diagnosticReasons.sort((a, b) => weight[a.severity] - weight[b.severity]);

  // PR domain-level signal (not required, but useful for “why zeros?”)
  // (keep it cheap; no extra queries)
  void PullRequestModel; // referenced via imports; collection used elsewhere.

  return {
    ok: true,
    now: now.toISOString(),
    latestCompleteWeekKey,
    weekKey,
    weekRange: {
      from: from.toISOString(),
      to: to.toISOString(),
      label: getIsoWeekDateRangeTz(weekKey, config.timezone).label,
    } as any,
    ingestion: {
      lastWebhookAt,
      webhooks15m,
      webhooks24h,
      duplicates15m,
      duplicates24h,
      failures15m,
      failures24h,
    },
    config: {
      prodEnvironments,
      githubInstallationPresent,
      githubReposConfigured,
      repoMappingPresent,
    },
    dataPresence: {
      prsMergedInWeek,
      deploysInWeekTotal,
      deploysInWeekProd,
      lastMergedPrAt: toIso(lastMerged?.ts),
      lastProdDeployAt: toIso(lastProdDeployMatched?.ts),
      deployStatusEventsInWeek,
    },
    diagnosticReasons,
  };
}
