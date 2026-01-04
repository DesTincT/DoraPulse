import { matchProdEnvironment } from './prodDeployment.js';

interface PrRepoMeta {
  prNumber?: number;
  repoId?: string;
  repoFullName?: string;
  prCreatedAt?: number;
}

interface NormalizedEvent {
  type: 'pr_open' | 'pr_merge' | 'pr_merged' | 'deploy_succeeded' | 'deploy_failed' | 'commit_main';
  ts: number;
  meta: {
    workflowName?: string;
    branch?: string;
    sha?: string;
    bodyPreview?: string;
    prNumber?: number;
    repoId?: string;
    repoFullName?: string;
    prCreatedAt?: number;
    [k: string]: any;
  };
  dedupKey?: string;
}

function pickPrAndRepo(payload: any): PrRepoMeta {
  const pr = payload?.pull_request;
  const repo = payload?.repository;
  const meta: PrRepoMeta = {};
  if (pr && typeof pr.number === 'number') {
    meta.prNumber = pr.number;
  }
  if (repo) {
    if (repo.id !== undefined && repo.id !== null) {
      meta.repoId = String(repo.id);
    }
    if (typeof repo.full_name === 'string') {
      meta.repoFullName = repo.full_name;
    } else if (repo.owner?.login && repo.name) {
      meta.repoFullName = `${repo.owner.login}/${repo.name}`;
    }
  }
  return meta;
}

function fromPullRequest(payload: any, project: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const pr = payload?.pull_request;
  const prId: number | undefined = typeof pr?.id === 'number' ? pr.id : undefined;
  const prNumber: number | undefined =
    typeof payload?.number === 'number' ? payload.number : typeof pr?.number === 'number' ? pr.number : undefined;
  const repoFullName: string | undefined =
    payload?.repository?.full_name ||
    (payload?.repository?.owner?.login && payload?.repository?.name
      ? `${payload.repository.owner.login}/${payload.repository.name}`
      : undefined);
  // PR Opened event
  if (payload.action === 'opened' && payload.pull_request) {
    const createdAt = payload.pull_request.created_at;
    events.push({
      type: 'pr_open',
      ts: new Date(payload.pull_request.created_at).getTime(),
      meta: {
        branch: payload.pull_request.base && payload.pull_request.base.ref,
        sha: payload.pull_request.head && payload.pull_request.head.sha,
        bodyPreview: payload.pull_request.body ? payload.pull_request.body.slice(0, 300) : undefined,
        installationId: typeof payload?.installation?.id === 'number' ? payload.installation.id : undefined,
        repoFullName,
        pullRequestId: prId,
        pullRequestNumber: prNumber,
        createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
        baseBranch: payload.pull_request.base && payload.pull_request.base.ref,
        headBranch: payload.pull_request.head && payload.pull_request.head.ref,
        url: payload.pull_request.html_url || payload.pull_request.url || undefined,
        state: payload.pull_request.state || undefined,
        ...pickPrAndRepo(payload),
      },
      dedupKey:
        repoFullName && prId != null && createdAt
          ? `gh:pr_open:${repoFullName}:${String(prId)}:${String(createdAt)}`
          : repoFullName && prNumber != null && createdAt
            ? `gh:pr_open:${repoFullName}:number:${String(prNumber)}:${String(createdAt)}`
            : undefined,
    });
  }
  // PR Merged event (and into prod branch)
  if (
    payload.action === 'closed' &&
    payload.pull_request &&
    payload.pull_request.merged &&
    payload.pull_request.base &&
    payload.pull_request.base.ref === project.settings?.prodRule?.branch
  ) {
    const mergedAt = payload.pull_request.merged_at || payload.pull_request.closed_at;
    events.push({
      // use canonical name; keep type union compatible with legacy 'pr_merge'
      type: 'pr_merged',
      ts: new Date(payload.pull_request.merged_at || payload.pull_request.closed_at).getTime(),
      meta: {
        branch: payload.pull_request.base && payload.pull_request.base.ref,
        sha:
          payload.pull_request.merge_commit_sha ||
          (payload.pull_request.head && payload.pull_request.head.sha) ||
          undefined,
        bodyPreview: payload.pull_request.body ? payload.pull_request.body.slice(0, 300) : undefined,
        prCreatedAt: payload.pull_request.created_at ? new Date(payload.pull_request.created_at).getTime() : undefined,
        installationId: typeof payload?.installation?.id === 'number' ? payload.installation.id : undefined,
        repoFullName,
        pullRequestId: prId,
        pullRequestNumber: prNumber,
        createdAt: payload.pull_request.created_at ? new Date(payload.pull_request.created_at).toISOString() : undefined,
        mergedAt: mergedAt ? new Date(mergedAt).toISOString() : undefined,
        closedAt: payload.pull_request.closed_at ? new Date(payload.pull_request.closed_at).toISOString() : undefined,
        baseBranch: payload.pull_request.base && payload.pull_request.base.ref,
        headBranch: payload.pull_request.head && payload.pull_request.head.ref,
        url: payload.pull_request.html_url || payload.pull_request.url || undefined,
        state: 'merged',
        ...pickPrAndRepo(payload),
      },
      dedupKey:
        repoFullName && prId != null && mergedAt
          ? `gh:pr_merged:${repoFullName}:${String(prId)}:${String(mergedAt)}`
          : repoFullName && prNumber != null && mergedAt
            ? `gh:pr_merged:${repoFullName}:number:${String(prNumber)}:${String(mergedAt)}`
            : undefined,
    });
  }
  return events;
}

