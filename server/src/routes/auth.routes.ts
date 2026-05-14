import { Router } from 'express';
import { githubLogin, githubCallback, getMe, logout } from '../controllers';
import { requireAuth } from '../middlewares';

const router = Router();

/**
 * Auth routes — GitHub OAuth flow.
 * 
 * GET  /api/auth/github           → Returns GitHub consent screen URL
 * POST /api/auth/github/callback  → Exchange code for JWT + user
 * GET  /api/auth/me               → Get current user (requires auth)
 * POST /api/auth/logout           → Clear session
 */
router.get('/github', githubLogin);
router.post('/github/callback', githubCallback);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
