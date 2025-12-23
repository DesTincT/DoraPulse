import mongoose, { Schema, Document, Model } from 'mongoose';

interface ProjectSettings {
  prodRule: {
    branch: string;
    workflowNameRegex: string;
  };
  ltBaseline: 'pr_open' | 'first_commit';
}

export interface Project extends Document {
  name: string;
  chatId: number;
  accessKey: string;
  settings: ProjectSettings;
}

const ProjectSchema = new Schema<Project>(
  {
    name: { type: String, required: true },
    chatId: { type: Number, required: true },
    accessKey: { type: String, required: true },
    settings: {
      prodRule: {
        branch: { type: String, required: true },
        workflowNameRegex: { type: String, required: true },
      },
      ltBaseline: {
        type: String,
        enum: ['pr_open', 'first_commit'],
        required: true,
      },
    },
  },
  {
    timestamps: false,
  },
);

export const ProjectModel: Model<Project> =
  mongoose.models.Project || mongoose.model<Project>('Project', ProjectSchema);
