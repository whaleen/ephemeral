export class ThemeManager {
  private html: HTMLElement;
  private themeToggle: HTMLElement | null;
  private systemPrefersDark: MediaQueryList;

  constructor() {
    this.html = document.documentElement;
    this.themeToggle = document.getElementById('theme-toggle');
    this.systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    if (!this.themeToggle) {
      console.error('Theme toggle button not found!');
      return;
    }

    this.initializeTheme();
  }

  private initializeTheme() {
    // Clear historical override so app follows macOS theme by default.
    localStorage.removeItem('theme');
    this.applySystemTheme();

    this.systemPrefersDark.addEventListener('change', () => {
      this.applySystemTheme();
    });

    this.themeToggle?.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  private applySystemTheme() {
    if (this.systemPrefersDark.matches) {
      this.html.classList.add('dark');
    } else {
      this.html.classList.remove('dark');
    }
  }

  private toggleTheme() {
    // Manual toggle is session-only; next launch follows macOS again.
    if (this.html.classList.contains('dark')) {
      this.html.classList.remove('dark');
    } else {
      this.html.classList.add('dark');
    }
  }

  getCurrentTheme(): 'light' | 'dark' {
    return this.html.classList.contains('dark') ? 'dark' : 'light';
  }

  setTheme(theme: 'light' | 'dark') {
    if (theme === 'dark') {
      this.html.classList.add('dark');
    } else {
      this.html.classList.remove('dark');
    }
  }
}
