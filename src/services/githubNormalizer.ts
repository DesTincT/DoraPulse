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
  // PR Opened event
  if (payload.action === 'opened' && payload.pull_request) {
    events.push({
      type: 'pr_open',
      ts: new Date(payload.pull_request.created_at).getTime(),
      meta: {
        branch: payload.pull_request.base && payload.pull_request.base.ref,
        sha: payload.pull_request.head && payload.pull_request.head.sha,
        bodyPreview: payload.pull_request.body ? payload.pull_request.body.slice(0, 300) : undefined,
        ...pickPrAndRepo(payload),
      },
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
        ...pickPrAndRepo(payload),
      },
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

function isProdEnvironment(name: string | undefined, project: any): boolean {
  if (!name || typeof name !== 'string') return false;
  const defaults = ['production', 'prod', 'yandex cloud'];
  const custom: string[] | undefined = project?.settings?.prodEnvironments;
  const list = Array.isArray(custom) && custom.length ? custom : defaults;
  const n = name.toLowerCase();
  return list.some((x) => String(x).toLowerCase() === n);
}

function fromDeploymentStatus(payload: any, project: any): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const dep = payload?.deployment;
  const status = payload?.deployment_status;
  const repoFullName: string | undefined = payload?.repository?.full_name;
  if (!dep || !status) return events;

  const envName: string | undefined = dep.environment;
  if (!isProdEnvironment(envName, project)) return events;

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
    (status.targetUrl || status.environmentUrl || status.logUrl || undefined);

  const ev: NormalizedEvent = {
    type,
    ts,
    meta: {
      env: 'prod',
      sha: dep.sha,
      repoFullName,
      deploymentEnvironment: envName,
      deploymentId: dep.id,
      statusId: status.id,
      url: bestUrl,
    },
    dedupKey: status.id ? `gh:deployment_status:${status.id}` : dep.id && createdAt ? `gh:deployment:${dep.id}:${state}:${createdAt}` : undefined,
  };
  events.push(ev);
  return events;
}

export { fromPullRequest, fromWorkflowRun, fromPush, fromDeploymentStatus, isProdEnvironment };
