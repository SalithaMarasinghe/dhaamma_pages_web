import { useEffect, useState, useCallback } from 'react';
import { useEditor as useTiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useAuth } from './useAuth';
import { getPage, updatePage, deleteImage, extractImagePaths, uploadImage } from '@/lib/firebase';
import type { Page } from '@shared/types';

export function useEditor(pageId: string | null) {
  const { user } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [usedImagePaths, setUsedImagePaths] = useState<Set<string>>(new Set());
  const [isPasting, setIsPasting] = useState(false);

  const { user } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: 'my-2',
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            class: 'my-2',
          },
        },
        heading: {
          HTMLAttributes: {
            class: 'my-4',
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: 'my-3',
          },
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-6',
        },
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image'],
        defaultAlignment: 'left',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'editor-content prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
        style: 'min-height: 300px; width: 100%; height: 100%; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;',
      },
      scrollThreshold: 100,
      scrollMargin: 20,
      handlePaste: (view, event) => {
        if (!event.clipboardData) return false;
        
        const items = Array.from(event.clipboardData.items);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        
        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (!file) return false;
          
          setIsPasting(true);
          
          // Create a temporary image URL for preview
          const tempUrl = URL.createObjectURL(file);
          
          // Insert the image with temp URL first
          const { state, dispatch } = view;
          const { tr } = state;
          
          const imageNode = state.schema.nodes.image.create({
            src: tempUrl,
            'data-temp': 'true',
            alt: 'Uploading...',
            class: 'opacity-50 max-w-full h-auto my-4'
          });
          
          tr.replaceSelectionWith(imageNode);
          dispatch(tr);
          
          // Process the upload in the background
          (async () => {
            try {
              if (!user?.uid) throw new Error('User not authenticated');
              
              // Upload the image
              const { url } = await uploadImage(user.uid, file);
              
              // Create a new transaction to update the image
              const updateTr = view.state.tr;
              
              // Find our specific image node using the temp URL
              let imagePos = -1;
              updateTr.doc.descendants((node, pos) => {
                if (node.type.name === 'image' && node.attrs.src === tempUrl) {
                  imagePos = pos;
                  return false;
                }
                return true;
              });
              
              if (imagePos !== -1) {
                // Update the image with the uploaded URL
                updateTr.setNodeMarkup(imagePos, undefined, {
                  src: url,
                  'data-temp': undefined,
                  alt: 'Pasted image',
                  class: 'max-w-full h-auto my-4 rounded-lg'
                });
                view.dispatch(updateTr);
                
                // Update used image paths for cleanup
                setUsedImagePaths(prev => new Set([...prev, url]));
              }
            } catch (error) {
              console.error('Error uploading pasted image:', error);
              
              // Remove the temporary image if upload fails
              const errorTr = view.state.tr;
              let imagePos = -1;
              
              errorTr.doc.descendants((node, pos) => {
                if (node.type.name === 'image' && node.attrs.src === tempUrl) {
                  imagePos = pos;
                  return false;
                }
                return true;
              });
              
              if (imagePos !== -1) {
                errorTr.delete(imagePos, imagePos + 1);
                view.dispatch(errorTr);
              }
            } finally {
              // Clean up the temporary URL
              URL.revokeObjectURL(tempUrl);
              setIsPasting(false);
            }
          })();
          
          return true;
        }
        
        return false;
      },
      handleDOMEvents: {
        // Let the browser handle all wheel events
        wheel: () => false,
        
        // Let the browser handle all mouse events
        mousedown: () => false,
        mouseup: () => false,
        mousemove: () => false,
        
        // Let the browser handle all touch events
        touchstart: () => false,
        touchmove: () => false,
        touchend: () => false,
        
        // Let the browser handle all keyboard events
        keydown: () => false,
        keyup: () => false,
        
        // Handle selection changes
        selectionUpdate: (view) => {
          if (!view.hasFocus()) return false;
          
          const { state } = view;
          const { selection } = state;
          
          if (!selection.empty) {
            requestAnimationFrame(() => {
              const { from, to } = selection;
              const start = view.coordsAtPos(from);
              const end = view.coordsAtPos(to, -1);
              const editor = view.dom;
              const editorRect = editor.getBoundingClientRect();
              
              // Check if selection is outside the visible area
              if (start.top < editorRect.top + 50) {
                // Scroll up to show selection
                editor.scrollTop += (start.top - editorRect.top - 50);
              } else if (end.bottom > editorRect.bottom - 50) {
                // Scroll down to show selection
                editor.scrollTop += (end.bottom - editorRect.bottom + 50);
              }
            });
          }
          return false;
        },
      },
    },
    autofocus: true,
    enableInputRules: true,
    enablePasteRules: true,
    enableCoreExtensions: true,
  });

  // Function to delete unused images when page is saved
  const deletePageImages = useCallback(async (content: any) => {
    if (!user?.uid || !pageId) return;
    
    try {
      // Get all image paths currently in use
      const currentImagePaths = extractImagePaths(content);
      const currentPathsSet = new Set(currentImagePaths);
      
      // Find images that were previously used but are no longer in the content
      const imagesToDelete = Array.from(usedImagePaths).filter(
        path => !currentPathsSet.has(path)
      );
      
      // Delete unused images from storage
      await Promise.all(imagesToDelete.map(path => deleteImage(path)));
      
      // Update the set of used image paths
      setUsedImagePaths(new Set(currentImagePaths));
    } catch (error) {
      console.error('Error cleaning up images:', error);
    }
  }, [user?.uid, pageId, usedImagePaths]);

  // Load page data when component mounts or pageId changes
  useEffect(() => {
    const loadPage = async () => {
      if (!user?.uid || !pageId) return;
      
      setLoading(true);
      try {
        const pageData = await getPage(user.uid, pageId);
        if (pageData) {
          setPage(pageData);
          setTitle(pageData.title);
          
          // Extract and store image paths from content
          if (pageData.content) {
            const imagePaths = extractImagePaths(pageData.content);
            setUsedImagePaths(new Set(imagePaths));
          }
          
          // Set editor content if editor is ready
          if (editor && !editor.isDestroyed) {
            editor.commands.setContent(pageData.content || '');
          }
        }
      } catch (error) {
        console.error('Error loading page:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPage();
  }, [user?.uid, pageId, editor]);

  // Save page content when it changes
  const savePageContent = useCallback(async () => {
    if (!user?.uid || !pageId || !editor || saving) return;
    
    setSaving(true);
    try {
      const content = editor.getJSON();
      
      // Clean up unused images
      await deletePageImages(content);
      
      // Save the page with updated content
      await updatePage(user.uid, pageId, {
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      
      // Update the page state
      setPage(prev => ({
        ...prev!,
        title,
        content,
        updatedAt: new Date().toISOString(),
      }));
      
      return true;
    } catch (error) {
      console.error('Error saving page:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.uid, pageId, editor, title, saving, deletePageImages]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!user?.uid || !pageId || !editor || saving) return;
    
    await savePageContent();
  }, [user?.uid, pageId, editor, saving, savePageContent]);

  // Track used images when content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const content = editor.getJSON();
      const paths = extractImagePaths(content);
      setUsedImagePaths(new Set(paths));
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // Auto-save on content change
  useEffect(() => {
    if (!editor) return;

    const timeoutId = setTimeout(() => {
      autoSave();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [editor?.state, title, autoSave]);

  // Auto-save on title change
  useEffect(() => {
    if (!title || !page) return;

    const timeoutId = setTimeout(() => {
      autoSave();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [title, autoSave, page]);

  const updateTitle = (newTitle: string) => {
    setTitle(newTitle);
  };

  return {
    editor,
    page,
    loading,
    saving,
    title,
    setTitle: updateTitle,
    deletePageImages,
    savePageContent,
  };
}
