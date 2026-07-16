import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { FocusConfig, getConfig } from './config.js';
import { runOrchestratorForUser } from './orchestrator.js';

const prisma = new PrismaClient();

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  userId?: string;
  userTag?: string;
}

/**
 * Express Middleware to authenticate JWT in cookies
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies.ff_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. No session found.' });
  }

  const jwtSecret = getConfig().JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET not set.' });
  }

  jwt.verify(token, jwtSecret, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden. Invalid session.' });
    }
    req.userId = decoded.userId;
    req.userTag = decoded.userTag;
    next();
  });
}

/**
 * Boots the Express Server
 */
export function startWebServer(config: FocusConfig) {
  const app = express();
  app.set('trust proxy', true); // Trust proxy headers (e.g. from ngrok/load balancers)
  const PORT = process.env.PORT || 5000;

  const clientId = config.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const clientSecret = config.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET;

  // Middlewares
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Serve Frontend static files (built React app)
  const publicPath = path.join(process.cwd(), 'dist', 'web');
  app.use(express.static(publicPath));

  // --- API ROUTES ---

  /**
   * OAuth2 Discord Login Route
   */
  app.get('/api/auth/discord/login', (req: Request, res: Response) => {
    if (!clientId || clientId === 'YOUR_DISCORD_CLIENT_ID') {
      return res.status(400).json({ error: 'Discord Client ID is not configured.' });
    }

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http';
    const dynamicRedirectUri = `${protocol}://${host}/api/auth/discord/callback`;

    console.log(`[Web Server] Initiating Discord login redirect:`);
    console.log(`  - Target Redirect URI: ${dynamicRedirectUri}`);

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(dynamicRedirectUri)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
  });

  /**
   * OAuth2 Discord Callback Route
   */
  app.get('/api/auth/discord/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ error: 'No authorization code returned from Discord.' });
    }

    if (!clientId || !clientSecret || clientId === 'YOUR_DISCORD_CLIENT_ID' || clientSecret === 'YOUR_DISCORD_CLIENT_SECRET') {
      return res.status(500).json({ error: 'Discord Client ID or Client Secret is not configured on server.' });
    }

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http';
    const dynamicRedirectUri = `${protocol}://${host}/api/auth/discord/callback`;

    try {
      // 1. Exchange OAuth code for Access Token
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: dynamicRedirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // 2. Fetch User profile from Discord API
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const discordUser = userResponse.data; // { id: '...', username: '...', avatar: '...' }
      const discordId = discordUser.id;
      const discordUsername = discordUser.username;

      // 3. Upsert User in Prisma DB
      // Search for user by discordId or discordUsername
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { discordId },
            { discordUsername }
          ]
        }
      });

      if (user) {
        // Update user record with newest Discord ID and Username
        user = await prisma.user.update({
          where: { id: user.id },
          data: { discordId, discordUsername }
        });
      } else {
        // Create user with default interests and noise templates
        user = await prisma.user.create({
          data: {
            discordId,
            discordUsername,
            interests: `
- Announcements of major software versions (e.g. TypeScript, React, Rust, Go).
- In-depth architectural case studies or system designs from engineering teams (e.g. Figma, Netflix, GitHub).
- Critical security vulnerabilities (CVEs) affecting widely-used packages.
- Breakthrough AI research and open-source models.
            `.trim(),
            noise: `
- Entry-level tutorials, casual rants, listicles, or meme posts.
- Self-promotional bootcamps, paid course ads, or job postings.
- Speculative financial news, cryptocurrency updates, or politics.
            `.trim(),
            sources: {
              create: [
                { type: 'subreddit', value: 'typescript' },
                { type: 'subreddit', value: 'webdev' },
                { type: 'rss', value: 'https://news.ycombinator.com/rss' }
              ]
            }
          }
        });
      }

      // 4. Issue JWT token
      const jwtSecret = getConfig().JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET not set.' });
      }
      const sessionToken = jwt.sign(
        { userId: user.id, userTag: discordUsername },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // 5. Store in HTTP-only Cookie and redirect to dashboard
      res.cookie('ff_token', sessionToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      res.redirect('/');
    } catch (error: any) {
      console.error('[Web Server] OAuth callback error:', error.response?.data || error.message);
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  /**
   * Logout Route
   */
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.clearCookie('ff_token', { path: '/' });
    res.json({ success: true });
  });

  /**
   * Get Current Authenticated User profile
   */
  app.get('/api/user/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId as string },
        include: {
          profiles: true,
          sources: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Update User Interests and Noise Rules
   */
  app.post('/api/user/rules', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { interests, noise, frequency } = req.body;
    if (typeof interests !== 'string' || typeof noise !== 'string') {
      return res.status(400).json({ error: 'Interests and Noise guidelines are required.' });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: req.userId as string },
        data: {
          interests,
          noise,
          frequency: frequency || 'daily'
        }
      });
      res.json(updatedUser);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Link external platform username (GitHub, LeetCode, LinkedIn, etc.)
   */
  app.post('/api/user/profiles', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { platform, handle } = req.body;
    if (!platform || !handle) {
      return res.status(400).json({ error: 'Platform name and account handle are required.' });
    }

    let url = '';
    const cleanPlatform = platform.toLowerCase().trim();
    const cleanHandle = handle.trim();

    if (cleanPlatform === 'github') url = `https://github.com/${cleanHandle}`;
    else if (cleanPlatform === 'leetcode') url = `https://leetcode.com/${cleanHandle}/`;
    else if (cleanPlatform === 'twitter') url = `https://twitter.com/${cleanHandle}`;
    else if (cleanPlatform === 'linkedin') url = `https://linkedin.com/in/${cleanHandle}`;
    else url = `https://${cleanPlatform}.com/${cleanHandle}`;

    try {
      const newProfile = await prisma.profile.upsert({
        where: {
          userId_platform: {
            userId: req.userId!,
            platform: cleanPlatform
          }
        },
        update: { handle: cleanHandle, url },
        create: {
          userId: req.userId!,
          platform: cleanPlatform,
          handle: cleanHandle,
          url
        }
      });
      res.json(newProfile);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Delete linked profile
   */
  app.delete('/api/user/profiles/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      // Ensure the profile belongs to the authenticated user
      const profile = await prisma.profile.findFirst({
        where: { id: id as string, userId: req.userId as string }
      });

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found or access denied.' });
      }

      await prisma.profile.delete({ where: { id: id as string } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Add custom RSS or Subreddit source feed
   */
  app.post('/api/user/sources', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { type, value } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'Source type (rss/subreddit) and value are required.' });
    }

    const cleanType = type.toLowerCase().trim();
    let cleanValue = value.trim();

    if (cleanType === 'subreddit') {
      // Remove r/ prefix if present
      cleanValue = cleanValue.replace(/^r\//, '');
    }

    try {
      const newSource = await prisma.source.upsert({
        where: {
          userId_type_value: {
            userId: req.userId!,
            type: cleanType,
            value: cleanValue
          }
        },
        update: {},
        create: {
          userId: req.userId!,
          type: cleanType,
          value: cleanValue
        }
      });
      res.json(newSource);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Remove custom feed source
   */
  app.delete('/api/user/sources/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    try {
      const source = await prisma.source.findFirst({
        where: { id: id as string, userId: req.userId as string }
      });

      if (!source) {
        return res.status(404).json({ error: 'Source feed not found or access denied.' });
      }

      await prisma.source.delete({ where: { id: id as string } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Get Curations History
   */
  app.get('/api/curations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const curations = await prisma.curation.findMany({
        where: { userId: req.userId as string },
        include: { feedback: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(curations);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Delete Unrated Curation History
   */
  app.delete('/api/curations/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Delete curations that have no feedback linked to them
      const curationsToDelete = await prisma.curation.findMany({
        where: {
          userId: req.userId as string,
          feedback: null
        },
        select: { id: true }
      });

      const ids = curationsToDelete.map(c => c.id);

      if (ids.length > 0) {
        await prisma.curation.deleteMany({
          where: {
            id: { in: ids }
          }
        });
      }

      res.json({ success: true, count: ids.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Submit Curation Rating (Feedback)
   */
  app.post('/api/curations/:id/rate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { rating } = req.body;

    if (typeof rating !== 'number' || rating < 0 || rating > 10) {
      return res.status(400).json({ error: 'Rating must be a number between 0 and 10.' });
    }

    try {
      const curation = await prisma.curation.findFirst({
        where: { id: id as string, userId: req.userId as string }
      });

      if (!curation) {
        return res.status(404).json({ error: 'Curation card not found or access denied.' });
      }

      const feedback = await prisma.feedback.upsert({
        where: { curationId: id as string },
        update: { rating },
        create: {
          curationId: id as string,
          userId: req.userId as string,
          rating
        }
      });

      res.json(feedback);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Manually trigger a curation run cycle for user
   */
  app.post('/api/curations/trigger', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log(`[Web Server] User ${req.userTag} requested a manual curation run...`);
      await runOrchestratorForUser(req.userId!, config, false);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Web Server] Live curation run trigger failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Catch-all route to serve the SPA frontend
  app.get('*all', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 [FocusFlow Web Server] Running at: http://localhost:${PORT}`);
  });
}
