import { useRef, useCallback, useState } from 'react';
import { useEditor } from '@/hooks/useEditor';
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
          <title>${title || 'Document'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700&display=swap');
            body { font-family: 'Noto Sans Sinhala', Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { text-align: center; margin-bottom: 30px; color: #1a1a1a; }
            img { max-width: 100%; height: auto; }
            @media print {
              @page { size: A4; margin: 1.5cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${title || 'Document'}</h1>
          <div class="content">${content}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 1000);
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    toast({
      title: 'Success',
      description: 'Opening print dialog...',
    });
  }, [editor, title, toast]);

  const handleBack = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {editor && (
          <EditorPanel
            title={title}
            titleInput={titleInput}
            onTitleChange={handleTitleChange}
            editor={editor}
            loading={loading}
            saving={saving}
            onExportPDF={handleExportPDF}
            fileInputRef={fileInputRef}
            onImageUpload={handleImageUpload}
            uploading={isPasting || uploading}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

export default PageEditor;
