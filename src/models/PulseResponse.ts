import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PulseResponse extends Document {
  projectId: Types.ObjectId;
  userTgId: number;
  week: string;
  answers: {
    satisfaction: number;
    ciUnder10min: boolean;
    blocker: string;
  };
}

const PulseResponseSchema = new Schema<PulseResponse>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userTgId: { type: Number, required: true },
    week: { type: String, required: true }, // e.g., '2024-W23'
    answers: {
      satisfaction: { type: Number, required: true },
      ciUnder10min: { type: Boolean, required: true },
      blocker: { type: String, required: true },
    },
  },
  {
    timestamps: false,
  },
);

PulseResponseSchema.index({ projectId: 1, userTgId: 1, week: 1 }, { unique: true });

export const PulseResponseModel: Model<PulseResponse> =
  mongoose.models.PulseResponse || mongoose.model<PulseResponse>('PulseResponse', PulseResponseSchema);
