import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface Repo extends Document {
  projectId: Types.ObjectId;
  owner: string;
  name: string;
  defaultBranch: string;
}

const RepoSchema = new Schema<Repo>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    defaultBranch: { type: String, required: true, default: 'main' },
  },
  {
    timestamps: false,
  },
);

export const RepoModel: Model<Repo> = mongoose.models.Repo || mongoose.model<Repo>('Repo', RepoSchema);
