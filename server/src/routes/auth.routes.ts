import { Router } from 'express';
import { signup, login, getOAuthUrl, oauthCallback, verifyEmail, getMe, logout, updateProfile, changePassword, verifyEmailToken, getUsage, upgradePlan, getPlans } from '../controllers';
import { requireAuth } from '../middlewares';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for authentication routes (max 20 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: { message: 'Too many authentication attempts. Please try again in 15 minutes.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Auth Routes — Full authentication & entitlement system.
 *
 * POST  /api/auth/signup              → Email + password signup
 * POST  /api/auth/login               → Email + password login
 * GET   /api/auth/oauth/url?provider= → Get OAuth redirect URL
 * POST  /api/auth/oauth/callback      → Exchange OAuth code for JWT
 * POST  /api/auth/verify              → Email verification with OTP
 * GET   /api/auth/verify/:token       → Email verification with token link
 * GET   /api/auth/me                  → Get current user (protected)
 * GET   /api/auth/usage               → Get entitlement usage & limits (protected)
 * POST  /api/auth/upgrade             → Update plan tier (protected)
 * GET   /api/auth/plans               → Public plan tier metadata
 * POST  /api/auth/logout              → Logout (protected)
 * PATCH /api/auth/profile             → Update name/avatar (protected)
 * POST  /api/auth/change-password     → Change password (protected)
 */
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/oauth/url', getOAuthUrl);
router.post('/oauth/callback', oauthCallback);
router.post('/verify', verifyEmail);
router.get('/verify/:token', verifyEmailToken);
router.get('/me', requireAuth, getMe);
router.get('/usage', requireAuth, getUsage);
router.post('/upgrade', requireAuth, upgradePlan);
router.get('/plans', getPlans);
router.post('/logout', requireAuth, logout);
router.patch('/profile', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);

export default router;
