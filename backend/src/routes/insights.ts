import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AnalysisCache } from '../models/AnalysisCache';
import { WeeklyReport } from '../models/WeeklyReport';
import { StorageSnapshot } from '../models/StorageSnapshot';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/insights/contacts - Communication patterns
router.get('/contacts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.json({ needsSync: true, contacts: [] });
    
    const contacts = cache.topSenders
      .filter(s => !s.isSubscription && s.category === 'personal')
      .slice(0, 20)
      .map(s => ({
        email: s.email,
        name: s.name,
        emailCount: s.count,
        totalSize: s.totalSize,
        category: s.category,
        trustScore: Math.min(100, Math.round((s.count / Math.max(...cache.topSenders.map(x => x.count), 1)) * 100)),
        isFrequent: s.count > 5,
      }));
    
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get contact data' });
  }
});

// GET /api/insights/weekly - Latest weekly report
router.get('/weekly', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const report = await WeeklyReport.findOne({ userId: req.userId }).sort({ weekOf: -1 });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get weekly report' });
  }
});

// POST /api/insights/weekly/generate - Generate AI weekly report
router.post('/weekly/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    if (!cache) return res.status(400).json({ error: 'Run analysis first' });
    
    const user = req.user;
    
    // Build context for AI
    const context = {
      storageUsed: `${(cache.storageStats.totalUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      storageCapacity: `${(cache.storageStats.totalCapacity / (1024 * 1024 * 1024)).toFixed(0)} GB`,
      percentUsed: cache.storageStats.percentUsed.toFixed(1),
      inboxHealthScore: cache.inboxHealthScore,
      totalEmails: cache.emailCount.total,
      newsletters: cache.emailCount.newsletters,
      promotions: cache.emailCount.promotions,
      spam: cache.emailCount.spam,
      withAttachments: cache.emailCount.withAttachments,
      topClutterSource: cache.topSenders[0]?.name || 'Unknown',
      cleanupCandidates: cache.cleanupCandidates.length,
      subscriptions: cache.subscriptions.length,
    };
    
    const prompt = `You are an AI email assistant. Generate a concise weekly inbox intelligence report based on these stats:

${JSON.stringify(context, null, 2)}

Generate exactly:
1. 4 specific AI insights (each 1-2 sentences, specific and actionable)
2. 3 specific recommendations (each starting with an action verb, specific to the data)

Format as JSON:
{
  "insights": ["...", "...", "...", "..."],
  "recommendations": ["...", "...", "..."]
}

Be specific with numbers. Don't be generic. Sound like an expert email analyst.`;

    let aiInsights = ['Your inbox is growing steadily. Regular cleanup is recommended.'];
    let recommendations = ['Consider cleaning promotional emails older than 90 days.'];
    
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-20240307',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        });
        
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiInsights = parsed.insights || aiInsights;
          recommendations = parsed.recommendations || recommendations;
        }
      } catch (aiErr) {
        logger.warn('AI generation failed, using defaults:', aiErr);
      }
    }
    
    const weekOf = new Date();
    weekOf.setDate(weekOf.getDate() - weekOf.getDay()); // Start of current week
    
    const report = await WeeklyReport.findOneAndUpdate(
      { userId: req.userId, weekOf },
      {
        userId: req.userId,
        weekOf,
        generatedAt: new Date(),
        metrics: {
          storageSaved: user.stats.totalStorageSaved || 0,
          emailsCleaned: user.stats.totalEmailsAnalyzed || 0,
          inboxHealthDelta: 0,
          newSubscriptionsDetected: cache.subscriptions.length,
          topClutterSource: cache.topSenders[0]?.name || 'Promotions',
          storageGrowth: 0,
          cleanupEfficiency: cache.cleanupCandidates.length > 0 ? 
            Math.round((1 - cache.cleanupCandidates.length / Math.max(cache.emailCount.total, 1)) * 100) : 100,
        },
        aiInsights,
        recommendations,
        storageSnapshot: {
          start: cache.storageStats.totalUsed,
          end: cache.storageStats.totalUsed,
          capacity: cache.storageStats.totalCapacity,
        },
      },
      { upsert: true, new: true }
    );
    
    res.json({ report });
  } catch (err) {
    logger.error('Weekly report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/insights/copilot - AI Storage Copilot chat
router.post('/copilot', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    
    const cache = await AnalysisCache.findOne({ userId: req.userId }).sort({ analyzedAt: -1 });
    
    const systemPrompt = `You are MailSweep AI Copilot, an expert email storage assistant. 
    
The user's inbox data:
${cache ? JSON.stringify({
  storageUsed: `${(cache.storageStats.totalUsed / (1024*1024*1024)).toFixed(2)} GB of ${(cache.storageStats.totalCapacity / (1024*1024*1024)).toFixed(0)} GB`,
  percentUsed: `${cache.storageStats.percentUsed.toFixed(1)}%`,
  healthScore: cache.inboxHealthScore,
  totalEmails: cache.emailCount.total,
  cleanupCandidates: cache.cleanupCandidates.length,
  newsletterCount: cache.emailCount.newsletters,
  promotionCount: cache.emailCount.promotions,
  subscriptions: cache.subscriptions.length,
  topSenders: cache.topSenders.slice(0, 5).map(s => `${s.name} (${s.count} emails, ${(s.totalSize/1024/1024).toFixed(1)}MB)`),
  largestAttachment: cache.topAttachments[0] ? `${cache.topAttachments[0].filename} (${(cache.topAttachments[0].size/1024/1024).toFixed(1)}MB)` : 'none',
}, null, 2) : 'No analysis data yet. Tell the user to run an analysis first.'}

Answer questions about their inbox. Be specific with data. Keep answers concise (2-3 sentences max unless detail is needed). 
For action requests, describe what would happen but note the user needs to use the UI to execute actions.`;

    const messages = [
      ...history.slice(-10).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message }
    ];
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ 
        reply: "AI Copilot requires an Anthropic API key. Add ANTHROPIC_API_KEY to your .env file to enable this feature.",
        needsApiKey: true,
      });
    }
    
    const response = await anthropic.messages.create({
      model: 'claude-haiku-20240307',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });
    
    const reply = response.content[0].type === 'text' ? response.content[0].text : 'I could not generate a response.';
    
    res.json({ reply });
  } catch (err) {
    logger.error('Copilot error:', err);
    res.status(500).json({ error: 'Copilot failed to respond' });
  }
});

// GET /api/insights/trends
router.get('/trends', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const snapshots = await StorageSnapshot.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(60);
    
    res.json({ 
      snapshots: snapshots.reverse().map(s => ({
        date: s.date,
        totalUsed: s.totalUsed,
        totalCapacity: s.totalCapacity,
        percentUsed: s.percentUsed,
        breakdown: s.breakdown,
      })) 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

export default router;
