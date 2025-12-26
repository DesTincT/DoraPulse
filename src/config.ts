import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().transform((val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) throw new Error('PORT must be a positive integer');
    return num;
  }),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  GITHUB_WEBHOOK_VALIDATE: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : ['true', '1', 'yes'].includes(val.toLowerCase()))),
  VALIDATE_WEBHOOK: z
    .string()
    .default('true')
    .transform((val) => ['true', '1', 'yes'].includes(val.toLowerCase())),
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  PUBLIC_APP_URL: z.string().url('PUBLIC_APP_URL must be a valid URL'),
  PAK_SALT: z.string().min(1, 'PAK_SALT is required'),
  TIMEZONE: z.string().min(1, 'TIMEZONE is required'),
  GITHUB_API_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
});

const parsedEnv = configSchema.safeParse({
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  GITHUB_WEBHOOK_VALIDATE: process.env.GITHUB_WEBHOOK_VALIDATE,
  VALIDATE_WEBHOOK: process.env.VALIDATE_WEBHOOK ?? 'true',
  BOT_TOKEN: process.env.BOT_TOKEN,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  PAK_SALT: process.env.PAK_SALT,
  TIMEZONE: process.env.TIMEZONE,
  GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
});

if (!parsedEnv.success) {
  console.error('Invalid configuration:', parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsedEnv.data.PORT,
  mongoUri: parsedEnv.data.MONGO_URI,
  webhookSecret: parsedEnv.data.WEBHOOK_SECRET,
  validateWebhook: parsedEnv.data.GITHUB_WEBHOOK_VALIDATE ?? parsedEnv.data.VALIDATE_WEBHOOK,
  botToken: parsedEnv.data.BOT_TOKEN,
  publicAppUrl: parsedEnv.data.PUBLIC_APP_URL,
  pakSalt: parsedEnv.data.PAK_SALT,
  timezone: parsedEnv.data.TIMEZONE,
  githubApiToken: parsedEnv.data.GITHUB_API_TOKEN,
  githubToken: parsedEnv.data.GITHUB_TOKEN,
};
