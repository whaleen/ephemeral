export interface HarperSuggestion {
  start: number;
  end: number;
  message: string;
  replacements: string[];
}

export class HarperCorrectionMenu {
  private menu: HTMLElement | null = null;

  constructor() {
    this.createMenu();
  }

  private createMenu() {
    this.menu = document.createElement('div');
    this.menu.id = 'harper-correction-menu';
    this.menu.className =
      'fixed hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 min-w-48';
    this.menu.style.zIndex = '9999';

    // Use document.body for fixed positioning to work properly
    document.body.appendChild(this.menu);

    document.addEventListener('click', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  show(suggestion: HarperSuggestion, rect: DOMRect, onApply: (replacement: string) => void) {
    console.log('MENU SHOW CALLED:', suggestion, rect);
    if (!this.menu) {
      console.log('NO MENU ELEMENT');
      return;
    }

    this.menu.innerHTML = '';

    // Message
    const message = document.createElement('div');
    message.textContent = suggestion.message;
    message.className =
      'text-sm text-gray-700 dark:text-gray-300 mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-700';
    this.menu.appendChild(message);

    // Suggestions
    suggestion.replacements.forEach((replacement) => {
      const button = document.createElement('button');
      button.textContent = replacement;
      button.className =
        'w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-200';
      button.onclick = () => {
        console.log('BUTTON CLICKED:', replacement);
        onApply(replacement);
        this.hide();
      };
      this.menu?.appendChild(button);
    });

    // Position and show
    this.menu.style.left = rect.left + 'px';
    this.menu.style.top = rect.bottom + 5 + 'px';
    this.menu.classList.remove('hidden');
    console.log('MENU SHOULD BE VISIBLE NOW');
  }

  hide() {
    if (this.menu) {
      this.menu.classList.add('hidden');
    }
  }
}
