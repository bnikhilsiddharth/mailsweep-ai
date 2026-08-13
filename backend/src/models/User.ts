import mongoose, { Document, Schema } from 'mongoose';

export interface ICleanupRule {
  id: string;
  name: string;
  isActive: boolean;
  conditions: {
    category?: string[];
    olderThanDays?: number;
    sizeGreaterThan?: number;
    senderPattern?: string;
  };
  action: 'delete' | 'archive' | 'label';
  labelName?: string;
  lastRunAt?: Date;
  emailsProcessed: number;
  createdAt: Date;
}

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  avatar: string;
  createdAt: Date;
  lastSyncAt: Date;
  oauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scopes: string[];
  };
  preferences: {
    protectedCategories: string[];
    protectedSenders: string[];
    cleanupRules: ICleanupRule[];
    notificationFrequency: 'daily' | 'weekly' | 'never';
    theme: 'dark' | 'light';
    copilotHistory: Array<{ role: string; content: string; timestamp: Date }>;
  };
  stats: {
    totalEmailsAnalyzed: number;
    totalStorageSaved: number;
    cleanupCount: number;
    inboxHealthScore: number;
    lastHealthCalculation: Date;
    weeklyReportSentAt: Date;
  };
}

const CleanupRuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  conditions: {
    category: [String],
    olderThanDays: Number,
    sizeGreaterThan: Number,
    senderPattern: String,
  },
  action: { type: String, enum: ['delete', 'archive', 'label'], required: true },
  labelName: String,
  lastRunAt: Date,
  emailsProcessed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avatar: String,
  createdAt: { type: Date, default: Date.now },
  lastSyncAt: Date,
  oauth: {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scopes: [String],
  },
  preferences: {
    protectedCategories: { 
      type: [String], 
      default: ['banking', 'legal', 'medical', 'government', 'academic'] 
    },
    protectedSenders: { type: [String], default: [] },
    cleanupRules: [CleanupRuleSchema],
    notificationFrequency: { 
      type: String, 
      enum: ['daily', 'weekly', 'never'], 
      default: 'weekly' 
    },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    copilotHistory: [{
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }],
  },
  stats: {
    totalEmailsAnalyzed: { type: Number, default: 0 },
    totalStorageSaved: { type: Number, default: 0 },
    cleanupCount: { type: Number, default: 0 },
    inboxHealthScore: { type: Number, default: 0 },
    lastHealthCalculation: Date,
    weeklyReportSentAt: Date,
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
