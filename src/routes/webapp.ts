import { FastifyInstance } from 'fastify';
import { telegramAuth } from '../middleware/telegramAuth.js';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { EventModel } from '../models/Event.js';
import { getWeekly } from '../services/metricsService.js';
import { getLastIsoWeek } from '../utils.js';

export default async function webappRoutes(app: FastifyInstance) {
  // Serve a lightweight React Mini App via CDN (Tailwind + DaisyUI)
  app.get('/webapp', async (_req, reply) => {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Dora Pulse</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css" rel="stylesheet" type="text/css" />
  </head>
  <body class="bg-base-200">
    <div id="app" class="container mx-auto p-4"></div>
    <script type="module">
      import React, { useEffect, useState } from 'https://esm.sh/react@18';
      import ReactDOM from 'https://esm.sh/react-dom@18/client';

      const tg = window.Telegram?.WebApp;
      const initData = tg?.initData || '';

      function TabButton({active, onClick, children}) {
        return React.createElement('button', { className: 'btn ' + (active ? 'btn-primary' : ''), onClick }, children);
      }

      function App() {
        const [tab, setTab] = useState('connect');
        const [me, setMe] = useState(null);
        const [verify, setVerify] = useState(null);
        const [envs, setEnvs] = useState({ seenEnvs: [], selected: [] });

        async function api(path, opts={}) {
          const res = await fetch(path, {
            ...opts,
            headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData }
          });
          return await res.json();
        }

        useEffect(() => {
          api('/api/me').then(setMe).catch(()=>{});
        }, []);

        const connect = React.createElement('div', { className: 'card bg-base-100 shadow p-4' },
          React.createElement('h2', { className: 'card-title' }, 'Connect GitHub App'),
          React.createElement('p', null, me?.github?.installationId ? 'Installed ✓' : 'Not installed'),
          React.createElement('div', { className: 'mt-2' },
            React.createElement('a', { className: 'btn btn-primary', href: me?.githubInstallUrl, target: '_blank' }, 'Install GitHub App')
          )
        );

        const verifyView = React.createElement('div', { className: 'card bg-base-100 shadow p-4' },
          React.createElement('h2', { className: 'card-title' }, 'Self-Test'),
          React.createElement('p', null, verify ? JSON.stringify(verify) : 'Run self-test to verify events and metrics.'),
          React.createElement('button', { className: 'btn mt-2', onClick: async () => { const r = await api('/api/selftest', { method: 'POST' }); setVerify(r); } }, 'Run self-test'),
        );

        const envView = React.createElement('div', { className: 'card bg-base-100 shadow p-4' },
          React.createElement('h2', { className: 'card-title' }, 'Production Environments'),
          React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
            ...(envs?.seenEnvs || []).map(env =>
              React.createElement('label', { className: 'label cursor-pointer gap-2', key: env },
                React.createElement('input', {
                  type: 'checkbox',
                  className: 'checkbox',
                  checked: envs.selected?.includes(env),
                  onChange: (e) => {
                    const sel = new Set(envs.selected || []);
                    if (e.target.checked) sel.add(env); else sel.delete(env);
                    setEnvs({ ...envs, selected: Array.from(sel) });
                  }
                }),
                React.createElement('span', { className: 'label-text' }, env)
              )
            )
          ),
          React.createElement('div', { className: 'mt-3 flex gap-2' },
            React.createElement('button', { className: 'btn', onClick: async () => {
              const r = await api('/api/envs');
              setEnvs(r);
            } }, 'Reload'),
            React.createElement('button', { className: 'btn btn-primary', onClick: async () => {
              await api('/api/envs', { method: 'POST', body: JSON.stringify({ selected: envs.selected || [] }) });
            } }, 'Save')
          )
        );

        const tabs = React.createElement('div', { className: 'tabs tabs-boxed mb-4' },
          React.createElement('a', { className: 'tab ' + (tab==='connect'?'tab-active':''), onClick:()=>setTab('connect') }, 'Connect'),
          React.createElement('a', { className: 'tab ' + (tab==='verify'?'tab-active':''), onClick:()=>setTab('verify') }, 'Verify'),
          React.createElement('a', { className: 'tab ' + (tab==='env'?'tab-active':''), onClick:()=>setTab('env') }, 'Env'),
        );

        const body = tab==='connect' ? connect : tab==='verify' ? verifyView : envView;
        return React.createElement('div', null, tabs, body);
      }

      const root = ReactDOM.createRoot(document.getElementById('app'));
      root.render(React.createElement(App));
    </script>
  </body>
</html>`;
    reply.header('content-type', 'text/html; charset=utf-8').send(html);
  });

  // Telegram-authenticated API
  app.get('/api/me', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const githubInstallUrl = config.githubAppSlug
      ? `https://github.com/apps/${config.githubAppSlug}/installations/new`
      : null;
    return reply.send({
      ok: true,
      project: { _id: project._id, name: project.name },
      github: project.github || {},
      githubInstallUrl,
    });
  });

  app.get('/api/github/install-url', { preHandler: telegramAuth }, async (_req, reply) => {
    if (!config.githubAppSlug) return reply.send({ ok: false, url: null, error: 'GITHUB_APP_SLUG not set' });
    return reply.send({ ok: true, url: `https://github.com/apps/${config.githubAppSlug}/installations/new` });
  });

  app.get('/api/github/callback', { preHandler: telegramAuth }, async (req, reply) => {
    try {
      const project = (req as any).project;
      const installationId = Number((req.query as any)?.installation_id);
      if (!installationId) return reply.code(400).send({ ok: false, error: 'installation_id required' });
      await ProjectModel.updateOne({ _id: project._id }, { $set: { github: { ...(project.github || {}), installationId } } });
      return reply.send({ ok: true });
    } catch (e: any) {
      return reply.code(500).send({ ok: false, error: e.message || 'callback failed' });
    }
  });

  app.post('/api/selftest', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const now = new Date();
    const since = new Date(now.getTime() - 15 * 60 * 1000);
    const recent = await EventModel.countDocuments({ projectId: project._id, ts: { $gte: since } });
    const week = getLastIsoWeek();
    const weekly = await getWeekly(String(project._id), week);
    return reply.send({ ok: true, recentEvents15m: recent, weekly });
  });

  app.get('/api/envs', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const seen = await EventModel.distinct('meta.deploymentEnvironment', { projectId: project._id });
    const selected = project?.settings?.prodEnvironments || [];
    return reply.send({ ok: true, seenEnvs: (seen || []).filter(Boolean), selected });
  });

  app.post('/api/envs', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const body: any = req.body || {};
    const selected: string[] = Array.isArray(body.selected) ? body.selected : [];
    await ProjectModel.updateOne({ _id: project._id }, { $set: { 'settings.prodEnvironments': selected } });
    return reply.send({ ok: true });
  });
}


