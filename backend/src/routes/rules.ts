import { Router, Response } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { AnalysisCache } from '../models/AnalysisCache';
import { CleanupSession } from '../models/CleanupSession';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/rules
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({ rules: req.user.preferences.cleanupRules || [] });
});

// POST /api/rules
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, conditions, action, labelName } = req.body;
    
    if (!name || !conditions || !action) {
      return res.status(400).json({ error: 'name, conditions, and action are required' });
    }
    
    const newRule = {
      id: uuidv4(),
      name,
      isActive: true,
      conditions,
      action,
      labelName,
      emailsProcessed: 0,
      createdAt: new Date(),
    };
    
    await User.findByIdAndUpdate(req.userId, {
      $push: { 'preferences.cleanupRules': newRule },
    });
    
    res.status(201).json({ rule: newRule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PUT /api/rules/:id
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, conditions, action, isActive, labelName } = req.body;
    
    await User.findOneAndUpdate(
      { _id: req.userId, 'preferences.cleanupRules.id': req.params.id },
      {
        $set: {
          'preferences.cleanupRules.$.name': name,
          'preferences.cleanupRules.$.conditions': conditions,
          'preferences.cleanupRules.$.action': action,
          'preferences.cleanupRules.$.isActive': isActive,
          'preferences.cleanupRules.$.labelName': labelName,
        },
      }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /api/rules/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { 'preferences.cleanupRules': { id: req.params.id } },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// POST /api/rules/:id/run - Dry run or execute a rule
router.post('/:id/run', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { dryRun = true } = req.body;
    const user = req.user;
    const rule = user.preferences.cleanupRules?.find((r: any) => r.id === req.params.id);
    
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    // Filter candidates by rule conditions
    let candidates = cache.cleanupCandidates.filter(c => !c.isProtected);
    
    if (rule.conditions.category?.length) {
      candidates = candidates.filter(c => rule.conditions.category.includes(c.category));
    }
    
    if (rule.conditions.olderThanDays) {
      const cutoff = new Date(Date.now() - rule.conditions.olderThanDays * 24 * 60 * 60 * 1000);
      candidates = candidates.filter(c => new Date(c.date) < cutoff);
    }
    
    if (rule.conditions.sizeGreaterThan) {
      candidates = candidates.filter(c => c.size > rule.conditions.sizeGreaterThan);
    }
    
    if (rule.conditions.senderPattern) {
      const pattern = new RegExp(rule.conditions.senderPattern, 'i');
      candidates = candidates.filter(c => pattern.test(c.sender));
    }
    
    const totalSize = candidates.reduce((sum, c) => sum + c.size, 0);
    
    if (dryRun) {
      return res.json({
        dryRun: true,
        emailsAffected: candidates.length,
        storageToRecover: totalSize,
        sample: candidates.slice(0, 5).map(c => ({ subject: c.subject, sender: c.sender, size: c.size })),
      });
    }
    
    // Execute
    const gmail = google.gmail({ version: 'v1', auth: req.oauth2Client });
    const ids = candidates.map(c => c.messageId);
    const BATCH_SIZE = 50;
    
    const session = await CleanupSession.create({
      userId: req.userId,
      status: 'in_progress',
      triggeredBy: 'rule',
      ruleId: rule.id,
    });
    
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      
      if (rule.action === 'archive') {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: { ids: batch, removeLabelIds: ['INBOX'] },
        });
      } else if (rule.action === 'delete') {
        await gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: { ids: batch, addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
        });
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    await CleanupSession.findByIdAndUpdate(session._id, {
      status: 'completed',
      completedAt: new Date(),
      deletedMessageIds: rule.action === 'delete' ? ids : [],
      archivedMessageIds: rule.action === 'archive' ? ids : [],
      'summary.emailsDeleted': rule.action === 'delete' ? ids.length : 0,
      'summary.emailsArchived': rule.action === 'archive' ? ids.length : 0,
      'summary.storageRecovered': totalSize,
    });
    
    await User.findOneAndUpdate(
      { _id: req.userId, 'preferences.cleanupRules.id': rule.id },
      {
        $set: {
          'preferences.cleanupRules.$.lastRunAt': new Date(),
          'preferences.cleanupRules.$.emailsProcessed': rule.emailsProcessed + ids.length,
        },
        $inc: { 'stats.totalStorageSaved': totalSize },
      }
    );
    
    res.json({
      success: true,
      sessionId: session._id,
      emailsProcessed: ids.length,
      storageRecovered: totalSize,
    });
  } catch (err) {
    logger.error('Rule run error:', err);
    res.status(500).json({ error: 'Rule execution failed' });
  }
});

export default router;
