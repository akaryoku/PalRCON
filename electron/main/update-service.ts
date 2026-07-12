import { app } from 'electron';

const latestReleaseApi = 'https://api.github.com/repos/akaryoku/PalRCON/releases/latest';
export const releasesUrl = 'https://github.com/akaryoku/PalRCON/releases/latest';

function normalize(version: string) {
  const match = version.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`GitHub returned an invalid release version: ${version}`);
  return match.slice(1).map(Number);
}

export function compareVersions(left: string, right: string) {
  const a = normalize(left); const b = normalize(right);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

export async function checkForUpdates() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(latestReleaseApi, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `PalRCON/${app.getVersion()}`, 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (response.status === 404) throw new Error('No published GitHub release was found.');
    if (!response.ok) throw new Error(`GitHub update check returned ${response.status}.`);
    const release = await response.json() as { tag_name?: string; name?: string; html_url?: string; published_at?: string; body?: string; prerelease?: boolean; draft?: boolean };
    const latestVersion = String(release.tag_name ?? '');
    const currentVersion = app.getVersion();
    return {
      currentVersion,
      latestVersion: latestVersion.replace(/^v/i, ''),
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      releaseName: release.name || latestVersion,
      releaseUrl: release.html_url || releasesUrl,
      publishedAt: release.published_at ?? null,
      notes: (release.body ?? '').slice(0, 2_000)
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('GitHub update check timed out.');
    throw error;
  } finally { clearTimeout(timer); }
}
