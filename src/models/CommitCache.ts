import mongoose, { Schema, Document, Model } from 'mongoose';

export interface CommitCache extends Document {
  repoFullName: string; // "owner/repo"
  sha: string;
  committedAt: Date;
  fetchedAt: Date;
}

const CommitCacheSchema = new Schema<CommitCache>(
  {
    repoFullName: { type: String, required: true },
    sha: { type: String, required: true },
    committedAt: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

CommitCacheSchema.index({ repoFullName: 1, sha: 1 }, { unique: true });

export const CommitCacheModel: Model<CommitCache> =
  mongoose.models.CommitCache || mongoose.model<CommitCache>('CommitCache', CommitCacheSchema);


