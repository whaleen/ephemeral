import { getVersion } from '@tauri-apps/api/app';

const LATEST_RELEASE_API = 'https://api.github.com/repos/whaleen/ephemeral/releases/latest';
const CHECK_DELAY_MS = 3000;

export class UpdateChecker {
  constructor() {
    setTimeout(() => void this.check(), CHECK_DELAY_MS);
  }

  private async check() {
    try {
      const current = await getVersion();
      const response = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) return;

      const release = (await response.json()) as { tag_name?: string; html_url?: string };
      const latest = release.tag_name?.replace(/^v/, '');
      if (!latest || !release.html_url) return;

      if (this.isNewer(latest, current)) {
        this.showNotice(latest, release.html_url);
      }
    } catch {
      // Offline or rate-limited — skip silently, check again next launch.
    }
  }

  private isNewer(latest: string, current: string): boolean {
    const a = latest.split('.').map(Number);
    const b = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff > 0;
    }
    return false;
  }

  private showNotice(version: string, url: string) {
    const footerRight = document.querySelector('.footer-right');
    if (!footerRight || document.getElementById('update-notice')) return;

    const link = document.createElement('a');
    link.id = 'update-notice';
    link.href = url;
    link.setAttribute('data-external', '');
    link.className =
      'flex items-center space-x-2 uppercase tracking-widest text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer transition-colors duration-200';
    link.innerHTML = `
      <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
      <span>Update v${version} available</span>
    `;
    footerRight.prepend(link);
  }
}
