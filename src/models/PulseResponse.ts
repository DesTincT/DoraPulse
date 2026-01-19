import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PulseResponse extends Document {
  projectId: Types.ObjectId;
  week: string; // ISO week YYYY-Www
  userId: number; // Telegram user id
  rating: number; // 1..5
  createdAt: Date;
  updatedAt: Date;
}

const PulseResponseSchema = new Schema<PulseResponse>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    week: { type: String, required: true },
    userId: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  {
    timestamps: true,
  },
);

PulseResponseSchema.index({ projectId: 1, week: 1, userId: 1 }, { unique: true });

export const PulseResponseModel: Model<PulseResponse> =
  mongoose.models.PulseResponse || mongoose.model<PulseResponse>('PulseResponse', PulseResponseSchema);
