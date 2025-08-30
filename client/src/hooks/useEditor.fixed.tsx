import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor as useTiptapEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useAuth } from './useAuth';
import { getPage, updatePage, uploadImage, deleteImage, extractImagePaths } from '@/lib/firebase';
import type { Page } from '@shared/types';

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  } as T;
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
  const editorRef = useRef<Editor | null>(null);
  const contentLoaded = useRef(false);

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

  // Function to extract and delete unused images
  const deleteUnusedImages = useCallback(async (oldContent: any, newContent: any) => {
    if (!oldContent) return;
    
    try {
      const oldImagePaths = extractImagePaths(oldContent);
      const newImagePaths = extractImagePaths(newContent);
      
      console.log('Old image paths:', oldImagePaths);
      console.log('New image paths:', newImagePaths);
      
      // Find images that were in old content but not in new content
      const imagesToDelete = oldImagePaths.filter(oldPath => {
        // Normalize paths for comparison
        const normalizedOldPath = oldPath.replace(/^https:\/\/[^/]+\/v0\/b\/[^/]+/i, '')
          .replace(/^\/o\//, '')
          .replace(/\?.*$/, '');
          
        return !newImagePaths.some(newPath => {
          const normalizedNewPath = newPath.replace(/^https:\/\/[^/]+\/v0\/b\/[^/]+/i, '')
            .replace(/^\/o\//, '')
            .replace(/\?.*$/, '');
          return normalizedNewPath === normalizedOldPath;
        });
      });
      
      console.log('Images to delete:', imagesToDelete);
      
      // Delete each unused image
      for (const path of imagesToDelete) {
        try {
          let pathToDelete = path;
          
          // If it's a full URL, extract the path part
          if (path.startsWith('http')) {
            const url = new URL(path);
            const pathMatch = url.pathname.match(/\/o\/(.+?)(?:\?|$)/);
            if (pathMatch && pathMatch[1]) {
              pathToDelete = decodeURIComponent(pathMatch[1]);
            }
          }
          
          console.log('Deleting image from path:', pathToDelete);
          await deleteImage(pathToDelete);
        } catch (error) {
          console.error('Error deleting image:', path, error);
        }
      }
    } catch (error) {
      console.error('Error in deleteUnusedImages:', error);
    }
  }, []);

  // Debounced save function
  const saveContent = useCallback(debounce(async (content: any) => {
    if (!pageId || !user?.uid) return;
    
    try {
      setSaving(true);
      console.log('Saving content:', content);
      
      // Delete any images that were removed from the content
      if (page?.content) {
        await deleteUnusedImages(page.content, content);
      }
      
      await updatePage(user.uid, pageId, { content });
      
      // Update local page state
      setPage(prev => prev ? { ...prev, content } : null);
    } catch (error) {
      console.error('Error saving page:', error);
    } finally {
      setSaving(false);
    }
  }, 1000), [pageId, user?.uid]);

  // Initialize the editor with image handling
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
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-6',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList.configure({
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
    onUpdate: ({ editor: editorInstance, transaction }) => {
      if (!contentLoaded.current) return; // Don't save during initial load
      
      const content = editorInstance.getJSON();
      
      // Check if this was a delete operation
      const isDeleteOperation = transaction.steps.some(step => {
        // @ts-ignore - internal property
        return step.from !== step.to && step.slice?.content?.size === 0;
      });
      
      // Update local state immediately for better UX
      setPage(prev => {
        const updated = prev ? { ...prev, content } : { 
          id: pageId || '', 
          content, 
          title: title || 'Untitled',
          userId: user?.uid || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // If this was a delete operation, immediately save to clean up any deleted images
        if (isDeleteOperation && prev?.content) {
          deleteUnusedImages(prev.content, content).catch(console.error);
        }
        
        return updated;
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
        // Handle any specific key events if needed
        return false; // Let other key handlers work
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const { state } = view;
        
        // Check for image in clipboard
        const imageItem = items.find(item => item.type.startsWith('image/'));
        
        if (imageItem) {
          event.preventDefault();
          setIsPasting(true);
          
          const file = imageItem.getAsFile();
          if (!file || !user?.uid) {
            setIsPasting(false);
            return false;
          }
          
          // Upload the image
          const uploadPromise = uploadImage(user.uid, file)
            .then(({ url }) => {
              if (editor && !editor.isDestroyed) {
                editor.chain().focus().setImage({ src: url }).run();
              }
              return { url, path: `users/${user.uid}/${file.name}` }; // Return the correct path for the uploaded file
            })
            .catch(error => {
              console.error('Error uploading pasted image:', error);
              throw error; // Re-throw to maintain error handling in the promise chain
            })
            .finally(() => {
              setIsPasting(false);
              pendingUploads.current.delete(file.name);
            });
          
          pendingUploads.current.set(file.name, uploadPromise);
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
