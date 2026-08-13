import mongoose, { Document, Schema } from 'mongoose';

export interface IStorageSnapshot extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  totalUsed: number;
  totalCapacity: number;
  percentUsed: number;
  breakdown: {
    attachments: number;
    newsletters: number;
    promotions: number;
    social: number;
    updates: number;
    other: number;
  };
}

const StorageSnapshotSchema = new Schema<IStorageSnapshot>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  totalUsed: { type: Number, required: true },
  totalCapacity: { type: Number, required: true },
  percentUsed: { type: Number, required: true },
  breakdown: {
    attachments: Number,
    newsletters: Number,
    promotions: Number,
    social: Number,
    updates: Number,
    other: Number,
  },
});

// Unique per user per day
StorageSnapshotSchema.index({ userId: 1, date: 1 }, { unique: false });

export const StorageSnapshot = mongoose.model<IStorageSnapshot>('StorageSnapshot', StorageSnapshotSchema);
