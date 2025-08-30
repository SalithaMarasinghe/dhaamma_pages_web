import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor as useTiptapEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useAuth } from './useAuth';
import { getPage, updatePage, uploadImage, deleteImage } from '@/lib/firebase';
import type { Page } from '@shared/types';

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  } as T;
}

// Helper function to extract Firebase storage path from URL
function extractStoragePathFromUrl(url: string): string | null {
  try {
    // Handle Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }
    }
    
    // Handle Firebase Storage download URLs
    if (url.includes('firebase') && url.includes('token=')) {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path from URL:', error);
    return null;
  }
}

export function useEditor(pageId: string | null) {
  const { user } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  
  // Refs
  const pendingUploads = useRef<Map<string, Promise<{ url: string; path: string }>>>(new Map());
  const contentLoaded = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const previousImages = useRef<Set<string>>(new Set());

  // Function to track and clean up deleted images
  const trackImagesAndCleanup = useCallback(async (currentContent: any) => {
    if (!user?.uid) return;

    const currentImages = new Set<string>();
    
    // Extract all image URLs from current content
    const extractImages = (node: any) => {
      if (node.type === 'image' && node.attrs?.src && !node.attrs?.['data-temp']) {
        // Only track Firebase storage URLs
        if (node.attrs.src.includes('firebasestorage.googleapis.com') || 
            (node.attrs.src.includes('firebase') && node.attrs.src.includes('token='))) {
          currentImages.add(node.attrs.src);
        }
      }
      if (node.content) {
        node.content.forEach(extractImages);
      }
    };
    
    extractImages(currentContent);

    // Find deleted images (in previous but not in current)
    const deletedImages = Array.from(previousImages.current).filter(
      url => !currentImages.has(url)
    );

    // Delete removed images from storage
    for (const imageUrl of deletedImages) {
      try {
        const storagePath = extractStoragePathFromUrl(imageUrl);
        if (storagePath) {
          await deleteImage(storagePath);
          console.log('Deleted image from storage:', storagePath);
        }
      } catch (error) {
        console.error('Error deleting image from storage:', error);
      }
    }

    // Update previous images set
    previousImages.current = currentImages;
  }, [user?.uid]);

  // Load page data when component mounts or pageId changes
  useEffect(() => {
    let isMounted = true;
    
    const loadPage = async () => {
      if (!pageId || !user?.uid) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        if (isMounted) setLoading(true);
        const pageData = await getPage(user.uid, pageId);
        
        if (isMounted && pageData) {
          console.log('Loaded page data:', pageData);
          setPage(pageData);
          setTitle(pageData.title || '');
          
          // Set initial content if editor is ready
          if (editorRef.current && pageData.content) {
            try {
              const content = typeof pageData.content === 'string' 
                ? JSON.parse(pageData.content)
                : pageData.content;
              
              // Only update if content is different
              const currentContent = editorRef.current.getJSON();
              if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
                editorRef.current.commands.setContent(content);
              }
              contentLoaded.current = true;

              // Initialize previous images tracking
              const initialImages = new Set<string>();
              const extractImages = (node: any) => {
                if (node.type === 'image' && node.attrs?.src && !node.attrs?.['data-temp']) {
                  if (node.attrs.src.includes('firebasestorage.googleapis.com') || 
                      (node.attrs.src.includes('firebase') && node.attrs.src.includes('token='))) {
                    initialImages.add(node.attrs.src);
                  }
                }
                if (node.content) {
                  node.content.forEach(extractImages);
                }
              };
              extractImages(content);
              previousImages.current = initialImages;
            } catch (error) {
              console.error('Error parsing page content:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading page:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPage();
    
    return () => {
      isMounted = false;
    };
  }, [pageId, user?.uid]);

  // Debounced save function
  const saveContent = useCallback(debounce(async (content: any) => {
    if (!pageId || !user?.uid) return;
    
    try {
      setSaving(true);
      console.log('Saving content:', content);
      
      // Track and cleanup deleted images before saving
      await trackImagesAndCleanup(content);
      
      await updatePage(user.uid, pageId, { content });
      
      // Update local page state
      setPage(prev => prev ? { ...prev, content } : null);
    } catch (error) {
      console.error('Error saving page:', error);
    } finally {
      setSaving(false);
    }
  }, 1000), [pageId, user?.uid, trackImagesAndCleanup]);

  // Function to handle image upload
  const handleImageUpload = useCallback(async (file: File): Promise<{ url: string; path: string }> => {
    if (!user?.uid) throw new Error('User not authenticated');
    
    try {
      const result = await uploadImage(user.uid, file);
      console.log('Image uploaded successfully:', result);
      return result;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }, [user?.uid]);

  // Initialize the editor
  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        // Enable all the default extensions
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Image.extend({
        addAttributes() {
          return {
            src: {
              default: null,
            },
            alt: {
              default: null,
            },
            title: {
              default: null,
            },
            'data-temp': {
              default: null,
              renderHTML: (attributes: Record<string, any>) => ({
                'data-temp': attributes['data-temp']
              })
            },
            'data-upload-id': {
              default: null,
              renderHTML: (attributes: Record<string, any>) => ({
                'data-upload-id': attributes['data-upload-id']
              })
            },
            'data-storage-path': {
              default: null,
              renderHTML: (attributes: Record<string, any>) => ({
                'data-storage-path': attributes['data-storage-path']
              })
            }
          };
        },
        group: 'block',
        draggable: true,
      }).configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-6',
        },
        inline: false,
        allowBase64: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image', 'list_item'],
        defaultAlignment: 'left',
      }),
      TaskList.configure({
        itemTypeName: 'listItem',
        HTMLAttributes: {
          class: 'not-prose',
        },
      }),
      TaskItem.configure({ 
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start',
        },
      }),
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: editorInstance }) => {
      if (!contentLoaded.current) return; // Don't save during initial load
      
      const content = editorInstance.getJSON();
      
      // Update local state immediately for better UX
      setPage(prev => prev ? { ...prev, content } : { 
        id: pageId || '', 
        content, 
        title: title || 'Untitled',
        userId: user?.uid || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Save to Firestore with debounce
      saveContent(content);
    },
    editorProps: {
      attributes: {
        class: 'editor-content prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl mx-auto focus:outline-none p-4',
        style: 'min-height: 300px; width: 100%; height: 100%; overflow-y: auto; outline: none;',
      },
      handleKeyDown: (view, event) => {
        // Handle Delete/Backspace for image nodes
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const { state } = view;
          const { selection } = state;
          
          // Check if we're deleting an image node
          const node = state.doc.nodeAt(selection.from);
          if (node && node.type.name === 'image') {
            const imageUrl = node.attrs.src;
            
            // If it's a Firebase storage image, schedule it for deletion
            if (imageUrl && !node.attrs['data-temp'] && 
                (imageUrl.includes('firebasestorage.googleapis.com') || 
                 (imageUrl.includes('firebase') && imageUrl.includes('token=')))) {
              // The cleanup will happen in the onUpdate callback via trackImagesAndCleanup
              console.log('Image will be deleted from storage:', imageUrl);
            }
          }
        }
        
        return false; // Let other key handlers work
      },
      handlePaste: (view, event) => {
        if (!event.clipboardData) return false;

        const items = Array.from(event.clipboardData.items);
        const imageItem = items.find((item) => item.type.startsWith('image/'));

        if (imageItem) {
          event.preventDefault();
          event.stopPropagation();
          const file = imageItem.getAsFile();
          if (!file || !user?.uid) return false;

          setIsPasting(true);

          // Create a temporary URL for the image
          const tempUrl = URL.createObjectURL(file);
          const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { state, dispatch } = view;
          const { tr } = state;

          // Create a temporary image node
          const imageNode = state.schema.nodes.image.create({
            src: tempUrl,
            'data-temp': 'true',
            'data-upload-id': uploadId,
            alt: 'Uploading...',
          });

          // Insert the temporary image at cursor position
          const pos = tr.selection.from;
          tr.insert(pos, imageNode);
          dispatch(tr);
          view.focus();

          // Start the upload process
          const uploadPromise = (async () => {
            try {
              const { url, path } = await handleImageUpload(file);

              // Find and update the temporary image with the permanent URL
              let updated = false;
              const currentState = view.state;
              currentState.doc.descendants((node, pos) => {
                if (node.attrs['data-upload-id'] === uploadId && !updated) {
                  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    src: url,
                    'data-temp': undefined,
                    'data-upload-id': undefined,
                    'data-storage-path': path,
                    alt: 'Uploaded image',
                  });
                  view.dispatch(tr);
                  updated = true;
                  return false;
                }
              });

              if (!updated) {
                console.warn('Could not find temporary image to update');
              }

              return { url, path };
            } catch (error) {
              console.error('Error uploading pasted image:', error);
              
              // Remove the temporary image if upload fails
              let removed = false;
              const currentState = view.state;
              currentState.doc.descendants((node, pos) => {
                if (node.attrs['data-upload-id'] === uploadId && !removed) {
                  const tr = view.state.tr.delete(pos, pos + node.nodeSize);
                  view.dispatch(tr);
                  removed = true;
                  return false;
                }
              });
              
              throw error;
            } finally {
              setIsPasting(false);
              URL.revokeObjectURL(tempUrl);
              pendingUploads.current.delete(uploadId);
            }
          })();

          // Store the upload promise
          pendingUploads.current.set(uploadId, uploadPromise);

          return true;
        }

        return false;
      },
    },
    autofocus: true,
  });

  // Store editor instance in ref
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      
      // Set initial content if we have it
      if (page?.content && !contentLoaded.current) {
        try {
          const content = typeof page.content === 'string' 
            ? JSON.parse(page.content)
            : page.content;
          editor.commands.setContent(content);
          contentLoaded.current = true;
        } catch (error) {
          console.error('Error setting initial content:', error);
        }
      }
      
      return () => {
        editorRef.current = null;
      };
    }
  }, [editor, page?.content]);

  // Update editor content when page data changes
  useEffect(() => {
    if (editor && page?.content) {
      try {
        // Get current editor content as JSON
        const currentContent = editor.getJSON();
        
        // Parse the stored content if it's a string
        const storedContent = typeof page.content === 'string' 
          ? JSON.parse(page.content) 
          : page.content;
        
        // Only update if the content is different to prevent cursor jumps
        if (JSON.stringify(currentContent) !== JSON.stringify(storedContent)) {
          // Use a small timeout to ensure the editor is ready
          const timer = setTimeout(() => {
            if (editor && !editor.isDestroyed) {
              editor.commands.setContent(storedContent);
            }
          }, 50);
          
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('Error setting initial content:', error);
      }
    }
  }, [page?.content]);

  return {
    editor,
    loading,
    saving,
    title,
    setTitle,
    page,
    isPasting,
  };
}