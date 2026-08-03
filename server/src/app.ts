import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config';
import { errorHandler, notFoundHandler } from './middlewares';
import apiRoutes from './routes';


 
export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  app.set('etag', false);


  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,       
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

 
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

 
  app.use('/api', apiRoutes);

  
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
