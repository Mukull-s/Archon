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

  // ──────────────────────────────────────────────
  // 1. Security Middleware
  // ──────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,                 // Allow cookies for JWT
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ──────────────────────────────────────────────
  // 2. Rate Limiting
  // ──────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,          // 15 minutes
    max: env.NODE_ENV === 'development' ? 1000 : 100,
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
