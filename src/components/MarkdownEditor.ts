import { ink, defineOptions } from 'ink-mde';
import type { Instance, Options } from 'ink-mde';
import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { PromptModal } from './PromptModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let harperInstance: any = null;

async function initializeHarper() {
  if (harperInstance) return harperInstance;
  try {
    const Harper = await import('harper.js');
    harperInstance = new Harper.LocalLinter({ binary: Harper.binaryInlined });
    await harperInstance.setup();
    return harperInstance;
  } catch (e) {
    console.error('Harper failed to initialize:', e);
    return null;
  }
}

async function checkGrammar(
  text: string,
): Promise<Array<{ start: number; end: number; message: string; replacements: string[] }>> {
  const harper = await initializeHarper();
  if (!harper) return [];
  try {
    const result = await harper.lint(text, { language: 'markdown' });
    if (!result || !Array.isArray(result)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((lint: any) => {
      const span = lint.span();
      return {
        start: span.start,
        end: span.end,
        message: lint.message(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        replacements: lint.suggestions().map((s: any) => s.get_replacement_text()),
      };
    });
  } catch (e) {
    console.error('Harper lint failed:', e);
    return [];
  }
}

function toggleInline(view: EditorView, marker: string): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const m = marker.length;
  const selected = state.doc.sliceString(from, to);

  // Check if selection is already wrapped
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > m * 2) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(m, -m) },
      selection: { anchor: from, head: to - m * 2 },
    });
    return true;
  }

  // Check surrounding context (cursor between markers)
  const before = state.doc.sliceString(Math.max(0, from - m), from);
  const after = state.doc.sliceString(to, Math.min(state.doc.length, to + m));
  if (before === marker && after === marker) {
    view.dispatch({
      changes: [
        { from: from - m, to: from, insert: '' },
        { from: to, to: to + m, insert: '' },
      ],
      selection: { anchor: from - m, head: to - m },
    });
    return true;
  }

  // Wrap selection (or insert empty markers with cursor in between)
  view.dispatch({
    changes: { from, to, insert: `${marker}${selected}${marker}` },
    selection: { anchor: from + m, head: to + m },
  });
  return true;
}

function toggleHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.from);
  const prefix = '#'.repeat(level) + ' ';
  const stripped = line.text.replace(/^#{1,6} /, '');
  const newText = line.text.startsWith(prefix) ? stripped : prefix + stripped;
  const delta = newText.length - line.text.length;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: { anchor: Math.max(line.from, state.selection.main.anchor + delta) },
  });
  return true;
}

function prefixLine(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.from);
  // Toggle: remove if already present, add if not
  if (line.text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
      selection: { anchor: Math.max(line.from, state.selection.main.anchor - prefix.length) },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: state.selection.main.anchor + prefix.length },
    });
  }
  return true;
}

export class MarkdownEditor {
  private instance: Instance | null = null;
  private container: HTMLElement;
  private isSourceMode = false;
  private sourceElement: HTMLTextAreaElement | null = null;
  private currentDoc = '';
  private promptModal: PromptModal;
  private themeObserver: MutationObserver | null = null;
  private onChange?: () => void;

  constructor(editorId: string, onChange?: () => void) {
    const el = document.getElementById(editorId);
    if (!el) throw new Error(`Element #${editorId} not found`);
    this.container = el;
    this.onChange = onChange;
    this.promptModal = new PromptModal();
    void this.init();
  }

