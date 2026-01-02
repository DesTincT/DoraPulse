import { FastifyInstance } from 'fastify';
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

    // MVP: state is the Project accessKey (PAK-like stable key)
    const project = await ProjectModel.findOne({ accessKey: state });
    if (!project?._id) {
      return reply.code(404).type('text/html; charset=utf-8').send('<h3>Unknown project</h3>');
    }

    await ProjectModel.updateOne(
      { _id: project._id },
      {
        $set: {
          'settings.github.installationId': installationId,
          'settings.github.updatedAt': new Date(),
          // keep legacy location for backwards compatibility
          'github.installationId': installationId,
          'github.updatedAt': new Date(),
        },
      },
    );

    const html = `
      <div style="font-family:system-ui;padding:24px">
        <h2>✅ GitHub App installed.</h2>
        <p>You can return to Telegram and press Refresh.</p>
        <p style="opacity:.6;font-size:12px">setup_action=${setupAction || 'n/a'}</p>
      </div>
      <script>
        try { window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.close && window.Telegram.WebApp.close(); } catch {}
      </script>
    `;
    return reply.type('text/html; charset=utf-8').send(html);
  }

  // New canonical endpoint (GitHub App "Setup URL")
  app.get('/github/app/setup', handleSetup);

  // Backwards compatibility (older deployments)
  app.get('/github/app/callback', handleSetup);
}
