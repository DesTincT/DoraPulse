import { FastifyInstance } from 'fastify';
import { ProjectModel } from '../models/Project.js';
import { verifyGithubInstallState } from '../services/githubInstallState.js';

/**
 * GitHub App callback endpoint.
 *
 * IMPORTANT: In your GitHub App settings, set the Callback URL / Setup URL to:
 *   https://<PUBLIC_APP_URL>/github/app/callback
 *
 * We bind an installation to a Project using the `state` query param.
 */
export default async function githubAppCallbackRoutes(app: FastifyInstance) {
  async function handleSetup(req: any, reply: any) {
    const q: any = req.query || {};
    const installationId = Number(q.installation_id);
    const state = String(q.state || '');
    const setupAction = String(q.setup_action || '');

    if (!Number.isFinite(installationId) || installationId <= 0) {
      return reply.code(400).type('text/html; charset=utf-8').send('<h3>Invalid installation_id</h3>');
    }
    if (!state) {
      return reply.code(400).type('text/html; charset=utf-8').send('<h3>Missing state</h3>');
    }

    // Prefer signed state token (projectId + chatId); keep legacy accessKey fallback.
    let project: any = null;
    const verified = verifyGithubInstallState(state);
    if (verified.ok) {
      project = await ProjectModel.findOne({ _id: verified.payload.projectId, chatId: verified.payload.chatId });
    } else {
      project = await ProjectModel.findOne({ accessKey: state });
    }
    if (!project?._id) {
      return reply.code(404).type('text/html; charset=utf-8').send('<h3>Unknown project</h3>');
    }

    try {
      req.log.info(
        {
          installationId,
          setupAction: setupAction || 'n/a',
          stateKind: verified.ok ? 'signed' : 'legacy',
          stateVerify: verified.ok ? undefined : verified.reason,
          projectId: String(project._id),
          chatId: project.chatId,
        },
        'github app setup callback',
      );
    } catch {}

    await ProjectModel.updateOne(
      { _id: project._id },
      {
        $set: {
          githubInstallationId: installationId,
          githubInstalledAt: new Date(),
          'settings.github.installationId': installationId,
          'settings.github.updatedAt': new Date(),
          // keep legacy location for backwards compatibility
          'github.installationId': installationId,
          'github.updatedAt': new Date(),
        },
      },
    );

    // Return user back to the Mini App (200 page). Avoid sending users to a blank callback page.
    return reply.redirect('/webapp/', 302);
  }

  // New canonical endpoint (GitHub App "Setup URL")
  app.get('/github/app/setup', handleSetup);

  // Backwards compatibility (older deployments)
  app.get('/github/app/callback', handleSetup);
}
