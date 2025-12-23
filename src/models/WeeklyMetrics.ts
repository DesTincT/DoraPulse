import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface WeeklyMetrics extends Document {
  projectId: Types.ObjectId;
  repoId: Types.ObjectId;
  week: string; // ISO 8601 week format, e.g., "2024-W23"
  df: {
    count: number;
    byDay: number[];
  };
  prCycleTime: {
    p50: number;
    p90: number;
  };
  leadTime: {
    p50: number;
    p90: number;
  } | null;
  cfr: {
    numerator: number;
    denominator: number;
    value: number;
  };
  mttr: {
    p50: number;
    p90: number;
    incidents: number;
  };
  coverage: {
    leadTime: {
      prodDeploys: number;
      prodDeploysWithSha: number;
      commitsResolved: number;
    };
    incidentsLinked: number;
  };
}

const WeeklyMetricsSchema = new Schema<WeeklyMetrics>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project' },
    repoId: { type: Schema.Types.ObjectId, required: true, ref: 'Repo' },
    week: { type: String, required: true }, // Consider format validation in logic layer
    df: {
      count: { type: Number, required: true },
      byDay: { type: [Number], required: true }, // Array of 7 numbers
    },
    prCycleTime: {
      p50: { type: Number, required: true },
      p90: { type: Number, required: true },
    },
    leadTime: {
      p50: { type: Number, required: false },
      p90: { type: Number, required: false },
    },
    cfr: {
      numerator: { type: Number, required: true },
      denominator: { type: Number, required: true },
      value: { type: Number, required: true },
    },
    mttr: {
      p50: { type: Number, required: true },
      p90: { type: Number, required: true },
      incidents: { type: Number, required: true },
    },
    coverage: {
      leadTime: {
        prodDeploys: { type: Number, required: true },
        prodDeploysWithSha: { type: Number, required: true },
        commitsResolved: { type: Number, required: true },
      },
      incidentsLinked: { type: Number, required: true },
    },
  },
  {
    timestamps: false,
  },
);

WeeklyMetricsSchema.index({ projectId: 1, repoId: 1, week: 1 }, { unique: true });

export const WeeklyMetricsModel: Model<WeeklyMetrics> =
  mongoose.models.WeeklyMetrics || mongoose.model<WeeklyMetrics>('WeeklyMetrics', WeeklyMetricsSchema);
