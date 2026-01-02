import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    telegramAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
