import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { HarperCorrectionMenu, HarperSuggestion } from './HarperCorrectionMenu';
import { PromptModal } from './PromptModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let harperInstance: any = null;

async function initializeHarper() {
  if (harperInstance) return harperInstance;

  try {
    const Harper = await import('harper.js');
    harperInstance = new Harper.LocalLinter({
      binary: Harper.binaryInlined,
    });
    await harperInstance.setup();
    return harperInstance;
  } catch (error) {
    console.error('Harper grammar checker failed to initialize:', error);
    return null;
  }
}

async function checkGrammar(text: string): Promise<HarperSuggestion[]> {
  const harper = await initializeHarper();
  if (!harper) return [];

  try {
    const result = await harper.lint(text, { language: 'markdown' });
    if (!result || !Array.isArray(result)) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.map((lint: any) => {
      const span = lint.span();
      const suggestions = lint.suggestions();

      return {
        start: span.start,
        end: span.end,
        message: lint.message(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        replacements: suggestions.map((s: any) => s.get_replacement_text()),
      };
    });
  } catch (error) {
    console.error('Harper grammar check failed:', error);
    return [];
  }
}

type MarkdownStorage = {
  getMarkdown?: () => string;
  setMarkdown?: (value: string) => void;
};

type HarperPluginState = {
  decorations: DecorationSet;
};

export class MarkdownEditor {
  private editor!: Editor;
  private container: HTMLElement;
  private correctionMenu: HarperCorrectionMenu;
  private harperPluginKey = new PluginKey<HarperPluginState>('harper-grammar');
  private promptModal: PromptModal;
  private sourceElement: HTMLTextAreaElement | null = null;
  private isSourceMode = false;

  constructor(editorId: string) {
    this.container = document.getElementById(editorId) as HTMLElement;
    if (!this.container) {
      throw new Error(`Editor element with id "${editorId}" not found`);
    }

    this.correctionMenu = new HarperCorrectionMenu();
    this.promptModal = new PromptModal();
    this.setupEditor();
    this.enterSourceMode();
  }

  private setupEditor() {
    const harperExtension = this.createHarperExtension();
    const shortcuts = this.createShortcutExtension();
    const NonInclusiveLink = Link.extend({
      inclusive: false,
    });
    const InlineTaskItem = TaskItem.extend({
      renderHTML({ node, HTMLAttributes }) {
        return [
          'li',
          HTMLAttributes,
          [
            'label',
            ['input', { type: 'checkbox', checked: node.attrs.checked ? 'checked' : null }],
          ],
          ['span', 0],
        ];
      },
    });

    this.editor = new Editor({
      element: this.container,
      autofocus: true,
      content: '',
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false,
        }),
        NonInclusiveLink.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
        }),
        Image,
        BulletList.configure({
          keepMarks: true,
          keepAttributes: false,
        }),
        OrderedList.configure({
          keepMarks: true,
          keepAttributes: false,
        }),
        ListItem,
        Table.configure({
          resizable: false,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        InlineTaskItem.configure({
          nested: true,
        }),
        Placeholder.configure({
          placeholder: "I'm writing it down to remember it now...",
        }),
        Markdown.configure({
          html: false,
          transformCopiedText: true,
          transformPastedText: true,
        }),
        shortcuts,
        harperExtension,
      ],
      editorProps: {
        attributes: {
          class: 'prose-editor',
        },
      },
    });

    // Explicitly initialize Harper after editor is ready
    initializeHarper().catch(console.error);

    this.editor.on('selectionUpdate', () => {
      const { empty } = this.editor.state.selection;
      if (!empty) return;

      if (this.editor.isActive('link')) return;

      const { $from } = this.editor.state.selection;
      const marks = $from.marks();
      if (!marks.length) return;

      const filtered = marks.filter((mark) => mark.type.name !== 'link');
      if (filtered.length === marks.length) return;

      const tr = this.editor.state.tr.setStoredMarks(filtered);
      this.editor.view.dispatch(tr);
    });
  }

  private createShortcutExtension() {
    return Extension.create({
      addKeyboardShortcuts: () => ({
        Enter: () => {
          if (this.editor.isActive('link')) {
            this.editLinkAtCursor();
            return true;
          }
          return false;
        },
        'Mod-b': () => {
          this.editor.commands.toggleBold();
          return true;
        },
        'Mod-i': () => {
          this.editor.commands.toggleItalic();
          return true;
        },
        'Mod-Shift-s': () => {
          this.editor.commands.toggleStrike();
          return true;
        },
        'Mod-Shift-c': () => {
          this.editor.commands.toggleCodeBlock();
          return true;
        },
        'Mod-Shift-q': () => {
          this.editor.commands.toggleBlockquote();
          return true;
        },
        'Mod-Shift-l': () => {
          this.editor.commands.toggleBulletList();
          return true;
        },
        'Mod-Shift-o': () => {
          this.editor.commands.toggleOrderedList();
          return true;
        },
        'Mod-Shift-t': () => {
          this.editor.commands.toggleTaskList();
          return true;
        },
        'Mod-Shift-h': () => {
          this.editor.commands.setHorizontalRule();
          return true;
        },
        'Mod-Shift-x': () => {
          this.editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
          return true;
        },
        'Mod-z': () => {
          this.editor.commands.undo();
          return true;
        },
        'Mod-y': () => {
          this.editor.commands.redo();
          return true;
        },
        'Mod-Shift-z': () => {
          this.editor.commands.redo();
          return true;
        },
        'Mod-k': () => {
          this.promptForLink();
          return true;
        },
        'Mod-Shift-i': () => {
          this.promptForImage();
          return true;
        },
        'Mod-1': () => {
          this.editor.commands.toggleHeading({ level: 1 });
          return true;
        },
        'Mod-2': () => {
          this.editor.commands.toggleHeading({ level: 2 });
          return true;
        },
        'Mod-3': () => {
          this.editor.commands.toggleHeading({ level: 3 });
          return true;
        },
        'Mod-4': () => {
          this.editor.commands.toggleHeading({ level: 4 });
          return true;
        },
        'Mod-5': () => {
          this.editor.commands.toggleHeading({ level: 5 });
          return true;
        },
        'Mod-6': () => {
          this.editor.commands.toggleHeading({ level: 6 });
          return true;
        },
      }),
    });
  }

  public focus() {
    if (this.isSourceMode) {
      this.sourceElement?.focus();
      return;
    }
    this.editor.commands.focus();
  }

  public togglePreviewMode() {
    if (this.isSourceMode) {
      this.exitSourceMode();
      return;
    }

    this.enterSourceMode();
  }

  private async promptForLink() {
    const { from, to } = this.editor.state.selection;
    const selectedText = this.editor.state.doc.textBetween(from, to, ' ');
    const href = await this.promptModal.show({
      placeholder: 'https://',
      initialValue: 'https://',
    });

    if (!href) {
      this.editor.commands.unsetLink();
      return;
    }

    if (selectedText) {
      this.editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      this.editor.commands.setTextSelection(to);
      this.clearStoredLink();
      return;
    }

    const linkText = 'link text';
    this.editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: linkText,
        marks: [{ type: 'link', attrs: { href } }],
      })
      .run();

    const cursorPos = from + linkText.length;
    this.editor.commands.setTextSelection(cursorPos);
    this.clearStoredLink();
  }

  private async editLinkAtCursor() {
    const currentHref = this.editor.getAttributes('link').href as string | undefined;
    const href = await this.promptModal.show({
      placeholder: 'https://',
      initialValue: currentHref ?? 'https://',
    });

    if (href === null) {
      return;
    }

    if (!href) {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    this.editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    this.clearStoredLink();
  }

  private clearStoredLink() {
    this.editor.commands.command(({ tr, state }) => {
      const linkMark = state.schema.marks.link;
      if (linkMark) {
        tr.removeStoredMark(linkMark);
      }
      return true;
    });
  }

  private async promptForImage() {
    const src = await this.promptModal.show({
      placeholder: 'https://',
    });
    if (!src) return;
    this.editor.chain().focus().setImage({ src }).run();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildTextIndex(doc: any) {
    let text = '';
    const map: number[] = [];

    const pushText = (value: string, startPos: number) => {
      for (let i = 0; i < value.length; i += 1) {
        map.push(startPos + i);
      }
      text += value;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.descendants((node: any, pos: number) => {
      if (node.isTextblock) {
        const base = pos + 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.descendants((child: any, childPos: number) => {
          if (child.isText && child.text) {
            pushText(child.text, base + childPos);
          }

          if (child.type?.name === 'hardBreak') {
            pushText('\n', base + childPos);
          }
        });

        pushText('\n', pos + node.nodeSize - 1);
        return false;
      }
      return true;
    });

    if (text.endsWith('\n')) {
      text = text.slice(0, -1);
      map.pop();
    }

    return { text, map };
  }

  private createHarperExtension() {
    return Extension.create({
      addProseMirrorPlugins: () => {
        const menu = this.correctionMenu;
        let debounceTimer: number | null = null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runLint = async (view: any) => {
          const { text, map } = this.buildTextIndex(view.state.doc);
          if (!text.trim()) {
            const decorations = DecorationSet.empty;
            view.dispatch(view.state.tr.setMeta(this.harperPluginKey, { decorations }));
            return;
          }

          const suggestions = await checkGrammar(text);
          const decorations: Decoration[] = [];

          suggestions.forEach((suggestion) => {
            const start = map[suggestion.start];
            const endOffset = suggestion.end - 1;
            const end = endOffset >= 0 ? map[endOffset] : undefined;

            if (start == null || end == null) return;

            const from = start;
            const to = end + 1;

            decorations.push(
              Decoration.inline(
                from,
                to,
                {
                  class: 'harper-error',
                  'data-message': suggestion.message,
                  'data-replacements': JSON.stringify(suggestion.replacements),
                  title: suggestion.message,
                },
                { suggestion, from, to },
              ),
            );
          });

          const decorationSet = DecorationSet.create(view.state.doc, decorations);
          view.dispatch(
            view.state.tr.setMeta(this.harperPluginKey, { decorations: decorationSet }),
          );
        };

        return [
          new Plugin<HarperPluginState>({
            key: this.harperPluginKey,
            state: {
              init: () => ({ decorations: DecorationSet.empty }),
              apply: (tr, value) => {
                const meta = tr.getMeta(this.harperPluginKey);
                if (meta?.decorations) {
                  return { decorations: meta.decorations };
                }

                if (tr.docChanged) {
                  return { decorations: value.decorations.map(tr.mapping, tr.doc) };
                }

                return value;
              },
            },
            props: {
              decorations: (state) =>
                this.harperPluginKey.getState(state)?.decorations ?? DecorationSet.empty,
              handleClick: (view, pos) => {
                const pluginState = this.harperPluginKey.getState(view.state);
                if (!pluginState) return false;

                const matches = pluginState.decorations.find(pos, pos);
                if (!matches.length) return false;

                const match = matches[0];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const suggestion = (match.spec as any).suggestion as HarperSuggestion | undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const from = (match.spec as any).from as number | undefined;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const to = (match.spec as any).to as number | undefined;

                if (!suggestion || from == null || to == null) return false;

                const coords = view.coordsAtPos(from);
                const rect = new DOMRect(
                  coords.left,
                  coords.top,
                  coords.right - coords.left,
                  coords.bottom - coords.top,
                );

                menu.show(suggestion, rect, (replacement) => {
                  this.editor.commands.command(({ tr }) => {
                    tr.insertText(replacement, from, to);
                    return true;
                  });
                });

                return true;
              },
            },
            view: (view) => {
              const schedule = () => {
                if (debounceTimer) {
                  window.clearTimeout(debounceTimer);
                }

                debounceTimer = window.setTimeout(() => {
                  runLint(view);
                }, 500);
              };

              schedule();

              return {
                update: (updatedView, prevState) => {
                  if (updatedView.state.doc !== prevState.doc) {
                    schedule();
                  }
                },
                destroy: () => {
                  if (debounceTimer) {
                    window.clearTimeout(debounceTimer);
                  }
                },
              };
            },
          }),
        ];
      },
    });
  }

  getValue(): string {
    if (this.isSourceMode && this.sourceElement) {
      return this.sourceElement.value;
    }

    const storage = this.editor.storage as { markdown?: MarkdownStorage };
    return storage.markdown?.getMarkdown?.() ?? this.editor.getText();
  }

  setValue(value: string) {
    if (this.isSourceMode && this.sourceElement) {
      this.sourceElement.value = value;
      return;
    }

    const storage = this.editor.storage as { markdown?: MarkdownStorage };
    if (storage.markdown?.setMarkdown) {
      storage.markdown.setMarkdown(value);
      return;
    }

    this.editor.commands.setContent(value);
  }

  private enterSourceMode() {
    const markdown = this.getValue();
    this.editor.setEditable(true);
    this.container.classList.add('hidden');

    if (!this.sourceElement) {
      this.sourceElement = document.createElement('textarea');
      this.sourceElement.className = 'markdown-source';
      this.sourceElement.setAttribute('aria-label', 'Markdown source editor');
      this.sourceElement.addEventListener('keydown', (event) => this.handleSourceKeydown(event));
      this.container.parentElement?.appendChild(this.sourceElement);
    }

    this.sourceElement.value = markdown;
    this.sourceElement.classList.remove('hidden');
    this.sourceElement.focus();
    this.isSourceMode = true;
  }

  private exitSourceMode() {
    const sourceMarkdown = this.sourceElement?.value ?? '';
    this.sourceElement?.classList.add('hidden');
    this.container.classList.remove('hidden');
    const storage = this.editor.storage as { markdown?: MarkdownStorage };
    if (storage.markdown?.setMarkdown) {
      storage.markdown.setMarkdown(sourceMarkdown);
    } else {
      this.editor.commands.setContent(sourceMarkdown);
    }
    this.editor.setEditable(true);
    this.isSourceMode = false;
    this.editor.commands.focus();
  }

  private handleSourceKeydown(event: KeyboardEvent) {
    if (!this.sourceElement) return;

    const isCmd = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (isCmd && !event.shiftKey && key === 'b') {
      event.preventDefault();
      this.wrapSelectionWith('**');
      return;
    }

    if (isCmd && !event.shiftKey && key === 'i') {
      event.preventDefault();
      this.wrapSelectionWith('*');
      return;
    }

    if (event.key === 'Enter') {
      const handled = this.handleSourceEnterKey();
      if (handled) {
        event.preventDefault();
      }
    }
  }

  private wrapSelectionWith(marker: string) {
    if (!this.sourceElement) return;

    const el = this.sourceElement;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const selected = value.slice(start, end);
    const wrapped = `${marker}${selected}${marker}`;

    el.value = `${value.slice(0, start)}${wrapped}${value.slice(end)}`;
    const nextStart = start + marker.length;
    const nextEnd = nextStart + selected.length;
    el.setSelectionRange(nextStart, nextEnd);
  }

  private handleSourceEnterKey(): boolean {
    if (!this.sourceElement) return false;

    const el = this.sourceElement;
    if (el.selectionStart !== el.selectionEnd) return false;

    const cursor = el.selectionStart;
    const value = el.value;
    const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
    const lineEnd = value.indexOf('\n', cursor);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end);

    const taskMatch = line.match(/^(\s*)[-*+]\s+\[(?: |x|X)\]\s+(.+)$/);
    if (taskMatch) {
      return this.insertAtCursor(`\n${taskMatch[1]}- [ ] `);
    }

    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (unorderedMatch) {
      return this.insertAtCursor(`\n${unorderedMatch[1]}${unorderedMatch[2]} `);
    }

    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const nextNumber = Number.parseInt(orderedMatch[2], 10) + 1;
      return this.insertAtCursor(`\n${orderedMatch[1]}${nextNumber}. `);
    }

    return false;
  }

  private insertAtCursor(text: string): boolean {
    if (!this.sourceElement) return false;

    const el = this.sourceElement;
    const cursor = el.selectionStart;
    const value = el.value;

    el.value = `${value.slice(0, cursor)}${text}${value.slice(cursor)}`;
    const nextCursor = cursor + text.length;
    el.setSelectionRange(nextCursor, nextCursor);
    return true;
  }
}