  private async init() {
    initializeHarper().catch(console.error);

    const harperPlugin: Options.Plugin = {
      type: 'default',
      value: linter(
        async (view) => {
          const text = view.state.doc.toString();
          if (!text.trim()) return [];
          const suggestions = await checkGrammar(text);
          return suggestions.map(
            (s): Diagnostic => ({
              from: s.start,
              to: s.end,
              severity: 'warning',
              message: s.message,
              actions:
                s.replacements.length > 0
                  ? s.replacements.slice(0, 5).map((r) => ({
                      name: r,
                      apply: (v: EditorView, from: number, to: number) => {
                        v.dispatch({ changes: { from, to, insert: r } });
                      },
                    }))
                  : undefined,
            }),
          );
        },
        { delay: 600 },
      ),
    };

    const keybindingsPlugin: Options.Plugin = {
      type: 'default',
      value: Prec.high(
        keymap.of([
          { key: 'Mod-b', run: (v) => toggleInline(v, '**') },
          { key: 'Mod-i', run: (v) => toggleInline(v, '*') },
          { key: 'Mod-Shift-s', run: (v) => toggleInline(v, '~~') },
          { key: 'Mod-Shift-q', run: (v) => prefixLine(v, '> ') },
          { key: 'Mod-Shift-l', run: (v) => prefixLine(v, '- ') },
          { key: 'Mod-Shift-o', run: (v) => prefixLine(v, '1. ') },
          { key: 'Mod-Shift-t', run: (v) => prefixLine(v, '- [ ] ') },
          { key: 'Mod-1', run: (v) => toggleHeading(v, 1) },
          { key: 'Mod-2', run: (v) => toggleHeading(v, 2) },
          { key: 'Mod-3', run: (v) => toggleHeading(v, 3) },
          { key: 'Mod-4', run: (v) => toggleHeading(v, 4) },
          { key: 'Mod-5', run: (v) => toggleHeading(v, 5) },
          { key: 'Mod-6', run: (v) => toggleHeading(v, 6) },
          {
            key: 'Mod-k',
            run: (v) => {
              void this.insertLink(v);
              return true;
            },
          },
        ]),
      ),
    };

    const isDark = document.documentElement.classList.contains('dark');

    this.instance = await ink(
      this.container,
      defineOptions({
        doc: this.currentDoc,
        placeholder: "I'm writing it down to remember it now...",
        interface: {
          appearance: isDark ? 'dark' : 'light',
          toolbar: false,
          attribution: false,
          spellcheck: false,
        },
        hooks: {
          afterUpdate: (doc) => {
            this.currentDoc = doc;
            this.onChange?.();
          },
        },
        plugins: [harperPlugin, keybindingsPlugin],
      }),
    );

    this.themeObserver = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      this.instance?.reconfigure({
        interface: { appearance: dark ? 'dark' : 'light' },
      });
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    this.instance?.focus();
  }

  private async insertLink(view: EditorView) {
    const { from, to } = view.state.selection.main;
    const selected = view.state.doc.sliceString(from, to);
    const href = await this.promptModal.show({ placeholder: 'https://', initialValue: 'https://' });
    if (!href) {
      this.instance?.focus();
      return;
    }
    const text = selected || 'link';
    view.dispatch({
      changes: { from, to, insert: `[${text}](${href})` },
      selection: { anchor: from + 1 + text.length + 3 + href.length },
    });
    this.instance?.focus();
  }

  getValue(): string {
    if (this.isSourceMode && this.sourceElement) return this.sourceElement.value;
    return this.instance?.getDoc() ?? this.currentDoc;
  }

  setValue(value: string) {
    this.currentDoc = value;
    if (this.isSourceMode && this.sourceElement) {
      this.sourceElement.value = value;
      return;
    }
    this.instance?.load(value);
  }

  focus() {
    if (this.isSourceMode) {
      this.sourceElement?.focus();
      return;
    }
    this.instance?.focus();
  }

  togglePreviewMode() {
    if (this.isSourceMode) this.exitSourceMode();
    else this.enterSourceMode();
  }

  private enterSourceMode() {
    const markdown = this.getValue();
    this.container.style.display = 'none';

    if (!this.sourceElement) {
      this.sourceElement = document.createElement('textarea');
      this.sourceElement.className = 'markdown-source';
      this.sourceElement.setAttribute('aria-label', 'Markdown source editor');
      this.sourceElement.addEventListener('input', () => this.onChange?.());
      this.container.parentElement?.appendChild(this.sourceElement);
    }

    this.sourceElement.value = markdown;
    this.sourceElement.style.display = '';
    this.sourceElement.focus();
    this.isSourceMode = true;
  }

  private exitSourceMode() {
    const markdown = this.sourceElement?.value ?? '';
    if (this.sourceElement) this.sourceElement.style.display = 'none';
    this.container.style.display = '';
    this.currentDoc = markdown;
    this.instance?.load(markdown);
    this.onChange?.();
    this.isSourceMode = false;
    this.instance?.focus();
  }
}
