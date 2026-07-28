import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config';
import { errorHandler, notFoundHandler } from './middlewares';
import apiRoutes from './routes';

/**
 * Express Application Factory.
 * 
 * This pattern separates app creation from server listening,
 * making it testable (you can import the app without starting the server).
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy for rate limiting behind Render/Heroku load balancers
  app.set('trust proxy', 1);

  // ──────────────────────────────────────────────
  // 1. Security Middleware
  // ──────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'https://archondev.vercel.app',
        'https://www.archondev.vercel.app',
        env.CLIENT_URL
      ];

      const normalizedOrigins = allowedOrigins.map(o => o.replace(/\/$/, ''));
      const normalizedOrigin = origin.replace(/\/$/, '');

      if (normalizedOrigins.includes(normalizedOrigin) || normalizedOrigin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,                 // Allow cookies for JWT
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ──────────────────────────────────────────────
  // 2. Rate Limiting
  // ──────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,          // 15 minutes
    max: env.NODE_ENV === 'development' ? 200 : 100,
    message: {
      success: false,
      error: { message: 'Too many requests. Please try again later.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // ──────────────────────────────────────────────
  // 3. Body Parsing & Logging
  // ──────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // ──────────────────────────────────────────────
  // 4. API Routes
  // ──────────────────────────────────────────────
  app.use('/api', apiRoutes);

  // ──────────────────────────────────────────────
  // 5. Error Handling (must be LAST)
  // ──────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
