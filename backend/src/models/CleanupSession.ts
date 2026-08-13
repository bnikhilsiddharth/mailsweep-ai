import mongoose, { Document, Schema } from 'mongoose';

export interface ICleanupSession extends Document {
  userId: mongoose.Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'rolled_back' | 'failed';
  summary: {
    emailsDeleted: number;
    emailsArchived: number;
    storageRecovered: number;
    categoriesAffected: string[];
  };
  deletedMessageIds: string[];
  archivedMessageIds: string[];
  rollbackExpiresAt: Date;
  triggeredBy: 'manual' | 'rule' | 'scheduled';
  ruleId?: string;
}

const CleanupSessionSchema = new Schema<ICleanupSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'rolled_back', 'failed'],
    default: 'pending'
  },
  summary: {
    emailsDeleted: { type: Number, default: 0 },
    emailsArchived: { type: Number, default: 0 },
    storageRecovered: { type: Number, default: 0 },
    categoriesAffected: [String],
  },
  deletedMessageIds: [String],
  archivedMessageIds: [String],
  rollbackExpiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  triggeredBy: { type: String, enum: ['manual', 'rule', 'scheduled'], default: 'manual' },
  ruleId: String,
});

export const CleanupSession = mongoose.model<ICleanupSession>('CleanupSession', CleanupSessionSchema);
