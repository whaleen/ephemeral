import { getCurrentWindow } from '@tauri-apps/api/window';

export class TitleBar {
  private window = getCurrentWindow();

  constructor() {
    this.initializeControls();
  }

  private initializeControls() {
    const titlebar = document.getElementById('titlebar');

    // titleBarStyle: Overlay still needs a web drag region. Buttons in the
    // title bar remain normal controls because interactive targets are ignored.
    titlebar?.addEventListener('mousedown', async (event) => {
      if (event.button !== 0) return;
      if (event.detail > 1) return;
      if (this.isInteractiveTarget(event.target)) return;

      try {
        await this.window.startDragging();
      } catch (error) {
        console.error('Failed to start window drag:', error);
      }
    });

    titlebar?.addEventListener('dblclick', (event) => {
      if (this.isInteractiveTarget(event.target)) return;
      this.toggleMaximize();
    });
  }

  private isInteractiveTarget(target: EventTarget | null) {
    return (
      target instanceof Element && Boolean(target.closest('button, a, input, textarea, select'))
    );
  }

  private async toggleMaximize() {
    const isMaximized = await this.window.isMaximized();
    if (isMaximized) {
      await this.window.unmaximize();
    } else {
      await this.window.maximize();
    }
  }
}
