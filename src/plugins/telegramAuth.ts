import fp from 'fastify-plugin';
import { telegramAuth, telegramAuthOptional } from '../middleware/telegramAuth.js';

/**
 * Registers `fastify.telegramAuth` preHandler.
 *
 * The underlying middleware implements a DEV-only Telegram bypass when:
 * - NODE_ENV !== "production"
 * - DORA_DEV_BYPASS_TELEGRAM_AUTH=true
 */
export default fp(async (app) => {
  app.decorate('telegramAuth', telegramAuth);
  app.decorate('telegramAuthOptional', telegramAuthOptional);
});
