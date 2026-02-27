export class SaveModal {
  private saveModal: HTMLElement;
  private saveAsMdBtn: HTMLElement;
  private saveAsTxtBtn: HTMLElement;
  private fileNameInput: HTMLInputElement;
  private onSaveCallback?: (extension: '.md' | '.txt', baseName: string) => void;
  private cleanupFn?: () => void;

  constructor() {
    this.saveModal = document.getElementById('save-modal')!;
    this.saveAsMdBtn = document.getElementById('save-as-md')!;
    this.saveAsTxtBtn = document.getElementById('save-as-txt')!;
    this.fileNameInput = document.getElementById('save-filename') as HTMLInputElement;
    this.saveModal.setAttribute('tabindex', '-1');
    this.initializeModal();
  }

  private initializeModal() {
    this.saveModal.addEventListener('click', (e) => {
      if (e.target === this.saveModal) {
        this.hide();
      }
    });
    const cancelBtn = document.getElementById('cancel-save');
    cancelBtn?.addEventListener('click', () => this.hide());
  }

  public show(onSave: (extension: '.md' | '.txt', baseName: string) => void, initialName = 'ephemeral') {
    this.onSaveCallback = onSave;
    this.fileNameInput.value = initialName;
    this.saveModal.classList.remove('hidden');
    (this.saveModal as HTMLElement).focus();
    this.fileNameInput.focus();
    this.fileNameInput.select();

    // Set up event listeners
    const handleMdSave = () => {
      this.onSaveCallback?.('.md', this.getBaseName());
      this.hide();
    };

    const handleTxtSave = () => {
      this.onSaveCallback?.('.txt', this.getBaseName());
      this.hide();
    };

    const handleKeyNav = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        return;
      }

      const currentFocus = document.activeElement;
      const focusOrder: HTMLElement[] = [this.fileNameInput, this.saveAsMdBtn, this.saveAsTxtBtn];

      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = Math.max(0, focusOrder.indexOf(currentFocus as HTMLElement));
        const nextIndex = e.shiftKey
          ? (currentIndex + focusOrder.length - 1) % focusOrder.length
          : (currentIndex + 1) % focusOrder.length;
        focusOrder[nextIndex].focus();
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (currentFocus === this.saveAsMdBtn || currentFocus === this.saveAsTxtBtn) {
          e.preventDefault();
          if (currentFocus === this.saveAsMdBtn) {
            this.saveAsTxtBtn.focus();
          } else {
            this.saveAsMdBtn.focus();
          }
        }
      }

      if (e.key === 'Enter') {
        if (currentFocus === this.saveAsMdBtn || currentFocus === this.saveAsTxtBtn) {
          (currentFocus as HTMLElement).click();
        } else if (currentFocus === this.fileNameInput) {
          this.saveAsMdBtn.click();
        }
      }
    };

    const cleanup = () => {
      this.saveAsMdBtn.removeEventListener('click', handleMdSave);
      this.saveAsTxtBtn.removeEventListener('click', handleTxtSave);
      this.saveModal.removeEventListener('keydown', handleKeyNav);
    };

    this.saveAsMdBtn.addEventListener('click', handleMdSave);
    this.saveAsTxtBtn.addEventListener('click', handleTxtSave);
    this.saveModal.addEventListener('keydown', handleKeyNav);

    // Store cleanup function for later use
    this.cleanupFn = cleanup;
  }

  public hide() {
    this.saveModal.classList.add('hidden');
    this.onSaveCallback = undefined;
    // Clean up event listeners
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = undefined;
    }
  }

  public isHidden() {
    return this.saveModal.classList.contains('hidden');
  }

  private getBaseName(): string {
    const raw = this.fileNameInput.value.trim();
    return raw || 'ephemeral';
  }
}
