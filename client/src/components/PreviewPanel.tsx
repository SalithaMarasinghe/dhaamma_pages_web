import { Editor } from '@tiptap/react';

export function PreviewPanel({ editor, title }: { editor: Editor | null; title: string }) {
  return (
    <div className="h-full overflow-auto bg-muted/20 p-8">
      <div className="bg-background rounded-lg shadow-sm p-8 min-h-full">
        <h1 className="text-3xl font-bold mb-6">{title || 'Untitled'}</h1>
        <div 
          className="prose max-w-none"
          dangerouslySetInnerHTML={{
            __html: editor?.getHTML() || '<p>Start typing to see the preview...</p>'
          }}
        />
      </div>
    </div>
  );
}
