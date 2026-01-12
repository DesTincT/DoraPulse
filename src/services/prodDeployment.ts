export type ProdEnvironmentRule = string[];

function tryCompileRegex(rule: string): RegExp | null {
  const s = String(rule || '').trim();
  if (!s) return null;

  // Explicit /pattern/flags syntax
  if (s.startsWith('/')) {
    const last = s.lastIndexOf('/');
    if (last > 1) {
      const pattern = s.slice(1, last);
      const flagsRaw = s.slice(last + 1);
      const flags = flagsRaw.replace(/[^gimsuy]/g, '');
      try {
        return new RegExp(pattern, flags || 'i');
      } catch {
        return null;
      }
    }
  }

  // Heuristic: treat as regex if it contains common regex metacharacters or anchors.
  const metaChars = ['^', '$', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'];
  if (metaChars.some((ch) => s.includes(ch))) {
    try {
      return new RegExp(s, 'i');
    } catch {
      return null;
    }
  }

  return null;
}

export function getEffectiveProdEnvironments(rule: unknown): string[] {
  const defaults = ['prod', 'production'];
  const arr = Array.isArray(rule)
    ? rule
    : typeof rule === 'string'
      ? String(rule)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const normalized = arr.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
  return normalized.length ? normalized : defaults;
}

export function matchProdEnvironment(env: string | undefined, projectSettings: any): boolean {
  if (!env || typeof env !== 'string') return false;
  const rule = getEffectiveProdEnvironments(projectSettings?.prodEnvironments);
  const envLower = env.toLowerCase();

  for (const r of rule) {
    const re = tryCompileRegex(r);
    if (re) {
      if (re.test(env)) return true;
      continue;
    }
    if (String(r).toLowerCase() === envLower) return true;
  }
  return false;
}

export function isProdDeployment(payload: any, projectSettings: any): boolean {
  const dep = payload?.deployment;
  const status = payload?.deployment_status;
  if (!dep || !status) return false;
  // Primary source of truth is deployment.environment; fallback to deployment_status.environment if present.
  const envName: string | undefined =
    dep?.environment ??
    status?.environment ??
    status?.deployment_environment ??
    status?.deploymentEnvironment ??
    undefined;
  if (!matchProdEnvironment(envName, projectSettings)) return false;
  const state = String(status?.state || '').toLowerCase();
  return state === 'success';
}
