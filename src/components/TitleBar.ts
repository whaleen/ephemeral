import { getCurrentWindow } from '@tauri-apps/api/window';

export class TitleBar {
  private window = getCurrentWindow();

  constructor() {
    this.initializeControls();
  }

  private initializeControls() {
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    minimizeBtn?.addEventListener('click', () => this.minimize());
    maximizeBtn?.addEventListener('click', () => this.toggleMaximize());
    closeBtn?.addEventListener('click', () => this.close());
  }

  private async minimize() {
    await this.window.minimize();
  }

  private async toggleMaximize() {
    const isMaximized = await this.window.isMaximized();
    if (isMaximized) {
      await this.window.unmaximize();
    } else {
      await this.window.maximize();
    }
  }

  private async close() {
    await this.window.close();
  }
}
