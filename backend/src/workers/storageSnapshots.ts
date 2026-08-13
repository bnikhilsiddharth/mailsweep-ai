import { User } from '../models/User';
import { AnalysisCache } from '../models/AnalysisCache';
import { StorageSnapshot } from '../models/StorageSnapshot';
import { logger } from '../utils/logger';

export const runStorageSnapshots = async (): Promise<void> => {
  try {
    const recentCaches = await AnalysisCache.find({
      analyzedAt: { $gte: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    
    for (const cache of recentCaches) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existing = await StorageSnapshot.findOne({
          userId: cache.userId,
          date: { $gte: today },
        });
        
        if (!existing) {
          await StorageSnapshot.create({
            userId: cache.userId,
            date: new Date(),
            totalUsed: cache.storageStats.totalUsed,
            totalCapacity: cache.storageStats.totalCapacity,
            percentUsed: cache.storageStats.percentUsed,
            breakdown: cache.storageStats.breakdown,
          });
        }
      } catch (err) {
        logger.error(`Snapshot failed for user ${cache.userId}:`, err);
      }
    }
    
    logger.info(`Storage snapshots updated for ${recentCaches.length} users`);
  } catch (err) {
    logger.error('Storage snapshots cron failed:', err);
  }
};
