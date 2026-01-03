import 'fastify';
import type { FastifyReply } from 'fastify';
import type { Project } from '../models/Project.js';

export interface DevProject {
  _id: string;
  name: string;
  accessKey?: string;
  github?: {
    installationId?: number;
    repos?: string[];
    [k: string]: unknown;
  };
  settings?: {
    prodRule: { branch: string; workflowNameRegex: string };
    ltBaseline: 'pr_open' | 'first_commit';
    prodEnvironments?: string[];
    github?: {
      installationId?: number;
      accountLogin?: string;
      accountType?: 'User' | 'Organization';
      repos?: string[];
      updatedAt?: Date;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export type ProjectRef = Project | DevProject;

declare module 'fastify' {
  interface FastifyInstance {
    telegramAuth: (req: import('fastify').FastifyRequest, reply: FastifyReply) => Promise<void>;
    telegramAuthOptional: (req: import('fastify').FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    rawBody?: Buffer;
    devBypass?: boolean;
    project?: ProjectRef;
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
