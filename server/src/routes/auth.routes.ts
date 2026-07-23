import { Router } from 'express';
import { signup, login, getOAuthUrl, oauthCallback, verifyEmail, getMe, logout, updateProfile, changePassword } from '../controllers';
import { requireAuth } from '../middlewares';

const router = Router();

/**
 * Auth Routes — Full authentication system.
 *
 * POST  /api/auth/signup              → Email + password signup
 * POST  /api/auth/login               → Email + password login
 * GET   /api/auth/oauth/url?provider= → Get OAuth redirect URL
 * POST  /api/auth/oauth/callback      → Exchange OAuth code for JWT
 * POST  /api/auth/verify              → Email verification with OTP
 * GET   /api/auth/me                  → Get current user (protected)
 * POST  /api/auth/logout              → Logout (protected)
 * PATCH /api/auth/profile             → Update name/avatar (protected)
 * POST  /api/auth/change-password     → Change password (protected)
 */
router.post('/signup', signup);
router.post('/login', login);
router.get('/oauth/url', getOAuthUrl);
router.post('/oauth/callback', oauthCallback);
router.post('/verify', verifyEmail);
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);
router.patch('/profile', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);

export default router;
