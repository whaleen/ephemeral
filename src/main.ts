import { TitleBar } from './components/TitleBar';
import { MarkdownEditor } from './components/MarkdownEditor';
import { ThemeManager } from './components/ThemeManager';
import { InfoModal } from './components/InfoModal';
import { SaveModal } from './components/SaveModal';
import { FileExportService } from './services/FileExportService';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { truncatePath } from './lib/utils';

interface OpenedFilePayload {
  path: string;
  contents: string;
}

type CloseDecision = 'save' | 'discard' | 'cancel';

class EphemeralTextApp {
  private editor: MarkdownEditor;
  private infoModal: InfoModal;
  private saveModal: SaveModal;
  private fileExportService: FileExportService;
  private currentFilePath: string | null = null;
  private lastSavedContent = '';
  private isDirty = false;
  private isClosing = false;

  constructor() {
    new TitleBar();
    this.editor = new MarkdownEditor('editor', () => this.handleEditorChange());
    new ThemeManager();
    this.infoModal = new InfoModal();
    this.saveModal = new SaveModal();
    this.fileExportService = new FileExportService();

    this.initializeKeyboardShortcuts();
    this.initializeExportButtons();
    this.fileExportService.setupExportDirectoryButton();
    this.initializeExternalLinks();
    this.initializeFileOpenHandlers();
  }

  private initializeKeyboardShortcuts() {
    window.addEventListener(
      'keydown',
      (event) => {
        const isCmd = event.metaKey || event.ctrlKey;
        const isShift = event.shiftKey;
        const key = event.key.toLowerCase();

        if (isCmd && (key === '/' || key === '?')) {
          event.preventDefault();
          event.stopPropagation();
          this.infoModal.toggle();
          return;
        }

        if (isCmd && !isShift && key === 'm') {
          event.preventDefault();
          event.stopPropagation();
          this.editor.togglePreviewMode();
          return;
        }

        if (isCmd && !isShift && key === 'e') {
          event.preventDefault();
          this.fileExportService.selectExportDirectory().catch((error) => {
            console.error('Failed to open export directory picker:', error);
          });
          return;
        }

        if (isCmd && !isShift && key === 'n') {
          event.preventDefault();
          invoke('create_window').catch((error) => {
            console.error('Failed to create window:', error);
          });
          return;
        }

        if (isCmd && !isShift && (key === 'w' || key === 'q')) {
          event.preventDefault();
          this.requestClose().catch((error) => {
            console.error('Failed to close window:', error);
          });
          return;
        }

        // Save shortcut (Cmd+S): file-backed documents save in-place; untitled documents export.
        if (isCmd && !isShift && key === 's') {
          event.preventDefault();
          this.infoModal.hide();
          if (this.currentFilePath) {
            this.saveCurrentFile().catch((error) => {
              console.error('Failed to save current file:', error);
            });
          } else {
            this.showSaveModal();
          }
          return;
        }

        // Save As / Export Copy (Cmd+Shift+S)
        if (isCmd && isShift && key === 's') {
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

  private async initializeFileOpenHandlers() {
    await listen<OpenedFilePayload>('file-opened', async (event) => {
      await this.openFile(event.payload);
      await invoke('consume_pending_open_file').catch(() => undefined);
    });

    await listen('request-close', async () => {
      await this.requestClose();
    });

    await getCurrentWindow().onCloseRequested(async (event) => {
      if (this.isClosing) return;

      event.preventDefault();
      if (this.shouldPromptOnClose()) {
        await this.handleDirtyClose();
      } else {
        await this.closeWindowWithoutPrompt();
      }
    });

    try {
      const pendingFile = await invoke<OpenedFilePayload | null>('consume_pending_open_file');
      if (pendingFile) {
        await this.openFile(pendingFile);
      }
    } catch (error) {
      console.error('Failed to consume pending file:', error);
    }
  }

  private handleEditorChange() {
    if (!this.currentFilePath) return;
    const nextDirty = this.editor.getValue() !== this.lastSavedContent;
    if (nextDirty !== this.isDirty) {
      this.isDirty = nextDirty;
      this.updateDocumentStatus();
    }
  }

  private async openFile(file: OpenedFilePayload) {
    const canReplace = await this.resolveDirtyDocument();
    if (!canReplace) return;

    this.currentFilePath = file.path;
    this.lastSavedContent = file.contents;
    this.isDirty = false;
    this.editor.setValue(file.contents);
    this.updateDocumentStatus();
    this.editor.focus();
  }

  private async resolveDirtyDocument(): Promise<boolean> {
    if (!this.shouldPromptOnClose()) return true;

    const decision = await this.showDirtyPrompt('Open another file?');
    if (decision === 'cancel') return false;
    if (decision === 'discard') return true;

    return this.saveCurrentFile();
  }

  private shouldPromptOnClose() {
    return Boolean(this.currentFilePath && this.isDirty);
  }

  private async handleDirtyClose() {
    const decision = await this.showDirtyPrompt('Save changes before closing?');
    if (decision === 'cancel') return;

    if (decision === 'save') {
      const saved = await this.saveCurrentFile();
      if (!saved) return;
    }

    await this.closeWindowWithoutPrompt();
  }

  private async requestClose() {
    if (this.shouldPromptOnClose()) {
      await this.handleDirtyClose();
      return;
    }

    await this.closeWindowWithoutPrompt();
  }

  private async closeWindowWithoutPrompt() {
    this.isClosing = true;
    await invoke('quit_app');
  }

  private async showDirtyPrompt(title: string): Promise<CloseDecision> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className =
        'absolute inset-0 z-[60] flex items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-[2px]';
      overlay.innerHTML = `
        <div class="w-80 overflow-hidden rounded-sm border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div class="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
            <h2 class="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-zinc-100">${title}</h2>
            <p class="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">${this.currentFilePath ? truncatePath(this.currentFilePath) : 'Current file'} has unsaved changes.</p>
          </div>
          <div class="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
            <button data-action="discard" class="px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none dark:hover:bg-zinc-800 dark:hover:text-zinc-100">Discard</button>
            <button data-action="cancel" class="px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none dark:hover:bg-zinc-800 dark:hover:text-zinc-100">Cancel</button>
            <button data-action="save" class="bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-700 focus:outline-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">Save</button>
          </div>
        </div>
      `;

      const finish = (decision: CloseDecision) => {
        overlay.remove();
        window.removeEventListener('keydown', handleKeydown, { capture: true });
        resolve(decision);
      };

      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish('cancel');
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          finish('save');
        }
      };

      overlay.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        const action = target
          ?.closest('[data-action]')
          ?.getAttribute('data-action') as CloseDecision | null;
        if (action) finish(action);
      });

