import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { User } from '../models/User';
import { encrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

const getOAuth2Client = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// GET /api/auth/google - Initiate OAuth
router.get('/google', authRateLimit, (req: Request, res: Response) => {
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
  });
  res.json({ authUrl });
});

// GET /api/auth/google/callback - OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  
  if (error) {
    logger.warn(`OAuth error: ${error}`);
    return res.redirect(`${process.env.FRONTEND_URL}/?error=oauth_denied`);
  }
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=no_code`);
  }
  
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    const { id, email, name, picture } = userInfo.data;
    
    if (!id || !email) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=no_user_info`);
    }
    
    // Upsert user
    const user = await User.findOneAndUpdate(
      { googleId: id },
      {
        googleId: id,
        email,
        name: name || email.split('@')[0],
        avatar: picture || '',
        oauth: {
          accessToken: encrypt(tokens.access_token || ''),
          refreshToken: encrypt(tokens.refresh_token || ''),
          expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
          scopes: tokens.scope?.split(' ') || SCOPES,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    // Set session
    (req.session as any).userId = user._id.toString();
    
    logger.info(`User ${email} signed in successfully`);
    
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    logger.error('OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/?error=auth_failed`);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req: Request, res: Response) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const user = await User.findById(session.userId).select('-oauth');
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      preferences: user.preferences,
      stats: user.stats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// DELETE /api/auth/logout
router.delete('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// DELETE /api/auth/revoke - Full account deletion
router.delete('/revoke', async (req: Request, res: Response) => {
  const session = req.session as any;
  if (!session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const user = await User.findById(session.userId);
    if (user) {
      // Revoke Google token
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(require('../utils/encryption').decrypt(user.oauth.accessToken));
      } catch (e) { /* ignore revocation errors */ }
      
      await User.findByIdAndDelete(session.userId);
    }
    
    req.session.destroy(() => {});
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
