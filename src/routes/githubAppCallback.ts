import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';

/**
 * GitHub App callback endpoint.
 *
 * IMPORTANT: In your GitHub App settings, set the Callback URL / Setup URL to:
 *   https://<PUBLIC_APP_URL>/github/app/callback
 *
 * We bind an installation to a Project using the `state` query param.
 */
export default async function githubAppCallbackRoutes(app: FastifyInstance) {
  app.get('/github/app/callback', async (req, reply) => {
    const q: any = req.query || {};
    const installationId = Number(q.installation_id);
    const state = String(q.state || '');

    if (!Number.isFinite(installationId) || installationId <= 0) {
      return reply.code(400).type('text/html; charset=utf-8').send('<h3>Invalid installation_id</h3>');
    }
    if (!Types.ObjectId.isValid(state)) {
      return reply.code(400).type('text/html; charset=utf-8').send('<h3>Invalid state</h3>');
    }

    const projectId = new Types.ObjectId(state);
    await ProjectModel.updateOne(
      { _id: projectId },
      {
        $set: {
          'github.installationId': installationId,
          'github.updatedAt': new Date(),
        },
      },
    );

    return reply
      .type('text/html; charset=utf-8')
      .send(
        '<div style="font-family:system-ui;padding:24px"><h2>✅ GitHub App installed.</h2><p>Return to Telegram and press Refresh.</p></div>',
      );
  });
}
