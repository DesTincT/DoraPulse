import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface WebhookDelivery extends Document {
  provider: 'github';
  deliveryId: string;
  projectId?: Types.ObjectId;
  installationId?: number;
  repoFullName?: string;
  eventName?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  seenCount: number;
  status: 'processed' | 'duplicate' | 'failed';
  processedAt?: Date;
  error?: string;
}

const WebhookDeliverySchema = new Schema<WebhookDelivery>(
  {
    provider: { type: String, enum: ['github'], required: true },
    deliveryId: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, required: false, ref: 'Project' },
    installationId: { type: Number, required: false },
    repoFullName: { type: String, required: false },
    eventName: { type: String, required: false },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    seenCount: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ['processed', 'duplicate', 'failed'], required: true, default: 'processed' },
    processedAt: { type: Date, required: false },
    error: { type: String, required: false },
  },
  { timestamps: false },
);

WebhookDeliverySchema.index({ provider: 1, deliveryId: 1 }, { unique: true });
WebhookDeliverySchema.index({ projectId: 1, lastSeenAt: -1 });

export const WebhookDeliveryModel: Model<WebhookDelivery> =
  mongoose.models.WebhookDelivery || mongoose.model<WebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);


