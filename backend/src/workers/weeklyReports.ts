import { User } from '../models/User';
import { AnalysisCache } from '../models/AnalysisCache';
import { WeeklyReport } from '../models/WeeklyReport';
import { logger } from '../utils/logger';

export const runWeeklyReports = async (): Promise<void> => {
  try {
    const users = await User.find({
      'preferences.notificationFrequency': { $in: ['weekly', 'daily'] },
      lastSyncAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    
    logger.info(`Running weekly reports for ${users.length} users`);
    
    for (const user of users) {
      try {
        const cache = await AnalysisCache.findOne({ userId: user._id }).sort({ analyzedAt: -1 });
        if (!cache) continue;
        
        const weekOf = new Date();
        weekOf.setDate(weekOf.getDate() - weekOf.getDay());
        
        await WeeklyReport.findOneAndUpdate(
          { userId: user._id, weekOf },
          {
            userId: user._id,
            weekOf,
            generatedAt: new Date(),
            metrics: {
              storageSaved: user.stats.totalStorageSaved || 0,
              emailsCleaned: user.stats.totalEmailsAnalyzed || 0,
              inboxHealthDelta: 0,
              newSubscriptionsDetected: cache.subscriptions.length,
              topClutterSource: cache.topSenders[0]?.name || 'Promotions',
              storageGrowth: 0,
              cleanupEfficiency: 75,
            },
            aiInsights: [
              `Your inbox health score is ${cache.inboxHealthScore}/100.`,
              `You have ${cache.cleanupCandidates.length} emails that could be safely removed.`,
              `${cache.subscriptions.length} active subscriptions were detected.`,
            ],
            recommendations: [
              'Run a cleanup session to recover storage.',
              'Review and unsubscribe from unused newsletters.',
            ],
            storageSnapshot: {
              start: cache.storageStats.totalUsed,
              end: cache.storageStats.totalUsed,
              capacity: cache.storageStats.totalCapacity,
            },
          },
          { upsert: true }
        );
        
        await User.findByIdAndUpdate(user._id, {
          'stats.weeklyReportSentAt': new Date(),
        });
        
      } catch (err) {
        logger.error(`Failed to generate report for user ${user._id}:`, err);
      }
    }
    
    logger.info('Weekly reports completed');
  } catch (err) {
    logger.error('Weekly reports cron failed:', err);
  }
};