function fromWorkflowRun(payload: any, _project: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  if (
    payload.action === 'completed' &&
    payload.workflow_run &&
    typeof payload.workflow_run.name === 'string' &&
    /deploy.*prod/i.test(payload.workflow_run.name) &&
    ['success', 'failure'].includes(payload.workflow_run.conclusion)
  ) {
    const type = payload.workflow_run.conclusion === 'success' ? 'deploy_succeeded' : 'deploy_failed';
    events.push({
      type,
      ts: new Date(payload.workflow_run.updated_at || payload.workflow_run.completed_at).getTime(),
      meta: {
        env: 'prod',
        workflowName: payload.workflow_run.name,
        branch: payload.workflow_run.head_branch,
        sha: payload.workflow_run.head_sha,
        bodyPreview:
          payload.workflow_run.head_commit && payload.workflow_run.head_commit.message
            ? payload.workflow_run.head_commit.message.slice(0, 300)
            : undefined,
      },
    });
  }
  return events;
}

function fromPush(payload: any, project: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  // "refs/heads/main" or refs/heads/<defaultBranch>
  const mainBranch = project.settings?.prodRule?.branch || 'main';
  if (payload.ref === `refs/heads/${mainBranch}` && Array.isArray(payload.commits)) {
    for (const commit of payload.commits) {
      events.push({
        type: 'commit_main',
        ts: new Date(commit.timestamp).getTime(),
        meta: {
          branch: mainBranch,
          sha: commit.id,
          bodyPreview: commit.message ? commit.message.slice(0, 300) : undefined,
        },
      });
    }
  }
  return events;
}

export type { NormalizedEvent };

function fromDeploymentStatus(payload: any, project: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const dep = payload?.deployment;
  const status = payload?.deployment_status;
  const repoFullName: string | undefined = payload?.repository?.full_name;
  if (!dep || !status) return events;

  const envName: string | undefined = dep.environment;
  if (!envName || typeof envName !== 'string') return events;
  const isProdEnv = matchProdEnvironment(envName, project?.settings);

  const state: string = String(status.state || '').toLowerCase();
  if (!['success', 'failure', 'error'].includes(state)) return events;
  const type: NormalizedEvent['type'] = state === 'success' ? 'deploy_succeeded' : 'deploy_failed';

  const createdAt: string | undefined = status.created_at || status.updated_at || status.createdAt || status.updatedAt;
  const ts = createdAt ? new Date(createdAt).getTime() : Date.now();

  const bestUrl =
    status.target_url ||
    status.environment_url ||
    status.log_url ||
    status.html_url ||
    status.targetUrl ||
    status.environmentUrl ||
    status.logUrl ||
    undefined;

  const ev: NormalizedEvent = {
    type,
    ts,
    meta: {
      env: isProdEnv ? 'prod' : undefined,
      sha: dep.sha,
      repoFullName,
      deploymentEnvironment: envName,
      deploymentId: dep.id,
      statusId: status.id,
      url: bestUrl,
    },
    dedupKey:
      repoFullName && dep.id != null && status.id != null
        ? `gh:deployment_status:${repoFullName}:${String(dep.id)}:${String(status.id)}`
        : status.id != null
          ? `gh:deployment_status:${String(status.id)}`
          : dep.id && createdAt
            ? `gh:deployment:${String(dep.id)}:${state}:${createdAt}`
            : undefined,
  };
  events.push(ev);
  return events;
}

export { fromPullRequest, fromWorkflowRun, fromPush, fromDeploymentStatus };
