"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Heading as HeadingIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Props = {
  value?: string
  placeholder?: string
  onChange?: (html: string) => void
  onReady?: (editor: Editor) => void
  className?: string
  editable?: boolean
}

export function PrayerEditor({
  value = "",
  placeholder = "Share your prayer request…",
  onChange,
  onReady,
  className,
  editable = true,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-editor max-w-none focus:outline-none",
          "min-h-[120px] px-3 py-2",
        ),
      },
    },
  })

  React.useEffect(() => {
    if (editor && onReady) onReady(editor)
  }, [editor, onReady])

  React.useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/30 overflow-hidden rounded-lg border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]",
        className,
      )}
    >
      {editable && editor ? (
        <div className="bg-muted/40 flex flex-wrap items-center gap-1 border-b px-2 py-1">
          <ToolBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
          >
            <Bold />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
          >
            <Italic />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Strike"
          >
            <Strikethrough />
          </ToolBtn>
          <div className="bg-border mx-1 h-5 w-px" />
          <ToolBtn
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            label="Heading"
          >
            <HeadingIcon />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            <List />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="Numbered list"
          >
            <ListOrdered />
          </ToolBtn>
          <ToolBtn
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            label="Quote"
          >
            <Quote />
          </ToolBtn>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolBtn({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  )
}
