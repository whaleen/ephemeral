import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { truncatePath } from '../lib/utils';

export class FileExportService {
  private exportDirectory: string = '';
  private lastExportPath: string = '';
  private fileCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeExportDirectory();
  }

  private async initializeExportDirectory() {
    try {
      this.exportDirectory = await invoke<string>('get_export_directory');
      await invoke('set_export_directory', { path: this.exportDirectory });
      this.updateExportDirectoryDisplay();
    } catch (error) {
      console.error('Failed to get export directory:', error);
    }
  }

  async selectExportDirectory(): Promise<boolean> {
    try {
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath: this.exportDirectory || undefined,
      });

      if (!selection || Array.isArray(selection)) {
        return false;
      }

      this.exportDirectory = selection;
      await invoke('set_export_directory', { path: this.exportDirectory });
      this.updateExportDirectoryDisplay();
      return true;
    } catch (error) {
      console.error('Failed to select export directory:', error);
      return false;
    }
  }

  async saveFile(filename: string, content: string): Promise<string | null> {
    try {
      const filePath = await invoke<string>('save_file', {
        filename,
        content,
      });

      this.lastExportPath = filePath;
      this.updateLastExportDisplay(filePath);
      this.startFileExistenceCheck();

      return filePath;
    } catch (error) {
      console.error('Failed to save file:', error);
      return null;
    }
  }

  async showItemInFolder(path: string): Promise<void> {
    try {
      await invoke('show_item_in_folder', { path });
    } catch (error) {
      console.error('Failed to show item in folder:', error);
    }
  }

  private updateExportDirectoryDisplay() {
    const exportDirDisplay = document.getElementById('export-dir-display');
    if (exportDirDisplay) {
      const truncatedPath = truncatePath(this.exportDirectory);
      exportDirDisplay.textContent = `Export to: ${truncatedPath}`;
    }
  }

  private updateLastExportDisplay(filePath: string) {
    const lastExportContainer = document.getElementById('last-export-container');
    const lastExportEl = document.getElementById('last-export');
    const lastExportDot = document.getElementById('last-export-dot');

    if (lastExportEl && lastExportContainer && lastExportDot) {
      lastExportEl.textContent = `Last export: ${truncatePath(filePath)}`;
      lastExportContainer.classList.remove('hidden');
      lastExportDot.classList.remove('hidden');

      // Add click handler to show in folder
      lastExportContainer.onclick = () => {
        this.showItemInFolder(filePath);
      };
    }
  }

  private startFileExistenceCheck() {
    if (this.fileCheckInterval) {
      clearInterval(this.fileCheckInterval);
    }

    this.fileCheckInterval = setInterval(async () => {
      if (this.lastExportPath) {
        try {
          const exists = await invoke<boolean>('check_file_exists', {
            path: this.lastExportPath,
          });

          if (!exists) {
            this.hideLastExportDisplay();
            if (this.fileCheckInterval) {
              clearInterval(this.fileCheckInterval);
              this.fileCheckInterval = null;
            }
          }
        } catch (error) {
          console.error('Failed to check file existence:', error);
        }
      }
    }, 2000);
  }

  private hideLastExportDisplay() {
    const lastExportContainer = document.getElementById('last-export-container');
    const lastExportDot = document.getElementById('last-export-dot');

    if (lastExportContainer && lastExportDot) {
      lastExportContainer.classList.add('hidden');
      lastExportDot.classList.add('hidden');
    }
  }

  resetLastExport() {
    this.lastExportPath = '';
    if (this.fileCheckInterval) {
      clearInterval(this.fileCheckInterval);
      this.fileCheckInterval = null;
    }
    const lastExportEl = document.getElementById('last-export');
    if (lastExportEl) {
      lastExportEl.textContent = '';
    }
    this.hideLastExportDisplay();
  }

  setupExportDirectoryButton() {
    const exportDirBtn = document.getElementById('export-dir-btn');
    if (exportDirBtn) {
      console.log('Export directory button found, adding listener');
      exportDirBtn.addEventListener('click', async () => {
        console.log('Export directory button clicked');
        await this.selectExportDirectory();
      });
    } else {
      console.error('Export directory button not found!');
    }
  }
}
