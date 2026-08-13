import mongoose, { Document, Schema } from 'mongoose';

export interface IWeeklyReport extends Document {
  userId: mongoose.Types.ObjectId;
  weekOf: Date;
  generatedAt: Date;
  metrics: {
    storageSaved: number;
    emailsCleaned: number;
    inboxHealthDelta: number;
    newSubscriptionsDetected: number;
    topClutterSource: string;
    storageGrowth: number;
    cleanupEfficiency: number;
  };
  aiInsights: string[];
  recommendations: string[];
  storageSnapshot: {
    start: number;
    end: number;
    capacity: number;
  };
}

const WeeklyReportSchema = new Schema<IWeeklyReport>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekOf: { type: Date, required: true },
  generatedAt: { type: Date, default: Date.now },
  metrics: {
    storageSaved: Number,
    emailsCleaned: Number,
    inboxHealthDelta: Number,
    newSubscriptionsDetected: Number,
    topClutterSource: String,
    storageGrowth: Number,
    cleanupEfficiency: Number,
  },
  aiInsights: [String],
  recommendations: [String],
  storageSnapshot: {
    start: Number,
    end: Number,
    capacity: Number,
  },
});

export const WeeklyReport = mongoose.model<IWeeklyReport>('WeeklyReport', WeeklyReportSchema);
