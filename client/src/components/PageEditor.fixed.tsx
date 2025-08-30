import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditor } from '@/hooks/useEditor.fixed';
import { useLocation } from 'wouter';
import { EditorPanel } from './EditorPanel';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { uploadImage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface PageEditorProps {
  pageId: string;
}

export function PageEditor({ pageId }: PageEditorProps) {
  const { 
    loading, 
    saving, 
    title, 
    setTitle, 
    editor,
    isPasting
  } = useEditor(pageId);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [titleInput, setTitleInput] = useState(title);
  const [uploading, setUploading] = useState(false);

  // Update title input when title changes
  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitleInput(newTitle);
    setTitle(newTitle);
  }, [setTitle]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || !user?.uid) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPEG, PNG, GIF, etc.)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    
    try {
      const { url } = await uploadImage(user.uid, file);
      editor.chain().focus().setImage({ src: url }).run();
      
      toast({
        title: 'Image uploaded',
        description: 'The image has been successfully added to your document.',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error uploading image',
        description: 'There was an error uploading your image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [editor, user, toast]);

  const handleExportPDF = useCallback(() => {
    if (!editor) return;
    
    const content = editor.getHTML();
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Could not open print window. Please check your popup settings.',
        variant: 'destructive',
      });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Exported Document'}</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                max-width: 21cm;
                margin: 0 auto;
                padding: 20px;
              }
              h1, h2, h3, h4, h5, h6 { 
                margin-top: 1.5em;
                margin-bottom: 0.5em;
                line-height: 1.2;
              }
              img { 
                max-width: 100%; 
                height: auto; 
                margin: 10px 0;
              }
              .ProseMirror {
                outline: none;
              }
              .ProseMirror:focus {
                outline: none;
              }
              .ProseMirror p {
                margin: 0 0 1em 0;
              }
              .ProseMirror ul, .ProseMirror ol {
                padding-left: 1.5em;
                margin: 0.5em 0;
              }
              .ProseMirror li {
                margin: 0.25em 0;
              }
              .ProseMirror pre {
                background: #f5f5f5;
                padding: 1em;
                border-radius: 4px;
                overflow-x: auto;
              }
              .ProseMirror blockquote {
                border-left: 3px solid #ddd;
                margin: 0.5em 0;
                padding-left: 1em;
                color: #666;
              }
              .ProseMirror img {
                max-width: 100%;
                height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="ProseMirror">
            ${content}
          </div>
          <script>
            // Close the window after printing
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }, [editor, title, toast]);

  const handleBack = useCallback(() => {
    setLocation('/dashboard');
  }, [setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <EditorPanel
        title={title}
        titleInput={titleInput}
        onTitleChange={handleTitleChange}
        editor={editor}
        loading={loading}
        saving={saving || uploading}
        onExportPDF={handleExportPDF}
        fileInputRef={fileInputRef}
        onImageUpload={handleImageUpload}
        uploading={uploading || isPasting}
        onBack={handleBack}
      />
    </div>
  );
}

export default PageEditor;
