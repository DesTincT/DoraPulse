import 'fastify';
import type { FastifyReply } from 'fastify';

declare module 'fastify' {
  export interface AuthedProjectContext {
    projectId: string;
    chatId: number;
    accessKey?: string;
    devBypass: boolean;
    github: {
      installed: boolean;
      installationId?: number;
      accountLogin?: string;
    };
    settings: {
      prodEnvironments: string[];
    };
  }

  interface FastifyInstance {
    telegramAuth: (req: import('fastify').FastifyRequest, reply: FastifyReply) => Promise<void>;
    telegramAuthOptional: (req: import('fastify').FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    rawBody?: Buffer;
    devBypass?: boolean;
    project?: AuthedProjectContext;
    telegramInitDataInfo?: {
      len: number;
      userId?: number;
      chatId?: number;
    };
    telegramAuthError?: {
      reason: string;
      message: string;
    };
  }
}
