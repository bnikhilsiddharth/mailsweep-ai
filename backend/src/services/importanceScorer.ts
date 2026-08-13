import { gmail_v1 } from 'googleapis';
import { getHeaderValue, extractSenderEmail, isProtectedEmail, detectCategory } from './gmail';

export interface ScoredEmail {
  messageId: string;
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  date: Date;
  size: number;
  importanceScore: number;
  category: string;
  isProtected: boolean;
  protectionReason?: string;
  hasAttachment: boolean;
  snippet: string;
  labels: string[];
}

export interface UserHistory {
  approvedDeletionSenders: string[];
  rejectedDeletionSenders: string[];
  protectedSenders: string[];
  frequentSenders: string[];
}

export const scoreImportance = (
  message: gmail_v1.Schema$Message,
  userHistory: UserHistory
): number => {
  const labels = (message.labelIds || []) as string[];
  const fromHeader = getHeaderValue(message, 'From');
  const subject = getHeaderValue(message, 'Subject');
  const senderEmail = extractSenderEmail(fromHeader);
  const listUnsubscribe = getHeaderValue(message, 'List-Unsubscribe');
  const date = new Date(parseInt(message.internalDate || '0'));
  const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  // Protected emails always score 100
  const protection = isProtectedEmail(senderEmail, subject, labels);
  if (protection.protected) return 100;
  if (userHistory.protectedSenders.includes(senderEmail)) return 100;
  
  let score = 50;
  
  // Sender signals
  if (userHistory.frequentSenders.includes(senderEmail)) score += 20;
  if (userHistory.rejectedDeletionSenders.includes(senderEmail)) score += 25;
  if (userHistory.approvedDeletionSenders.includes(senderEmail)) score -= 20;
  
  // Gmail category labels (strong signals)
  if (labels.includes('CATEGORY_PROMOTIONS')) score -= 30;
  if (labels.includes('CATEGORY_SOCIAL')) score -= 15;
  if (labels.includes('CATEGORY_UPDATES')) score -= 10;
  if (labels.includes('SPAM')) score -= 40;
  if (labels.includes('STARRED')) score += 30;
  if (labels.includes('IMPORTANT')) score += 20;
  
  // Newsletter detection
  if (listUnsubscribe) score -= 25;
  
  // Thread depth (replied emails are more important)
  // Higher historyId means more activity on thread
  const isInThread = message.threadId !== message.id;
  if (isInThread) score += 10;
  
  // Age signals
  if (ageDays > 730) score -= 20; // 2+ years
  else if (ageDays > 365) score -= 10; // 1-2 years
  else if (ageDays < 30) score += 5; // Recent
  
  // Size signals (very large attachments in promos are likely safe to delete)
  const size = message.sizeEstimate || 0;
  if (labels.includes('CATEGORY_PROMOTIONS') && size > 500000) score -= 10;
  
  return Math.max(0, Math.min(100, score));
};

export const processMessageForDisplay = (
  message: gmail_v1.Schema$Message,
  userHistory: UserHistory
): ScoredEmail => {
  const labels = (message.labelIds || []) as string[];
  const fromHeader = getHeaderValue(message, 'From');
  const subject = getHeaderValue(message, 'Subject') || '(No subject)';
  const senderEmail = extractSenderEmail(fromHeader);
  const listUnsubscribe = getHeaderValue(message, 'List-Unsubscribe');
  const headers: Record<string, string> = {};
  
  (message.payload?.headers || []).forEach(h => {
    if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
  });
  
  const category = detectCategory(labels, senderEmail, headers);
  const protection = isProtectedEmail(senderEmail, subject, labels);
  const importanceScore = scoreImportance(message, userHistory);
  const hasAttachment = (message.payload?.parts || []).some(
    p => p.filename && p.filename.length > 0
  );
  
  return {
    messageId: message.id || '',
    threadId: message.threadId || '',
    subject,
    sender: fromHeader,
    senderEmail,
    date: new Date(parseInt(message.internalDate || '0')),
    size: message.sizeEstimate || 0,
    importanceScore,
    category,
    isProtected: protection.protected || userHistory.protectedSenders.includes(senderEmail),
    protectionReason: protection.reason || undefined,
    hasAttachment,
    snippet: message.snippet || '',
    labels,
  };
};

export const calculateInboxHealthScore = (metrics: {
  storagePercent: number;
  unreadRatio: number;
  newsletterRatio: number;
  spamCount: number;
  totalCount: number;
  attachmentStoragePercent: number;
}): { score: number; breakdown: Record<string, number> } => {
  const { storagePercent, unreadRatio, newsletterRatio, spamCount, totalCount, attachmentStoragePercent } = metrics;
  
  // Each component scored 0-100, then weighted
  const storageScore = Math.max(0, 100 - storagePercent);
  const unreadScore = Math.max(0, 100 - (unreadRatio * 100 * 1.5));
  const newsletterScore = Math.max(0, 100 - (newsletterRatio * 100 * 2));
  const spamScore = Math.max(0, 100 - ((spamCount / Math.max(totalCount, 1)) * 100 * 3));
  const attachmentScore = Math.max(0, 100 - attachmentStoragePercent * 0.8);
  
  const score = Math.round(
    storageScore * 0.25 +
    unreadScore * 0.20 +
    newsletterScore * 0.25 +
    spamScore * 0.15 +
    attachmentScore * 0.15
  );
  
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      storageScore: Math.round(storageScore),
      unreadScore: Math.round(unreadScore),
      newsletterScore: Math.round(newsletterScore),
      spamScore: Math.round(spamScore),
      attachmentScore: Math.round(attachmentScore),
    },
  };
};

export const forecastStorage = (snapshots: Array<{ date: Date; totalUsed: number; totalCapacity: number }>) => {
  if (snapshots.length < 3) return null;
  
  const n = snapshots.length;
  const xs = snapshots.map((_, i) => i);
  const ys = snapshots.map(s => s.totalUsed);
  
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const capacity = snapshots[snapshots.length - 1].totalCapacity;
  const currentUsed = snapshots[snapshots.length - 1].totalUsed;
  const daysBetweenSnapshots = snapshots.length > 1 
    ? (snapshots[snapshots.length - 1].date.getTime() - snapshots[0].date.getTime()) / (1000 * 60 * 60 * 24) / snapshots.length
    : 1;
    
  const dailyGrowthBytes = slope / Math.max(daysBetweenSnapshots, 1);
  const remainingBytes = capacity - currentUsed;
  const daysToFull = dailyGrowthBytes > 0 ? Math.round(remainingBytes / dailyGrowthBytes) : 999;
  
  return {
    daysToFull: Math.min(daysToFull, 999),
    estimatedFullDate: new Date(Date.now() + daysToFull * 24 * 60 * 60 * 1000),
    monthlyGrowthBytes: dailyGrowthBytes * 30,
    dailyGrowthBytes,
    confidence: snapshots.length > 14 ? 'high' : snapshots.length > 7 ? 'medium' : 'low',
    projections: {
      '30d': Math.min(currentUsed + dailyGrowthBytes * 30, capacity),
      '60d': Math.min(currentUsed + dailyGrowthBytes * 60, capacity),
      '90d': Math.min(currentUsed + dailyGrowthBytes * 90, capacity),
    },
  };
};
