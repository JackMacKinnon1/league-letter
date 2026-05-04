'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { createClient } from '@/lib/supabase/client'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
} from 'lucide-react'
import { useRef, useState } from 'react'

export default function RichTextEditor({
  value,
  onChange,
  leagueId,
}: {
  value: string
  onChange: (html: string) => void
  leagueId: string
}) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'article-body min-h-[420px] rounded-b-2xl border-x border-b border-zinc-800 bg-zinc-950 px-5 py-4 outline-none',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  function setLink() {
    const previousUrl = editor?.getAttributes('link').href
    const url = window.prompt('Paste link URL', previousUrl || 'https://')

    if (url === null) return

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  async function uploadImage(file: File) {
    setUploading(true)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${leagueId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from('article-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      alert(error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('article-images')
      .getPublicUrl(path)

    if (data.publicUrl) {
      editor?.chain().focus().setImage({ src: data.publicUrl }).run()
    }

    setUploading(false)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-t-2xl border border-zinc-800 bg-zinc-900 p-3">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={17} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={17} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Bullet List"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Numbered List"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={17} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Link"
          active={editor.isActive('link')}
          onClick={setLink}
        >
          <LinkIcon size={17} />
        </ToolbarButton>

        <ToolbarButton
          label={uploading ? 'Uploading...' : 'Image'}
          active={false}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={17} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          label="Undo"
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo size={17} />
        </ToolbarButton>

        <ToolbarButton
          label="Redo"
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo size={17} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) uploadImage(file)
          event.target.value = ''
        }}
      />

      {uploading && (
        <p className="mt-2 text-sm font-bold text-emerald-400">
          Uploading image...
        </p>
      )}
    </div>
  )
}

function ToolbarButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-black ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-zinc-950'
          : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-emerald-500'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="mx-1 hidden h-10 w-px bg-zinc-800 sm:block" />
}