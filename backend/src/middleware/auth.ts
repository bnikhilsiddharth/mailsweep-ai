import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { decrypt } from '../utils/encryption';
import { google } from 'googleapis';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
  oauth2Client?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  try {
    const user = await User.findById(session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found. Please sign in again.' });
    }

    // Set up OAuth2 client with decrypted tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: decrypt(user.oauth.accessToken),
      refresh_token: decrypt(user.oauth.refreshToken),
    });

    // Auto-refresh token if expired
    if (user.oauth.expiresAt < new Date()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        user.oauth.accessToken = require('../utils/encryption').encrypt(credentials.access_token || '');
        user.oauth.expiresAt = new Date(credentials.expiry_date || Date.now() + 3600000);
        await user.save();
        oauth2Client.setCredentials(credentials);
      } catch (refreshError) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
      }
    }

    req.userId = (user._id as any).toString();
    req.user = user;
    req.oauth2Client = oauth2Client;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error.' });
  }
};
