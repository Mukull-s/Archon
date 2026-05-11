import { z } from 'zod/v4';
import dotenv from 'dotenv';

// Load .env file before validation
dotenv.config();

/**
 * Environment variable schema — validated at startup.
 * If any required variable is missing, the server crashes immediately
 * with a clear error message instead of failing silently at runtime.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Frontend URL (for CORS + OAuth redirects)
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // AI APIs
  MINIMAX_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws a formatted error at boot if validation fails.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