      window.addEventListener('keydown', handleKeydown, { capture: true });
      document.body.appendChild(overlay);
      (overlay.querySelector('[data-action="save"]') as HTMLElement | null)?.focus();
    });
  }

  private async saveCurrentFile(): Promise<boolean> {
    if (!this.currentFilePath) {
      this.showSaveModal();
      return false;
    }

    try {
      const content = this.editor.getValue();
      const savedPath = await invoke<string>('write_file', {
        path: this.currentFilePath,
        content,
      });
      this.currentFilePath = savedPath;
      this.lastSavedContent = content;
      this.isDirty = false;
      this.updateDocumentStatus();
      return true;
    } catch (error) {
      console.error('Failed to save current file:', error);
      return false;
    }
  }

  private updateDocumentStatus() {
    const lastExportContainer = document.getElementById('last-export-container');
    const lastExportEl = document.getElementById('last-export');
    const lastExportDot = document.getElementById('last-export-dot');

    if (!lastExportContainer || !lastExportEl || !lastExportDot) return;

    if (!this.currentFilePath) {
      lastExportContainer.classList.add('hidden');
      lastExportDot.classList.add('hidden');
      lastExportEl.textContent = '';
      return;
    }

    lastExportContainer.classList.remove('hidden');
    lastExportDot.classList.remove('hidden');
    lastExportDot.classList.toggle('bg-yellow-500', this.isDirty);
    lastExportDot.classList.toggle('bg-green-500', !this.isDirty);
    lastExportEl.textContent = `${this.isDirty ? 'Unsaved' : 'File'}: ${truncatePath(this.currentFilePath)}`;
    lastExportContainer.onclick = () => {
      this.fileExportService.showItemInFolder(this.currentFilePath!);
    };
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
    }, this.defaultSaveName());
  }

  private defaultSaveName() {
    if (!this.currentFilePath) return 'ephemeral';
    const filename = this.currentFilePath.split('/').pop() || 'ephemeral';
    return filename.replace(/\.[^.]+$/, '') || 'ephemeral';
  }

  private async exportFile(extension: '.md' | '.txt', baseName = this.defaultSaveName()) {
    const content = this.editor.getValue();
    const safeBaseName = baseName.replace(/[\\/:*?"<>|]/g, '').trim() || 'ephemeral';
    const filename = safeBaseName + extension;

    const result = await this.fileExportService.saveFile(filename, content);

    if (result) {
      this.currentFilePath = result;
      this.lastSavedContent = content;
      this.isDirty = false;
      this.updateDocumentStatus();
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
