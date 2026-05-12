import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import repoRoutes from './repo.routes';

const router = Router();

/**
 * Health check endpoint.
 * Used by uptime monitors, load balancers, and deployment platforms
 * to verify the server is alive and responsive.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'archon-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
    },
  });
});

// Mount route groups
router.use('/auth', authRoutes);
router.use('/repos', repoRoutes);

export default router;
