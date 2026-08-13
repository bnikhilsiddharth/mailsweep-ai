import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalysisCache extends Document {
  userId: mongoose.Types.ObjectId;
  analyzedAt: Date;
  expiresAt: Date;
  storageStats: {
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
  };
  emailCount: {
    total: number;
    unread: number;
    newsletters: number;
    promotions: number;
    social: number;
    withAttachments: number;
    starred: number;
    spam: number;
  };
  inboxHealthScore: number;
  healthBreakdown: {
    storageScore: number;
    unreadScore: number;
    newsletterScore: number;
    spamScore: number;
    attachmentScore: number;
  };
  topSenders: Array<{
    email: string;
    name: string;
    count: number;
    totalSize: number;
    category: string;
    isSubscription: boolean;
    unsubscribeEmail?: string;
    unsubscribeUrl?: string;
  }>;
  topAttachments: Array<{
    messageId: string;
    filename: string;
    size: number;
    mimeType: string;
    date: Date;
    sender: string;
    subject: string;
  }>;
  cleanupCandidates: Array<{
    messageId: string;
    threadId: string;
    subject: string;
    sender: string;
    date: Date;
    size: number;
    importanceScore: number;
    category: string;
    isProtected: boolean;
    protectionReason?: string;
    hasAttachment: boolean;
    snippet: string;
  }>;
  subscriptions: Array<{
    email: string;
    name: string;
    count: number;
    totalSize: number;
    lastEmail: Date;
    unsubscribeEmail?: string;
    unsubscribeUrl?: string;
    estimatedMonthlyEmails: number;
  }>;
}

const AnalysisCacheSchema = new Schema<IAnalysisCache>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  analyzedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: 0 } },
  storageStats: {
    totalUsed: Number,
    totalCapacity: Number,
    percentUsed: Number,
    breakdown: {
      attachments: Number,
      newsletters: Number,
      promotions: Number,
      social: Number,
      updates: Number,
      other: Number,
    },
  },
  emailCount: {
    total: Number,
    unread: Number,
    newsletters: Number,
    promotions: Number,
    social: Number,
    withAttachments: Number,
    starred: Number,
    spam: Number,
  },
  inboxHealthScore: Number,
  healthBreakdown: {
    storageScore: Number,
    unreadScore: Number,
    newsletterScore: Number,
    spamScore: Number,
    attachmentScore: Number,
  },
  topSenders: [{
    email: String,
    name: String,
    count: Number,
    totalSize: Number,
    category: String,
    isSubscription: Boolean,
    unsubscribeEmail: String,
    unsubscribeUrl: String,
  }],
  topAttachments: [{
    messageId: String,
    filename: String,
    size: Number,
    mimeType: String,
    date: Date,
    sender: String,
    subject: String,
  }],
  cleanupCandidates: [{
    messageId: String,
    threadId: String,
    subject: String,
    sender: String,
    date: Date,
    size: Number,
    importanceScore: Number,
    category: String,
    isProtected: Boolean,
    protectionReason: String,
    hasAttachment: Boolean,
    snippet: String,
  }],
  subscriptions: [{
    email: String,
    name: String,
    count: Number,
    totalSize: Number,
    lastEmail: Date,
    unsubscribeEmail: String,
    unsubscribeUrl: String,
    estimatedMonthlyEmails: Number,
  }],
});

export const AnalysisCache = mongoose.model<IAnalysisCache>('AnalysisCache', AnalysisCacheSchema);
