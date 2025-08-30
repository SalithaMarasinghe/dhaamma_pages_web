import { ReactNode } from 'react';

interface EditorLayoutProps {
  header: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
}

export function EditorLayout({ header, editor, preview }: EditorLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        {header}
      </header>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 border-r border-border overflow-auto">
          {editor}
        </div>
        
        {/* Preview Panel */}
        <div className="w-1/2 overflow-auto">
          {preview}
        </div>
      </div>
    </div>
  );
}
