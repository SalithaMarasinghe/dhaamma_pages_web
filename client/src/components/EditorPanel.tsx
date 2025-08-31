import { Editor, EditorContent } from '@tiptap/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState, useCallback } from 'react';
import { ImageModal } from './ImageModal';
import { uploadImage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function EditorPanel({
  title,
  titleInput,
  onTitleChange,
  editor,
  loading,
  saving,
  onExportPDF,
  fileInputRef,
  onImageUpload,
  uploading,
  onBack,
  onSave,
  saveStatus,
  hasUnsavedChanges,
}: {
  title: string;
  titleInput: string;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  editor: Editor | null;
  loading: boolean;
  saving: boolean;
  onExportPDF: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  onBack: () => void;
  onSave: () => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasUnsavedChanges: boolean;
}) {
  // Add keyboard event listener for Ctrl+Alt+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Alt+A
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (editor) {
          // Select all content
          editor.commands.selectAll();
          // Add a temporary highlight class
          const view = editor.view;
          view.dom.classList.add('tiptap-selecting-all');
          // Remove the highlight after a short delay
          setTimeout(() => {
            view.dom.classList.remove('tiptap-selecting-all');
          }, 500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  // Add styles to the head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Style for the editor when all text is selected */
      .tiptap-selecting-all .ProseMirror *::selection {
        background-color: rgba(59, 130, 246, 0.5) !important;
        color: inherit !important;
      }
      /* Ensure selection is visible */
      .ProseMirror *::selection {
        background-color: rgba(59, 130, 246, 0.3) !important;
        color: inherit !important;
      }
      /* Image styles */
      .ProseMirror img {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .ProseMirror img:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pastedImages, setPastedImages] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  // Handle pasted images from clipboard
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    console.log('Paste event triggered');
    const items = event.clipboardData?.items;
    console.log('Clipboard items:', Array.from(items || []).map(i => ({
      type: i.type,
      kind: i.kind
    })));
    
    if (!items || !editor || !user?.uid) {
      console.log('Missing required data - items:', !!items, 'editor:', !!editor, 'user.uid:', user?.uid);
      return;
    }

    // Check for images first
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        console.log('Found image in clipboard');
        event.preventDefault();
        event.stopPropagation();
        
        const file = item.getAsFile();
        if (!file) {
          console.log('Could not get file from clipboard item');
          continue;
        }
        
        console.log('Processing image file:', file.name, file.type, file.size);
        setIsUploading(true);
        
        try {
          // Create a temporary object URL for the pasted image
          const tempUrl = URL.createObjectURL(file);
          console.log('Created temp URL:', tempUrl);
          
          // Create image element to get dimensions
          const img = new Image();
          
          // Use Promise to handle image loading
          const imageLoadPromise = new Promise<{width: number, height: number}>((resolve) => {
            img.onload = () => {
              // Calculate dimensions maintaining aspect ratio
              const maxWidth = 800;
              const aspectRatio = img.width / img.height;
              const width = Math.min(maxWidth, img.width);
              const height = width / aspectRatio;
              resolve({ width: Math.round(width), height: Math.round(height) });
            };
            img.src = tempUrl;
          });

          const { width, height } = await imageLoadPromise;

          // Insert temporary image with loading state
          editor.chain()
            .focus()
            .insertContent({
              type: 'image',
              attrs: {
                src: tempUrl,
                'data-loading': 'true',
                'data-temp': 'true',
                'data-temp-url': tempUrl, // Store temp URL for cleanup
                width,
                height,
                class: 'opacity-50 max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700'
              }
            })
            .run();
          
          console.log('Temporary image inserted, starting upload...');
          
          // Upload the image
          const imageUrl = await uploadImage(user.uid, file);
          console.log('Image uploaded, URL:', imageUrl);
          
          if (imageUrl) {
            // Track this pasted image
            setPastedImages(prev => new Set(prev).add(imageUrl));
            
            // Find and update the temporary image
            const { doc } = editor.state;
            let imagePos = -1;
            let imageNode: { attrs: any } | null = null;
            
            doc.descendants((node: any, pos: number) => {
              if (node.type.name === 'image' && node.attrs['data-temp-url'] === tempUrl) {
                imagePos = pos;
                imageNode = node;
                return false;
              }
              return true;
            });
            
            if (imagePos >= 0 && imageNode) {
              console.log('Found temporary image at position:', imagePos);
              
              // Update the image with the final URL while preserving dimensions
              editor.chain()
                .focus()
                .command(({ tr }) => {
                  tr.setNodeMarkup(imagePos, undefined, {
                    src: imageUrl,
                    'data-fullsize': imageUrl,
                    'data-loading': 'false',
                    'data-temp': 'false',
                    'data-storage-path': imageUrl,
                    width: imageNode?.attrs?.width,
                    height: imageNode?.attrs?.height,
                    class: 'max-w-full h-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'
                  });
                  return true;
                })
                .run();
              
              console.log('Image updated with final URL');
              
              // Clean up the temporary URL after a delay to ensure the new image has loaded
              setTimeout(() => {
                URL.revokeObjectURL(tempUrl);
                console.log('Temporary URL revoked');
              }, 1000);
            } else {
              console.warn('Could not find temporary image in document');
              // Clean up temp URL
              URL.revokeObjectURL(tempUrl);
            }
          } else {
            // Clean up temp URL if upload failed
            URL.revokeObjectURL(tempUrl);
          }
        } catch (error) {
          console.error('Error pasting image:', error);
          toast({
            title: 'Error',
            description: 'Failed to paste image. Please try again.',
            variant: 'destructive',
          });
          
          // Try to clean up any temporary images
          editor.chain().focus().command(({ tr }) => {
            const { doc } = tr;
            let found = false;
            
            doc.descendants((node, pos) => {
              if (node.type.name === 'image' && node.attrs['data-loading'] === 'true') {
                tr.delete(pos, pos + node.nodeSize);
                found = true;
                return false;
              }
              return true;
            });
            
            if (found) {
              tr.scrollIntoView();
            }
            return found;
          }).run();
        } finally {
          setIsUploading(false);
        }
        
        return; // Stop after handling the first image
      }
    }
    
    // If we get here, no image was found in the clipboard
    console.log('No image found in clipboard, allowing default paste behavior');
  }, [editor, user?.uid, toast]);

  // Function to check for deleted pasted images and clean them up from storage
  const cleanupDeletedImages = useCallback(async () => {
    if (!editor || !user?.uid || pastedImages.size === 0) return;

    // Get all current image URLs in the document
    const currentImages = new Set<string>();
    const { doc } = editor.state;
    
    doc.descendants((node: any) => {
      if (node.type.name === 'image' && node.attrs.src) {
        const src = node.attrs.src;
        const storagePath = node.attrs['data-storage-path'];
        if (storagePath) {
          currentImages.add(storagePath);
        } else if (src.includes('firebase') || src.includes('storage')) {
          currentImages.add(src);
        }
      }
    });

    // Find images that were pasted but are no longer in the document
    const imagesToDelete = Array.from(pastedImages).filter(url => !currentImages.has(url));
    
    if (imagesToDelete.length > 0) {
      console.log('Found deleted pasted images to clean up:', imagesToDelete);
      
      // Import deleteImage function dynamically
      try {
        const { deleteImage } = await import('@/lib/firebase');
        
        // Delete each orphaned image from storage
        const deletePromises = imagesToDelete.map(async (imageUrl) => {
          try {
            // Extract path from Firebase storage URL or use the URL as path
            let imagePath = imageUrl;
            if (imageUrl.includes('firebase')) {
              // Extract the path from Firebase storage URL
              const urlParts = imageUrl.split('/o/');
              if (urlParts.length > 1) {
                imagePath = decodeURIComponent(urlParts[1].split('?')[0]);
              }
            }
            
            await deleteImage(imagePath);
            console.log('Deleted orphaned image:', imageUrl);
          } catch (error) {
            console.error('Failed to delete orphaned image:', imageUrl, error);
          }
        });
        
        await Promise.all(deletePromises);
        
        // Update the pasted images set to remove deleted ones
        setPastedImages(prev => {
          const updated = new Set(prev);
          imagesToDelete.forEach(url => updated.delete(url));
          return updated;
        });
        
        if (imagesToDelete.length > 0) {
          console.log(`Cleaned up ${imagesToDelete.length} orphaned pasted images`);
        }
      } catch (error) {
        console.error('Error importing deleteImage function:', error);
      }
    }
  }, [editor, user?.uid, pastedImages]);

  // Add cleanup to the save process
  const handleSaveWithCleanup = useCallback(async () => {
    await cleanupDeletedImages();
    await onSave();
  }, [cleanupDeletedImages, onSave]);

  // Handle image click in the editor
  const handleEditorClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG') {
      event.preventDefault();
      const fullSizeSrc = target.getAttribute('data-fullsize') || target.getAttribute('src');
      if (fullSizeSrc) {
        setSelectedImage(fullSizeSrc);
      }
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border flex-shrink-0">
        <div className="max-w-[2000px] mx-auto w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
                <i className="fas fa-arrow-left"></i>
              </Button>
              <div className="flex-1 max-w-2xl">
                <Input
                  type="text"
                  value={titleInput}
                  onChange={onTitleChange}
                  placeholder="Untitled"
                  className="text-2xl font-bold p-0 border-0 shadow-none focus-visible:ring-0 w-full"
                />
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveWithCleanup} 
                disabled={saving || !hasUnsavedChanges}
                className={!hasUnsavedChanges ? 'opacity-50' : ''}
              >
                <i className="fas fa-save mr-2"></i>
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPDF} disabled={!editor}>
                <i className="fas fa-file-pdf mr-2"></i>
                Export PDF
              </Button>
            </div>
          </div>
        </div>
        
        {/* Sticky Toolbar */}
        <div className="bg-background border-t border-border">
          <div className="max-w-[2000px] mx-auto w-full px-2">
            <div className="flex flex-wrap items-center gap-1 py-1">
              <ImageModal src={selectedImage} onClose={closeModal} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={editor?.isActive('bold') ? 'bg-muted' : ''}
              title="Bold (Ctrl+B)"
            >
              <i className="fas fa-bold"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={editor?.isActive('italic') ? 'bg-muted' : ''}
              title="Italic (Ctrl+I)"
            >
              <i className="fas fa-italic"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={editor?.isActive('underline') ? 'bg-muted' : ''}
              title="Underline (Ctrl+U)"
            >
              <i className="fas fa-underline"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className={editor?.isActive('strike') ? 'bg-muted' : ''}
              title="Strike (Ctrl+Shift+S)"
            >
              <i className="fas fa-strikethrough"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleCode().run()}
              className={editor?.isActive('code') ? 'bg-muted' : ''}
              title="Code (Ctrl+`)"
            >
              <i className="fas fa-code"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor?.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
              title="Heading 1"
            >
              H1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              title="Heading 2"
            >
              H2
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
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              className={editor?.isActive('codeBlock') ? 'bg-muted' : ''}
              title="Code Block"
            >
              <i className="fas fa-file-code"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={editor?.isActive('blockquote') ? 'bg-muted' : ''}
              title="Blockquote"
            >
              <i className="fas fa-quote-right"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              title="Horizontal Line"
            >
              <i className="fas fa-minus"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              title="Undo (Ctrl+Z)"
            >
              <i className="fas fa-undo"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              title="Redo (Ctrl+Y)"
            >
              <i className="fas fa-redo"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!editor || uploading}
              title="Insert Image"
              className="relative"
            >
              <i className="fas fa-image"></i>
              {uploading && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </Button>
          </div>
        </div>
      </div>

      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="max-w-4xl mx-auto w-full p-6">
          <div 
            onClick={handleEditorClick} 
            onPaste={handlePaste}
            className="focus:outline-none"
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <EditorContent
                editor={editor}
                className="min-h-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onImageUpload}
      />
    </div>
  );
}