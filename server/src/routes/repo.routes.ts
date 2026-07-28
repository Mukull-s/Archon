import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { repoController } from '../controllers';
import multer from 'multer';
import os from 'os';
import rateLimit from 'express-rate-limit';

const router = Router();

// Configure multer for temp file uploads
const upload = multer({ dest: os.tmpdir() });

// Rate limiter for heavy operations (max 10 requests per 15 minutes)
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { message: 'Too many resource-intensive operations. Please try again in 15 minutes.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Repository routes — Ingestion & engineering analysis.
 */

// Scan/Ingest endpoints
router.post('/scan-url', requireAuth, heavyLimiter, repoController.scanPublicRepo);
router.post('/scan-upload', requireAuth, heavyLimiter, upload.single('file'), repoController.scanLocalZip);

// Management & details endpoints
router.get('/', requireAuth, repoController.listUserRepos);
router.get('/:id', requireAuth, repoController.getRepoDetails);

// Analysis endpoints
router.post('/:id/impact', requireAuth, heavyLimiter, repoController.analyzeImpact);
router.post('/:id/index', requireAuth, heavyLimiter, repoController.buildVectorIndex);
router.post('/:id/chat', requireAuth, heavyLimiter, repoController.chatWithRepo);
router.post('/:id/chat/stream', requireAuth, heavyLimiter, repoController.chatWithRepoStream);
router.get('/:id/chat/history', requireAuth, repoController.getChatHistory);
router.get('/:id/insights', requireAuth, repoController.getRepoInsights);
router.get('/:id/story', requireAuth, repoController.getRepoStory);
router.get('/:id/onboarding', requireAuth, repoController.getRepoOnboarding);

export default router;
