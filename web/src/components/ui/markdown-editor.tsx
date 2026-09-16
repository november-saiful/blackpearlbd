import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link,
  Image,
  Code,
  Quote,
  Minus,
  Eye,
  EyeOff,
  Type
} from 'lucide-react';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: (textarea: HTMLTextAreaElement) => void;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your description in markdown...',
  className,
  rows = 6,
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = useCallback(
    (before: string, after: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      const newText =
        value.substring(0, start) +
        before +
        selectedText +
        after +
        value.substring(end);

      onChange(newText);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(
          start + before.length,
          newCursorPos
        );
      }, 0);
    },
    [value, onChange]
  );

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const newText =
        value.substring(0, lineStart) + prefix + value.substring(lineStart);

      onChange(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length
        );
      }, 0);
    },
    [value, onChange]
  );

  const toolbarButtons: ToolbarButton[] = [
    {
      icon: <Bold className="w-4 h-4" />,
      label: 'Bold',
      action: () => insertMarkdown('**', '**'),
    },
    {
      icon: <Italic className="w-4 h-4" />,
      label: 'Italic',
      action: () => insertMarkdown('*', '*'),
    },
    {
      icon: <Heading1 className="w-4 h-4" />,
      label: 'Heading 1',
      action: () => insertLinePrefix('# '),
    },
    {
      icon: <Heading2 className="w-4 h-4" />,
      label: 'Heading 2',
      action: () => insertLinePrefix('## '),
    },
    {
      icon: <Heading3 className="w-4 h-4" />,
      label: 'Heading 3',
      action: () => insertLinePrefix('### '),
    },
    {
      icon: <List className="w-4 h-4" />,
      label: 'Bullet List',
      action: () => insertLinePrefix('- '),
    },
    {
      icon: <ListOrdered className="w-4 h-4" />,
      label: 'Numbered List',
      action: () => insertLinePrefix('1. '),
    },
    {
      icon: <Link className="w-4 h-4" />,
      label: 'Link',
      action: () => insertMarkdown('[', '](url)'),
    },
    {
      icon: <Image className="w-4 h-4" />,
      label: 'Image',
      action: () => insertMarkdown('![alt](', ')'),
    },
    {
      icon: <Code className="w-4 h-4" />,
      label: 'Code',
      action: () => insertMarkdown('`', '`'),
    },
    {
      icon: <Quote className="w-4 h-4" />,
      label: 'Quote',
      action: () => insertLinePrefix('> '),
    },
    {
      icon: <Minus className="w-4 h-4" />,
      label: 'Horizontal Rule',
      action: () => insertMarkdown('\n---\n'),
    },
  ];

  const renderMarkdownPreview = (text: string) => {
    // Simple markdown preview (not full-featured, but covers basics)
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto" />')
      // Horizontal rule
      .replace(/^---$/gm, '<hr class="my-4 border-border" />')
      // Lists
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/^1\. (.*$)/gm, '<li>$1</li>')
      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  };

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {toolbarButtons.map((button, index) => (
          <button
            key={index}
            type="button"
            onClick={() => button.action(textareaRef.current!)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={button.label}
          >
            {button.icon}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
              showPreview
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {showPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Edit
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <div
          className="min-h-[120px] p-3 text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-y border-0 bg-transparent p-3 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
        />
      )}

      {/* Character count */}
      <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        {value.length} characters
      </div>
    </div>
  );
}
