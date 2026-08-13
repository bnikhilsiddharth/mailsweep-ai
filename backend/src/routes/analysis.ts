import { Router, Response } from 'express';
import { google } from 'googleapis';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AnalysisCache } from '../models/AnalysisCache';
import { StorageSnapshot } from '../models/StorageSnapshot';
import { User } from '../models/User';
import { runFullAnalysis } from '../services/analysisService';
import { forecastStorage } from '../services/importanceScorer';
import { gmailRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/analysis/storage - Get cached storage analysis
router.get('/storage', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId })
      .sort({ analyzedAt: -1 });
    
    if (!cache) {
      return res.json({ needsSync: true, message: 'Run analysis to get started' });
    }
    
    res.json({
      storageStats: cache.storageStats,
      analyzedAt: cache.analyzedAt,
      needsSync: false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get storage data' });
  }
});

// GET /api/analysis/inbox - Full inbox analysis data
router.get('/inbox', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId })
      .sort({ analyzedAt: -1 });
    
    if (!cache) {
      return res.json({ needsSync: true });
    }
    
    res.json({
      inboxHealthScore: cache.inboxHealthScore,
      healthBreakdown: cache.healthBreakdown,
      emailCount: cache.emailCount,
      storageStats: cache.storageStats,
      topSenders: cache.topSenders.slice(0, 20),
      analyzedAt: cache.analyzedAt,
      needsSync: false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get inbox data' });
  }
});

// POST /api/analysis/sync - Trigger re-analysis
router.post('/sync', requireAuth, gmailRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const userHistory = {
      approvedDeletionSenders: [],
      rejectedDeletionSenders: [],
      protectedSenders: user.preferences.protectedSenders || [],
      frequentSenders: [],
    };
    
    const result = await runFullAnalysis(
      req.oauth2Client,
      req.userId!,
      userHistory,
      user.preferences.protectedSenders || []
    );
    
    // Update user stats
    await User.findByIdAndUpdate(req.userId, {
      lastSyncAt: new Date(),
      'stats.inboxHealthScore': result.inboxHealthScore,
      'stats.lastHealthCalculation': new Date(),
    });
    
    res.json({
      success: true,
      inboxHealthScore: result.inboxHealthScore,
      storageStats: result.storageStats,
      emailCount: result.emailCount,
      analyzedAt: result.analyzedAt,
    });
  } catch (err: any) {
    logger.error('Analysis sync error:', err);
    res.status(500).json({ error: 'Analysis failed. Please try again.', details: err.message });
  }
});

// GET /api/analysis/senders - Top senders
router.get('/senders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.json({ needsSync: true, senders: [] });
    res.json({ senders: cache.topSenders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sender data' });
  }
});

// GET /api/analysis/attachments - Top attachments
router.get('/attachments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.json({ needsSync: true, attachments: [] });
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const start = (page - 1) * limit;
    
    res.json({
      attachments: cache.topAttachments.slice(start, start + limit),
      total: cache.topAttachments.length,
      page,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get attachment data' });
  }
});

// GET /api/analysis/forecast - Storage forecast
router.get('/forecast', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const snapshots = await StorageSnapshot.find({ userId: req.userId })
      .sort({ date: 1 })
      .limit(90);
    
    if (snapshots.length < 2) {
      return res.json({ 
        insufficient: true, 
        message: 'Need more data for accurate forecast. Check back in a few days.',
        snapshots: snapshots.map(s => ({
          date: s.date,
          totalUsed: s.totalUsed,
          totalCapacity: s.totalCapacity,
          percentUsed: s.percentUsed,
        }))
      });
    }
    
    const forecast = forecastStorage(snapshots.map(s => ({
      date: s.date,
      totalUsed: s.totalUsed,
      totalCapacity: s.totalCapacity,
    })));
    
    res.json({
      forecast,
      snapshots: snapshots.map(s => ({
        date: s.date,
        totalUsed: s.totalUsed,
        totalCapacity: s.totalCapacity,
        percentUsed: s.percentUsed,
        breakdown: s.breakdown,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get forecast data' });
  }
});

export default router;
