"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from "lucide-react";

type Props = { editor: Editor };

export function Toolbar({ editor }: Props) {
  // Subscribing to exactly these keys keeps the toolbar from re-rendering on
  // every keystroke, which it otherwise would.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      h2: instance.isActive("heading", { level: 2 }),
      h3: instance.isActive("heading", { level: 3 }),
      bullet: instance.isActive("bulletList"),
      ordered: instance.isActive("orderedList"),
      quote: instance.isActive("blockquote"),
      codeBlock: instance.isActive("codeBlock"),
      link: instance.isActive("link"),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  function toggleLink() {
    if (state.link) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt("Link to");
    if (!href) return;
    editor.chain().focus().setLink({ href }).run();
  }

  return (
    <>
      <Button
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden />
      </Button>
      <Button
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </Button>
      <Button
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough aria-hidden />
      </Button>
      <Button
        label="Inline code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code aria-hidden />
      </Button>

      <span className="tool-divider" aria-hidden />

      <Button
        label="Heading 2"
        active={state.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden />
      </Button>
      <Button
        label="Heading 3"
        active={state.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 aria-hidden />
      </Button>

      <span className="tool-divider" aria-hidden />

      <Button
        label="Bulleted list"
        active={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden />
      </Button>
      <Button
        label="Numbered list"
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden />
      </Button>
      <Button
        label="Quote"
        active={state.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote aria-hidden />
      </Button>
      <Button
        label="Code block"
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <SquareCode aria-hidden />
      </Button>
      <Button label="Link" active={state.link} onClick={toggleLink}>
        <Link2 aria-hidden />
      </Button>

      <span className="tool-divider" aria-hidden />

      <Button
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden />
      </Button>
      <Button
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden />
      </Button>
    </>
  );
}

type ButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function Button({ label, active, disabled, onClick, children }: ButtonProps) {
  return (
    <button
      type="button"
      className="tool"
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
