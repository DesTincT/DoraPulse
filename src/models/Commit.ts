import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface Commit extends Document {
  projectId: Types.ObjectId;
  repoFullName: string; // e.g., "owner/repo"
  sha: string;
  ts: Date; // commit timestamp (committer date)
}

const CommitSchema = new Schema<Commit>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
    repoFullName: { type: String, required: true },
    sha: { type: String, required: true },
    ts: { type: Date, required: true },
  },
  {
    timestamps: false,
  },
);

CommitSchema.index({ projectId: 1, repoFullName: 1, sha: 1 }, { unique: true });

export const CommitModel: Model<Commit> =
  mongoose.models.Commit || mongoose.model<Commit>('Commit', CommitSchema);


