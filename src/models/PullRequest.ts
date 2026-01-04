import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PullRequest extends Document {
  projectId: Types.ObjectId;
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
  state: 'open' | 'closed' | 'merged';
  updatedAt: Date;
}

const PullRequestSchema = new Schema<PullRequest>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
    repoFullName: { type: String, required: true },
    installationId: { type: Number, required: false },
    pullRequestId: { type: Number, required: true },
    pullRequestNumber: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    mergedAt: { type: Date, required: false },
    closedAt: { type: Date, required: false },
    baseBranch: { type: String, required: false },
    headBranch: { type: String, required: false },
    url: { type: String, required: false },
    state: { type: String, enum: ['open', 'closed', 'merged'], required: true },
    updatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

PullRequestSchema.index({ projectId: 1, repoFullName: 1, pullRequestId: 1 }, { unique: true });
PullRequestSchema.index({ projectId: 1, repoFullName: 1, pullRequestNumber: 1 });
PullRequestSchema.index({ projectId: 1, updatedAt: -1 });

export const PullRequestModel: Model<PullRequest> =
  mongoose.models.PullRequest || mongoose.model<PullRequest>('PullRequest', PullRequestSchema);


