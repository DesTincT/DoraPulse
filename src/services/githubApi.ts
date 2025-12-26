import { config } from '../config.js';

export async function fetchCommitCommittedAt(repoFullName: string, sha: string): Promise<Date | null> {
  if (!repoFullName || !sha) return null;
  const url = `https://api.github.com/repos/${repoFullName}/commits/${encodeURIComponent(sha)}`;
  const headers: Record<string, string> = { 'User-Agent': 'dora-pulse' };
  const token = config.githubApiToken || config.githubToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { headers } as any);
    if (!res.ok) return null;
    const json: any = await res.json();
    const authorDate: string | undefined = json?.commit?.author?.date;
    const committerDate: string | undefined = json?.commit?.committer?.date;
    const iso = authorDate || committerDate;
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isFinite(+d) ? d : null;
  } catch {
    return null;
  }
}
