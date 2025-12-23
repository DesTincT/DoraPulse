import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface Incident extends Document {
  projectId: Types.ObjectId;
  service: string;
  openedAt: Date;
  resolvedAt?: Date | null;
  title: string;
  description: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
}

const IncidentSchema = new Schema<Incident>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    service: { type: String, required: true },
    openedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['SEV1', 'SEV2', 'SEV3'], required: true },
  },
  {
    timestamps: false,
  },
);

export const IncidentModel: Model<Incident> =
  mongoose.models.Incident || mongoose.model<Incident>('Incident', IncidentSchema);
