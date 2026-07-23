import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { repoController } from '../controllers';
import multer from 'multer';
import os from 'os';

const router = Router();

// Configure multer for temp file uploads
const upload = multer({ dest: os.tmpdir() });

/**
 * Repository routes — Ingestion & engineering analysis.
 */

// Scan/Ingest endpoints
router.post('/scan-url', requireAuth, repoController.scanPublicRepo);
router.post('/scan-upload', requireAuth, upload.single('file'), repoController.scanLocalZip);

// Management & details endpoints
router.get('/', requireAuth, repoController.listUserRepos);
router.get('/:id', requireAuth, repoController.getRepoDetails);

// Analysis endpoints
router.post('/:id/impact', requireAuth, repoController.analyzeImpact);
router.post('/:id/index', requireAuth, repoController.buildVectorIndex);
router.post('/:id/chat', requireAuth, repoController.chatWithRepo);
router.post('/:id/chat/stream', requireAuth, repoController.chatWithRepoStream);
router.get('/:id/chat/history', requireAuth, repoController.getChatHistory);
router.get('/:id/insights', requireAuth, repoController.getRepoInsights);
router.get('/:id/story', requireAuth, repoController.getRepoStory);
router.get('/:id/onboarding', requireAuth, repoController.getRepoOnboarding);

export default router;
