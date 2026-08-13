import { Router, Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AnalysisCache } from '../models/AnalysisCache';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/subscriptions
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.json({ needsSync: true, subscriptions: [] });
    
    res.json({ subscriptions: cache.subscriptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

// POST /api/subscriptions/:email/unsubscribe
router.post('/:encodedEmail/unsubscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const senderEmail = decodeURIComponent(req.params.encodedEmail);
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    const subscription = cache.subscriptions.find(s => s.email === senderEmail);
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    
    let unsubscribeMethod = 'unknown';
    
    // Try URL-based unsubscribe
    if (subscription.unsubscribeUrl) {
      try {
        await axios.get(subscription.unsubscribeUrl, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        unsubscribeMethod = 'url';
      } catch (e) {
        logger.warn(`URL unsubscribe failed for ${senderEmail}:`, e);
      }
    }
    
    // Try email-based unsubscribe
    if (subscription.unsubscribeEmail && unsubscribeMethod === 'unknown') {
      try {
        const gmail = google.gmail({ version: 'v1', auth: req.oauth2Client });
        
        const emailContent = [
          'From: me',
          `To: ${subscription.unsubscribeEmail}`,
          'Subject: Unsubscribe',
          'Content-Type: text/plain; charset=utf-8',
          '',
          'Please unsubscribe me from your mailing list.',
        ].join('\r\n');
        
        const encoded = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
        
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encoded },
        });
        
        unsubscribeMethod = 'email';
      } catch (e) {
        logger.warn(`Email unsubscribe failed for ${senderEmail}:`, e);
      }
    }
    
    res.json({
      success: unsubscribeMethod !== 'unknown',
      method: unsubscribeMethod,
      sender: senderEmail,
      message: unsubscribeMethod !== 'unknown' 
        ? `Unsubscribe request sent to ${senderEmail}` 
        : 'Could not automatically unsubscribe. Please unsubscribe manually.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Unsubscribe failed' });
  }
});

// POST /api/subscriptions/bulk-unsubscribe
router.post('/bulk-unsubscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }
    
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    const results = [];
    
    for (const email of emails.slice(0, 20)) { // Limit to 20 at once
      const subscription = cache.subscriptions.find(s => s.email === email);
      if (!subscription) continue;
      
      let success = false;
      
      if (subscription.unsubscribeUrl) {
        try {
          await axios.get(subscription.unsubscribeUrl, { timeout: 5000 });
          success = true;
        } catch (e) { /* continue */ }
      }
      
      if (!success && subscription.unsubscribeEmail) {
        try {
          const gmail = google.gmail({ version: 'v1', auth: req.oauth2Client });
          const emailContent = `From: me\r\nTo: ${subscription.unsubscribeEmail}\r\nSubject: Unsubscribe\r\n\r\nPlease unsubscribe me.`;
          const encoded = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
          success = true;
        } catch (e) { /* continue */ }
      }
      
      results.push({ email, success });
      await new Promise(r => setTimeout(r, 200)); // Rate limit
    }
    
    res.json({
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: 'Bulk unsubscribe failed' });
  }
});

export default router;
