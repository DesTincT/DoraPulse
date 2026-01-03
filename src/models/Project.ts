import mongoose, { Schema, Document, Model } from 'mongoose';

interface ProjectSettings {
  prodRule: {
    branch: string;
    workflowNameRegex: string;
  };
  ltBaseline: 'pr_open' | 'first_commit';
  prodEnvironments?: string[];
  github?: {
    installationId?: number;
    accountLogin?: string;
    accountType?: 'User' | 'Organization';
    repos?: string[];
    updatedAt?: Date;
  };
}

interface ProjectGithub {
  installationId?: number;
  accountLogin?: string;
  accountType?: 'User' | 'Organization';
  repos?: string[];
  updatedAt?: Date;
}

export interface Project extends Document {
  name: string;
  chatId: number;
  accessKey: string;
  settings: ProjectSettings;
  github?: ProjectGithub;
  // Canonical GitHub App installation tracking (source of truth for the Mini App UI)
  githubInstallationId?: number;
  githubInstalledAt?: Date;
  githubAccountLogin?: string;
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
      prodEnvironments: { type: [String], required: false, default: undefined },
      github: {
        installationId: { type: Number, required: false },
        accountLogin: { type: String, required: false },
        accountType: { type: String, enum: ['User', 'Organization'], required: false },
        repos: { type: [String], required: false, default: undefined },
        updatedAt: { type: Date, required: false },
      },
    },
    github: {
      installationId: { type: Number, required: false },
      accountLogin: { type: String, required: false },
      accountType: { type: String, enum: ['User', 'Organization'], required: false },
      repos: { type: [String], required: false, default: undefined },
      updatedAt: { type: Date, required: false },
    },
    githubInstallationId: { type: Number, required: false },
    githubInstalledAt: { type: Date, required: false },
    githubAccountLogin: { type: String, required: false },
  },
  {
    timestamps: false,
  },
);

export const ProjectModel: Model<Project> =
  mongoose.models.Project || mongoose.model<Project>('Project', ProjectSchema);
