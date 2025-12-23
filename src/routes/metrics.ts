import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getWeekly } from '../services/metricsService.js';
import { Types } from 'mongoose';
import { getLastIsoWeek } from '../utils.js';

export default async function (fastify: FastifyInstance) {
  fastify.get('/projects/:id/metrics/weekly', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as any).id;
    let week = (request.query as any).week;
    if (!week) {
      week = getLastIsoWeek();
    }
    let projectId: Types.ObjectId | string;
    try {
      projectId = Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
    } catch {
      return reply.code(400).send({ error: 'Invalid project id' });
    }

    try {
      const result = await getWeekly(projectId, week);
      return reply.send(result);
    } catch (e: any) {
      return reply.code(500).send({ error: e.message || 'Failed to get metrics' });
    }
  });
}
