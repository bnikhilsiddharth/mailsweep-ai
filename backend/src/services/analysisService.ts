import { google, gmail_v1 } from 'googleapis';
import { AnalysisCache } from '../models/AnalysisCache';
import { StorageSnapshot } from '../models/StorageSnapshot';
import { 
  fetchEmailsWithPagination, 
  batchGetMessages, 
  getHeaderValue, 
  extractSenderEmail, 
  extractSenderName,
  detectCategory,
  isProtectedEmail,
  parseUnsubscribeHeader,
} from './gmail';
import { 
  scoreImportance, 
  processMessageForDisplay,
  calculateInboxHealthScore,
  UserHistory 
} from './importanceScorer';
import { logger } from '../utils/logger';

export const runFullAnalysis = async (
  auth: any,
  userId: string,
  userHistory: UserHistory,
  protectedSenders: string[] = []
): Promise<any> => {
  const gmail = google.gmail({ version: 'v1', auth });
  
  logger.info(`Starting full analysis for user ${userId}`);
  
  // 1. Get inbox profile
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const totalMessages = profile.data.messagesTotal || 0;
  
  // 2. Fetch messages from key categories (max 2000 for performance)
  const [allMessages, promotionMessages, newsletterMessages, spamMessages, socialMessages] = await Promise.all([
    fetchEmailsWithPagination(gmail, 'in:inbox', 500),
    fetchEmailsWithPagination(gmail, 'category:promotions', 300),
    fetchEmailsWithPagination(gmail, 'has:list-unsubscribe', 300),
    fetchEmailsWithPagination(gmail, 'in:spam', 100),
    fetchEmailsWithPagination(gmail, 'category:social', 200),
  ]);
  
  // 3. Get attachment emails separately
  const attachmentMessages = await fetchEmailsWithPagination(gmail, 'has:attachment larger:500k', 200);
  
  // 4. Batch get full message details
  const allIds = [...new Set([
    ...allMessages.map(m => m.id!),
    ...promotionMessages.map(m => m.id!),
    ...newsletterMessages.map(m => m.id!),
  ])].filter(Boolean).slice(0, 800);
  
  const attachmentIds = attachmentMessages.map(m => m.id!).filter(Boolean);
  
  const [detailedMessages, detailedAttachments] = await Promise.all([
    batchGetMessages(gmail, allIds, 'metadata'),
    batchGetMessages(gmail, attachmentIds.slice(0, 100), 'full'),
  ]);
  
  // 5. Process messages
  const senderMap = new Map<string, {
    email: string; name: string; count: number; totalSize: number; 
    category: string; isSubscription: boolean; unsubscribeEmail?: string; unsubscribeUrl?: string;
  }>();
  
  const cleanupCandidates: any[] = [];
  let totalEstimatedSize = 0;
  let promotionSize = 0;
  let newsletterSize = 0;
  let socialSize = 0;
  
  for (const message of detailedMessages) {
    const fromHeader = getHeaderValue(message, 'From');
    const subject = getHeaderValue(message, 'Subject') || '(No subject)';
    const senderEmail = extractSenderEmail(fromHeader);
    const senderName = extractSenderName(fromHeader);
    const listUnsubscribe = getHeaderValue(message, 'List-Unsubscribe');
    const size = message.sizeEstimate || 0;
    const labels = (message.labelIds || []) as string[];
    const headers: Record<string, string> = {};
    (message.payload?.headers || []).forEach(h => { if (h.name && h.value) headers[h.name.toLowerCase()] = h.value; });
    
    const category = detectCategory(labels, senderEmail, headers);
    const protection = isProtectedEmail(senderEmail, subject, labels);
    const importanceScore = scoreImportance(message, { ...userHistory, protectedSenders });
    
    totalEstimatedSize += size;
    if (category === 'promotions') promotionSize += size;
    if (category === 'newsletter') newsletterSize += size;
    if (category === 'social') socialSize += size;
    
    // Build sender map
    if (!senderMap.has(senderEmail)) {
      const unsubInfo = listUnsubscribe ? parseUnsubscribeHeader(listUnsubscribe) : {};
      senderMap.set(senderEmail, {
        email: senderEmail,
        name: senderName,
        count: 0,
        totalSize: 0,
        category,
        isSubscription: !!listUnsubscribe,
        unsubscribeEmail: unsubInfo.email,
        unsubscribeUrl: unsubInfo.url,
      });
    }
    
    const senderData = senderMap.get(senderEmail)!;
    senderData.count++;
    senderData.totalSize += size;
    
    // Add to cleanup candidates if score < 60 and not protected
    if (importanceScore < 60 && !protection.protected && !protectedSenders.includes(senderEmail)) {
      cleanupCandidates.push({
        messageId: message.id || '',
        threadId: message.threadId || '',
        subject,
        sender: fromHeader,
        date: new Date(parseInt(message.internalDate || '0')),
        size,
        importanceScore,
        category,
        isProtected: false,
        hasAttachment: (message.payload?.parts || []).some(p => p.filename && p.filename.length > 0),
        snippet: message.snippet || '',
      });
    }
  }
  
  // 6. Process attachments
  const topAttachments: any[] = [];
  for (const message of detailedAttachments) {
    const fromHeader = getHeaderValue(message, 'From');
    const subject = getHeaderValue(message, 'Subject') || '(No subject)';
    
    const parts = message.payload?.parts || [];
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.size) {
        topAttachments.push({
          messageId: message.id || '',
          filename: part.filename,
          size: part.body.size,
          mimeType: part.mimeType || '',
          date: new Date(parseInt(message.internalDate || '0')),
          sender: extractSenderEmail(fromHeader),
          subject,
        });
      }
    }
  }
  
  topAttachments.sort((a, b) => b.size - a.size);
  
  // 7. Sort and limit sender data
  const topSenders = Array.from(senderMap.values())
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 50);
  
  // 8. Subscription detection
  const subscriptions = Array.from(senderMap.values())
    .filter(s => s.isSubscription)
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      ...s,
      lastEmail: new Date(),
      estimatedMonthlyEmails: Math.round(s.count / 3), // rough 3-month estimate
    }))
    .slice(0, 30);
  
  // 9. Storage stats
  const capacityBytes = 15 * 1024 * 1024 * 1024;
  const attachmentTotalSize = topAttachments.reduce((sum, a) => sum + a.size, 0);
  
  const storageStats = {
    totalUsed: totalEstimatedSize,
    totalCapacity: capacityBytes,
    percentUsed: (totalEstimatedSize / capacityBytes) * 100,
    breakdown: {
      attachments: attachmentTotalSize,
      newsletters: newsletterSize,
      promotions: promotionSize,
      social: socialSize,
      updates: Math.round(totalEstimatedSize * 0.05),
      other: Math.max(0, totalEstimatedSize - attachmentTotalSize - newsletterSize - promotionSize - socialSize),
    },
  };
  
  // 10. Email counts
  const uniqueNewsletterIds = new Set(newsletterMessages.map(m => m.id));
  const uniquePromoIds = new Set(promotionMessages.map(m => m.id));
  const uniqueSocialIds = new Set(socialMessages.map(m => m.id));
  
  const emailCount = {
    total: totalMessages,
    unread: 0, // Would need separate query
    newsletters: uniqueNewsletterIds.size,
    promotions: uniquePromoIds.size,
    social: uniqueSocialIds.size,
    withAttachments: attachmentMessages.length,
    starred: 0,
    spam: spamMessages.length,
  };
  
  // 11. Health score
  const { score: inboxHealthScore, breakdown: healthBreakdown } = calculateInboxHealthScore({
    storagePercent: storageStats.percentUsed,
    unreadRatio: 0.3, // default
    newsletterRatio: emailCount.newsletters / Math.max(totalMessages, 1),
    spamCount: emailCount.spam,
    totalCount: totalMessages,
    attachmentStoragePercent: (attachmentTotalSize / capacityBytes) * 100,
  });
  
  // 12. Save to cache
  const cacheData = {
    userId,
    analyzedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    storageStats,
    emailCount,
    inboxHealthScore,
    healthBreakdown,
    topSenders: topSenders.slice(0, 30),
    topAttachments: topAttachments.slice(0, 50),
    cleanupCandidates: cleanupCandidates
      .sort((a, b) => a.importanceScore - b.importanceScore)
      .slice(0, 200),
    subscriptions,
  };
  
  await AnalysisCache.findOneAndUpdate(
    { userId },
    cacheData,
    { upsert: true, new: true }
  );
  
  // 13. Save storage snapshot
  await StorageSnapshot.create({
    userId,
    date: new Date(),
    totalUsed: storageStats.totalUsed,
    totalCapacity: storageStats.totalCapacity,
    percentUsed: storageStats.percentUsed,
    breakdown: storageStats.breakdown,
  });
  
  logger.info(`Analysis complete for user ${userId}. Health score: ${inboxHealthScore}`);
  
  return cacheData;
};
