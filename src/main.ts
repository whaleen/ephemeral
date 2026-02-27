import { TitleBar } from './components/TitleBar';
import { MarkdownEditor } from './components/MarkdownEditor';
import { ThemeManager } from './components/ThemeManager';
import { InfoModal } from './components/InfoModal';
import { SaveModal } from './components/SaveModal';
import { FileExportService } from './services/FileExportService';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';

class EphemeralTextApp {
  private editor: MarkdownEditor;
  private infoModal: InfoModal;
  private saveModal: SaveModal;
  private fileExportService: FileExportService;

  constructor() {
    new TitleBar();
    this.editor = new MarkdownEditor('editor');
    new ThemeManager();
    this.infoModal = new InfoModal();
    this.saveModal = new SaveModal();
    this.fileExportService = new FileExportService();

    this.initializeKeyboardShortcuts();
    this.initializeExportButtons();
    this.fileExportService.setupExportDirectoryButton();
    this.initializeExternalLinks();
  }

  private initializeKeyboardShortcuts() {
    window.addEventListener(
      'keydown',
      (event) => {
        const isCmd = event.metaKey || event.ctrlKey;
        const isShift = event.shiftKey;
        const key = event.key.toLowerCase();

        if (isCmd && !isShift && key === 'i') {
          event.preventDefault();
          event.stopPropagation();
          this.infoModal.toggle();
          return;
        }

        if (isCmd && !isShift && key === 'n') {
          event.preventDefault();
          invoke('create_window').catch((error) => {
            console.error('Failed to create window:', error);
          });
          return;
        }

        if (isCmd && !isShift && key === 'w') {
          event.preventDefault();
          invoke('quit_app').catch((error) => {
            console.error('Failed to quit app:', error);
          });
          return;
        }

        if (isCmd && !isShift && key === 'q') {
          event.preventDefault();
          invoke('quit_app').catch((error) => {
            console.error('Failed to quit app:', error);
          });
          return;
        }

        // Save shortcut (Cmd+S)
        if (isCmd && !isShift && key === 's') {
          event.preventDefault();
          this.infoModal.hide();
          this.showSaveModal();
          return;
        }

        // Fullscreen toggle (Cmd+Shift+F)
        if (isCmd && isShift && key === 'f') {
          event.preventDefault();
          this.toggleFullscreen();
          return;
        }

        // Handle ESC key for overlays
        if (event.key === 'Escape') {
          const isInfoOpen = !this.infoModal.isHidden();
          const isSaveOpen = !this.saveModal.isHidden();

          if (isInfoOpen || isSaveOpen) {
            event.preventDefault();
            this.infoModal.hide();
            this.saveModal.hide();
            this.editor.focus();
          } else {
            this.exitFullscreenIfNeeded();
          }
        }
      },
      { capture: true },
    );
  }

  private async toggleFullscreen() {
    try {
      const window = getCurrentWindow();
      const isFullscreen = await window.isFullscreen();
      await window.setFullscreen(!isFullscreen);
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
    }
  }

  private async exitFullscreenIfNeeded() {
    try {
      const window = getCurrentWindow();
      const isFullscreen = await window.isFullscreen();
      if (isFullscreen) {
        await window.setFullscreen(false);
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }

  private initializeExportButtons() {
    const downloadMdBtn = document.getElementById('download-markdown');
    const downloadTxtBtn = document.getElementById('download-txt');

    downloadMdBtn?.addEventListener('click', () => {
      this.exportFile('.md');
      this.editor.focus();
    });

    downloadTxtBtn?.addEventListener('click', () => {
      this.exportFile('.txt');
      this.editor.focus();
    });
  }

  private showSaveModal() {
    this.saveModal.show((extension, baseName) => {
      this.exportFile(extension, baseName);
      this.editor.focus();
    });
  }

  private async exportFile(extension: '.md' | '.txt', baseName = 'ephemeral') {
    const content = this.editor.getValue();
    const safeBaseName = baseName.replace(/[\\/:*?"<>|]/g, '').trim() || 'ephemeral';
    const filename = safeBaseName + extension;

    const result = await this.fileExportService.saveFile(filename, content);

    if (result) {
      console.log(`Successfully exported file: ${result}`);
    } else {
      console.error('Failed to export file');
    }
  }

  private initializeExternalLinks() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const link = target.closest('[data-external]') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        openUrl(href);
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new EphemeralTextApp();
});
