import { Router, Response } from 'express';
import { google } from 'googleapis';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AnalysisCache } from '../models/AnalysisCache';
import { CleanupSession } from '../models/CleanupSession';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/cleanup/candidates - Get cleanup candidates
router.get('/candidates', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.json({ needsSync: true, candidates: [] });
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const category = req.query.category as string;
    const start = (page - 1) * limit;
    
    let candidates = cache.cleanupCandidates.filter(c => !c.isProtected);
    if (category) candidates = candidates.filter(c => c.category === category);
    
    res.json({
      candidates: candidates.slice(start, start + limit),
      total: candidates.length,
      page,
      totalSize: candidates.reduce((sum, c) => sum + c.size, 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get cleanup candidates' });
  }
});

// POST /api/cleanup/preview - What-If simulator
router.post('/preview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds array required' });
    }
    
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    const selectedEmails = cache.cleanupCandidates.filter(c => messageIds.includes(c.messageId));
    const protectedSelected = selectedEmails.filter(c => c.isProtected);
    const safeToDelete = selectedEmails.filter(c => !c.isProtected);
    
    const totalSize = safeToDelete.reduce((sum, e) => sum + e.size, 0);
    
    const categoryBreakdown = safeToDelete.reduce((acc, email) => {
      acc[email.category] = (acc[email.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      emailsToDelete: safeToDelete.length,
      emailsProtected: protectedSelected.length,
      storageRecovered: totalSize,
      categoryBreakdown,
      riskLevel: safeToDelete.some(e => e.importanceScore > 40) ? 'medium' : 'low',
      rollbackAvailable: true,
      rollbackWindowDays: 30,
      details: safeToDelete.slice(0, 10).map(e => ({
        subject: e.subject,
        sender: e.sender,
        size: e.size,
        category: e.category,
        importanceScore: e.importanceScore,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Preview failed' });
  }
});

// POST /api/cleanup/execute - Execute cleanup
router.post('/execute', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds, action = 'delete' } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds required' });
    }
    
    const user = req.user;
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    // Filter out any protected emails (safety net)
    const selectedEmails = cache.cleanupCandidates.filter(c => messageIds.includes(c.messageId));
    const safeIds = selectedEmails.filter(c => !c.isProtected).map(c => c.messageId);
    const totalSize = selectedEmails.filter(c => !c.isProtected).reduce((sum, e) => sum + e.size, 0);
    
    if (safeIds.length === 0) {
      return res.status(400).json({ error: 'All selected emails are protected from deletion' });
    }
    
    // Create session record
    const session = await CleanupSession.create({
      userId: req.userId,
      status: 'in_progress',
      triggeredBy: 'manual',
    });
    
    const gmail = google.gmail({ version: 'v1', auth: req.oauth2Client });
    const BATCH_SIZE = 50;
    const processedIds: string[] = [];
    
    try {
      for (let i = 0; i < safeIds.length; i += BATCH_SIZE) {
        const batch = safeIds.slice(i, i + BATCH_SIZE);
        
        if (action === 'archive') {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              removeLabelIds: ['INBOX'],
            },
          });
        } else {
          // Move to trash (allows 30-day recovery)
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: ['TRASH'],
              removeLabelIds: ['INBOX'],
            },
          });
        }
        
        processedIds.push(...batch);
        await new Promise(r => setTimeout(r, 100)); // rate limit
      }
      
      // Update session
      await CleanupSession.findByIdAndUpdate(session._id, {
        status: 'completed',
        completedAt: new Date(),
        deletedMessageIds: action === 'delete' ? processedIds : [],
        archivedMessageIds: action === 'archive' ? processedIds : [],
        'summary.emailsDeleted': action === 'delete' ? processedIds.length : 0,
        'summary.emailsArchived': action === 'archive' ? processedIds.length : 0,
        'summary.storageRecovered': totalSize,
        'summary.categoriesAffected': [...new Set(selectedEmails.map(e => e.category))],
      });
      
      // Update user stats
      await User.findByIdAndUpdate(req.userId, {
        $inc: { 
          'stats.totalStorageSaved': totalSize,
          'stats.cleanupCount': 1,
          'stats.totalEmailsAnalyzed': processedIds.length,
        },
      });
      
      // Invalidate cache
      await AnalysisCache.findOneAndUpdate(
        { userId: req.userId },
        { expiresAt: new Date() } // expire immediately
      );
      
      res.json({
        success: true,
        sessionId: session._id,
        emailsProcessed: processedIds.length,
        storageRecovered: totalSize,
        action,
        rollbackAvailable: true,
        rollbackExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      
    } catch (gmailErr: any) {
      await CleanupSession.findByIdAndUpdate(session._id, { status: 'failed' });
      logger.error('Gmail cleanup error:', gmailErr);
      res.status(500).json({ error: 'Cleanup failed partway. Some emails may have been processed.', sessionId: session._id });
    }
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute cleanup' });
  }
});

// POST /api/cleanup/rollback/:sessionId
router.post('/rollback/:sessionId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const session = await CleanupSession.findOne({
      _id: req.params.sessionId,
      userId: req.userId,
      status: 'completed',
    });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.rollbackExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Rollback window expired (30 days)' });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: req.oauth2Client });
    const idsToRestore = [...session.deletedMessageIds, ...session.archivedMessageIds];
    
    if (idsToRestore.length === 0) {
      return res.status(400).json({ error: 'No emails to restore' });
    }
    
    const BATCH_SIZE = 50;
    for (let i = 0; i < idsToRestore.length; i += BATCH_SIZE) {
      const batch = idsToRestore.slice(i, i + BATCH_SIZE);
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: batch,
          removeLabelIds: ['TRASH'],
          addLabelIds: ['INBOX'],
        },
      });
      await new Promise(r => setTimeout(r, 100));
    }
    
    await CleanupSession.findByIdAndUpdate(session._id, { status: 'rolled_back' });
    
    res.json({
      success: true,
      emailsRestored: idsToRestore.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Rollback failed' });
  }
});

// GET /api/cleanup/history
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await CleanupSession.find({ userId: req.userId })
      .sort({ startedAt: -1 })
      .limit(20);
    
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
