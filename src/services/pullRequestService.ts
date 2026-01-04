import { Types } from 'mongoose';
import { PullRequestModel } from '../models/PullRequest.js';

export type PullRequestState = 'open' | 'closed' | 'merged';

export interface CanonicalPullRequest {
  repoFullName: string;
  installationId?: number;
  pullRequestId: number;
  pullRequestNumber: number;
  createdAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
  baseBranch?: string;
  headBranch?: string;
  url?: string;
  state: PullRequestState;
}

export function extractCanonicalPullRequest(payload: any): CanonicalPullRequest | null {
  const pr = payload?.pull_request;
  if (!pr || typeof pr !== 'object') return null;

  const repoFullName: string | undefined =
    payload?.repository?.full_name ||
    (payload?.repository?.owner?.login && payload?.repository?.name
      ? `${payload.repository.owner.login}/${payload.repository.name}`
      : undefined);
  if (!repoFullName) return null;

  const pullRequestId: number | undefined = typeof pr.id === 'number' ? pr.id : undefined;
  const pullRequestNumber: number | undefined =
    typeof payload?.number === 'number' ? payload.number : typeof pr.number === 'number' ? pr.number : undefined;
  if (!pullRequestId || !pullRequestNumber) return null;

  const createdAt = pr.created_at ? new Date(pr.created_at) : null;
  if (!createdAt || Number.isNaN(+createdAt)) return null;

  const merged = pr.merged === true;
  const mergedAt = merged && pr.merged_at ? new Date(pr.merged_at) : undefined;
  const closedAt = pr.closed_at ? new Date(pr.closed_at) : undefined;

  const state: PullRequestState = merged ? 'merged' : pr.state === 'open' ? 'open' : 'closed';

  const installationId: number | undefined =
    typeof payload?.installation?.id === 'number' ? payload.installation.id : undefined;

  return {
    repoFullName,
    installationId,
    pullRequestId,
    pullRequestNumber,
    createdAt,
    mergedAt,
    closedAt,
    baseBranch: typeof pr?.base?.ref === 'string' ? pr.base.ref : undefined,
    headBranch: typeof pr?.head?.ref === 'string' ? pr.head.ref : undefined,
    url: typeof pr?.html_url === 'string' ? pr.html_url : typeof pr?.url === 'string' ? pr.url : undefined,
    state,
  };
}

export async function upsertPullRequest(projectId: Types.ObjectId, payload: any): Promise<CanonicalPullRequest | null> {
  const c = extractCanonicalPullRequest(payload);
  if (!c) return null;
  const now = new Date();

  await PullRequestModel.updateOne(
    { projectId, repoFullName: c.repoFullName, pullRequestId: c.pullRequestId },
    {
      $set: {
        installationId: c.installationId,
        pullRequestNumber: c.pullRequestNumber,
        createdAt: c.createdAt,
        mergedAt: c.mergedAt,
        closedAt: c.closedAt,
        baseBranch: c.baseBranch,
        headBranch: c.headBranch,
        url: c.url,
        state: c.state,
        updatedAt: now,
      },
      $setOnInsert: { projectId, repoFullName: c.repoFullName, pullRequestId: c.pullRequestId },
    },
    { upsert: true },
  );

  return c;
}
