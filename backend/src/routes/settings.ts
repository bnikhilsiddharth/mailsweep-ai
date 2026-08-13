import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { AnalysisCache } from '../models/AnalysisCache';
import { CleanupSession } from '../models/CleanupSession';
import { StorageSnapshot } from '../models/StorageSnapshot';
import { WeeklyReport } from '../models/WeeklyReport';

const router = Router();

// GET /api/settings
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  res.json({
    protectedCategories: user.preferences.protectedCategories,
    protectedSenders: user.preferences.protectedSenders,
    notificationFrequency: user.preferences.notificationFrequency,
    theme: user.preferences.theme,
  });
});

// PUT /api/settings
router.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { protectedCategories, protectedSenders, notificationFrequency, theme } = req.body;
    
    const updateData: any = {};
    if (protectedCategories) updateData['preferences.protectedCategories'] = protectedCategories;
    if (protectedSenders !== undefined) updateData['preferences.protectedSenders'] = protectedSenders;
    if (notificationFrequency) updateData['preferences.notificationFrequency'] = notificationFrequency;
    if (theme) updateData['preferences.theme'] = theme;
    
    await User.findByIdAndUpdate(req.userId, { $set: updateData });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/protected-sender
router.post('/protected-sender', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { 'preferences.protectedSenders': email.toLowerCase() },
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add protected sender' });
  }
});

// DELETE /api/settings/protected-sender/:email
router.delete('/protected-sender/:email', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { 'preferences.protectedSenders': req.params.email },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove protected sender' });
  }
});

// DELETE /api/settings/data - Delete all user data (GDPR)
router.delete('/data', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    await Promise.all([
      AnalysisCache.deleteMany({ userId }),
      CleanupSession.deleteMany({ userId }),
      StorageSnapshot.deleteMany({ userId }),
      WeeklyReport.deleteMany({ userId }),
    ]);
    
    res.json({ success: true, message: 'All analysis data deleted. Your Gmail account is not affected.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

export default router;
