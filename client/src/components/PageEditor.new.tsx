import { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor } from '@/hooks/useEditor';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Editor } from '@tiptap/react';
import { uploadImage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { EditorContent } from '@tiptap/react';

interface PageEditorProps {
  pageId: string;
}

export function PageEditor({ pageId }: PageEditorProps) {
  const { page, loading, saving, title, updateTitle, editor } = useEditor(pageId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [titleInput, setTitleInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitleInput(newTitle);
    updateTitle(newTitle);
  };

  const goBackToDashboard = () => {
    setLocation('/');
  };

  // Handle image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || !user?.uid) return;

    setUploading(true);
    try {
      const imageUrl = await uploadImage(user.uid, file);
      if (imageUrl) {
        editor.chain().focus().setImage({ src: imageUrl }).run();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [editor, pageId, toast]);

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!editor) return;
    
    try {
      const { jsPDF } = await import('jspdf');
      
      // Create a new PDF document with better defaults
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      // Add content to PDF
      pdf.html(editor.getHTML(), {
        callback: (pdf) => {
          // Save the PDF
          pdf.save(`dhamma-page-${new Date().toISOString().slice(0, 10)}.pdf`);
        },
        x: 50,
        y: 30,
        width: 500,
        windowWidth: 1000,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading && !page) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading page...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="max-w-4xl mx-auto px-6 py-8 flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Page not found</h2>
            <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
            <Button onClick={goBackToDashboard} data-testid="button-back-to-dashboard">
              Go back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={goBackToDashboard}>
              <i className="fas fa-arrow-left"></i>
            </Button>
            <h1 className="text-lg font-semibold">Page Editor</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={!editor}>
              <i className="fas fa-file-pdf mr-2"></i>
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Panel */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Input
              type="text"
              value={titleInput}
              onChange={handleTitleChange}
              placeholder="Untitled"
              className="text-2xl font-bold p-0 border-0 shadow-none focus-visible:ring-0 w-full"
            />
            <div className="text-sm text-muted-foreground mt-1">
              {saving ? 'Saving...' : 'Saved'}
            </div>
          </div>

          {/* Editor Toolbar */}
          <div className="p-2 border-b border-border flex items-center gap-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={editor?.isActive('bold') ? 'bg-muted' : ''}
              title="Bold"
            >
              <i className="fas fa-bold"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={editor?.isActive('italic') ? 'bg-muted' : ''}
              title="Italic"
            >
              <i className="fas fa-italic"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
              title="Bullet List"
            >
              <i className="fas fa-list-ul"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
              title="Numbered List"
            >
              <i className="fas fa-list-ol"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              title="Heading"
            >
              <i className="fas fa-heading"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Insert Image"
            >
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-image'}`}></i>
            </Button>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <EditorContent editor={editor} className="h-full" />
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 bg-muted/20 p-8 overflow-auto">
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
      </div>

      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
      />
    </div>
  );
}
