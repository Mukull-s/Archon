import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { repoController } from '../controllers';
import multer from 'multer';
import os from 'os';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../utils';

const router = Router();

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
  'application/octet-stream',
]);

// Temp file uploads: bounded in size/count and restricted to ZIP archives.
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isZipName = /\.zip$/i.test(file.originalname || '');
    const isZipMime = ZIP_MIME_TYPES.has((file.mimetype || '').toLowerCase());
    if (isZipName || isZipMime) return cb(null, true);
    cb(new AppError('Only .zip archives are accepted.', 400, 'UNSUPPORTED_FILE_TYPE'));
  },
});

/**
 * Wraps multer so its errors surface as clean 400s instead of 500s
 * (e.g. the size limit, or a rejected file type).
 */
const uploadZip = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded ZIP exceeds the 15MB limit.'
        : `Upload rejected: ${err.message}`;
      return next(new AppError(message, 400, 'UPLOAD_REJECTED'));
    }
    next(err);
  });
};

export const userOrIpKeyGenerator = (req: any): string => {
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return `ip:${ipKeyGenerator(rawIp)}`;
};

// Rate limiter for heavy operations (max 10 requests per 15 minutes per user)
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    success: false,
    error: { message: 'Too many resource-intensive operations. Please try again in 15 minutes.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for interactive impact analysis (max 120 requests per 15 minutes per user)
const impactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    success: false,
    error: { message: 'Too many impact simulations. Please try again shortly.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Repository routes — Ingestion & engineering analysis.
 */

// Scan/Ingest endpoints
router.post('/scan-url', requireAuth, heavyLimiter, repoController.scanPublicRepo);
router.post('/scan-upload', requireAuth, heavyLimiter, uploadZip, repoController.scanLocalZip);

// Management & details endpoints
router.get('/', requireAuth, repoController.listUserRepos);
router.get('/:id', requireAuth, repoController.getRepoDetails);
router.delete('/:id', requireAuth, repoController.deleteRepo);
router.post('/:id/archive', requireAuth, repoController.archiveRepo);
router.post('/:id/unarchive', requireAuth, repoController.unarchiveRepo);
router.post('/:id/summary', requireAuth, heavyLimiter, repoController.generateRepoSummaryEndpoint);

// Analysis endpoints
router.post('/:id/impact', requireAuth, impactLimiter, repoController.analyzeImpact);
router.post('/:id/index', requireAuth, heavyLimiter, repoController.buildVectorIndex);
router.post('/:id/chat', requireAuth, impactLimiter, repoController.chatWithRepo);
router.post('/:id/chat/stream', requireAuth, impactLimiter, repoController.chatWithRepoStream);
router.get('/:id/chat/history', requireAuth, repoController.getChatHistory);
router.get('/:id/insights', requireAuth, repoController.getRepoInsights);
router.get('/:id/story', requireAuth, repoController.getRepoStory);
router.get('/:id/onboarding', requireAuth, repoController.getRepoOnboarding);

export default router;
