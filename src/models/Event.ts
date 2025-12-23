import mongoose, { Schema, Types, Document, Model } from 'mongoose';

interface Event extends Document {
  ts: Date;
  source: 'github' | 'manual';
  type:
    | 'pr_open'
    | 'pr_merge'
    | 'commit'
    | 'deploy_succeeded'
    | 'deploy_failed'
    | 'incident_open'
    | 'incident_resolved';
  projectId: Types.ObjectId;
  repoId: Types.ObjectId;
  dedupKey?: string;
  actor: string;
  branch: string;
  tag: string;
  sha: string;
  prId: number;
  env: 'prod' | 'stage' | null;
  meta: any;
  bodyPreview: string;
}

const EventSchema = new Schema<Event>(
  {
    ts: { type: Date, required: true },
    source: { type: String, enum: ['github', 'manual'], required: true },
    type: {
      type: String,
      enum: [
        'pr_open',
        'pr_merge',
        'pr_merged',
        'commit',
        'deploy_succeeded',
        'deploy_failed',
        'incident_open',
        'incident_resolved',
      ],
      required: true,
    },
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
    repoId: { type: Schema.Types.ObjectId, required: true, ref: 'Repo' },
    actor: { type: String },
    branch: { type: String },
    tag: { type: String },
    sha: { type: String },
    prId: { type: Number },
    env: {
      type: String,
      enum: ['prod', 'stage', null],
      default: null,
    },
    meta: { type: Schema.Types.Mixed, default: {} },
    bodyPreview: { type: String, maxlength: 300 },
    dedupKey: { type: String },
  },
  {
    timestamps: false,
  },
);

// Индексы
EventSchema.index({ projectId: 1, ts: 1 });
EventSchema.index({ repoId: 1, ts: 1 });
EventSchema.index({ type: 1 });
EventSchema.index(
  { projectId: 1, dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } },
);

export const EventModel: Model<Event> = mongoose.models.Event || mongoose.model<Event>('Event', EventSchema);
