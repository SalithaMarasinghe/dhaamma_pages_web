// useEditor.tsx - Final cleaned version with proper types
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

// Extract Firebase storage path from URL
function extractStoragePathFromUrl(url: string): string | null {
  try {
    if (url.includes('firebasestorage.googleapis.com') || (url.includes('firebase') && url.includes('token='))) {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) return decodeURIComponent(pathMatch[1]);
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const pendingUploads = useRef<Map<string, Promise<{ url: string; path: string }>>>(new Map());
  const contentLoaded = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const previousImages = useRef<Set<string>>(new Set());
  const autoSaveInterval = useRef<NodeJS.Timeout | null>(null);

  // Track and cleanup deleted images
  const trackImagesAndCleanup = useCallback(async (currentContent: any) => {
    if (!user?.uid) return;
    const currentImages = new Set<string>();

    const extractImages = (node: any) => {
      // Track both temporary and non-temporary images, but only cleanup non-temporary ones
      if (node.type === 'image' && node.attrs?.src) {
        const src = node.attrs.src;
        if (src.includes('firebasestorage.googleapis.com') || 
            (src.includes('firebase') && src.includes('token='))) {
          currentImages.add(src);
        }
      }
      if (node.content) node.content.forEach(extractImages);
    };
    
    extractImages(currentContent);

    // Only clean up images that were in the previous content but not in the current content
    const deletedImages = Array.from(previousImages.current).filter(url => !currentImages.has(url));

    for (const imageUrl of deletedImages) {
      try {
        // Only delete if it's not a temporary image
        if (!imageUrl.includes('blob:')) {  // Skip blob URLs (temporary ones)
          const storagePath = extractStoragePathFromUrl(imageUrl);
          if (storagePath) {
            console.log('Deleting image from storage:', storagePath);
            await deleteImage(storagePath);
          }
        }
      } catch (error) {
        console.error('Error deleting image from storage:', error);
      }
    }

    // Only keep track of non-temporary image URLs
    const nonTempImages = new Set<string>();
    currentImages.forEach(url => {
      if (!url.includes('blob:')) {  // Skip blob URLs (temporary ones)
        nonTempImages.add(url);
      }
    });

    previousImages.current = nonTempImages;
  }, [user?.uid]);

  // Manual save
  const saveContent = useCallback(async () => {
    if (!pageId || !user?.uid || !editorRef.current) return;

    try {
      setSaving(true);
      setSaveStatus('saving');

      const content = editorRef.current.getJSON();
      await trackImagesAndCleanup(content);
      await updatePage(user.uid, pageId, { content });

      setPage(prev => prev ? { ...prev, content } : null);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving page:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [pageId, user?.uid, trackImagesAndCleanup]);

  // Auto-save every 10 minutes
  const autoSaveContent = useCallback(async () => {
    if (!hasUnsavedChanges || !pageId || !user?.uid || !editorRef.current) return;
    try {
      const content = editorRef.current.getJSON();
      await trackImagesAndCleanup(content);
      await updatePage(user.uid, pageId, { content });
      setPage(prev => prev ? { ...prev, content } : null);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error auto-saving page:', error);
    }
  }, [pageId, user?.uid, trackImagesAndCleanup, hasUnsavedChanges]);

  useEffect(() => {
    if (autoSaveInterval.current) clearInterval(autoSaveInterval.current);
    autoSaveInterval.current = setInterval(autoSaveContent, 10 * 60 * 1000);
    return () => { if (autoSaveInterval.current) clearInterval(autoSaveInterval.current); };
  }, [autoSaveContent]);

  // Load page data
  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      if (!pageId || !user?.uid) { if (isMounted) setLoading(false); return; }

      try {
        if (isMounted) setLoading(true);
        const pageData = await getPage(user.uid, pageId);

        if (isMounted && pageData) {
          setPage(pageData);
          setTitle(pageData.title || '');

          if (editorRef.current && pageData.content) {
            const content = typeof pageData.content === 'string' ? JSON.parse(pageData.content) : pageData.content;
            editorRef.current.commands.setContent(content);
            contentLoaded.current = true;

            const initialImages = new Set<string>();
            const extractImages = (node: any) => {
              if (node.type === 'image' && node.attrs?.src && !node.attrs?.['data-temp']) {
                if (node.attrs.src.includes('firebasestorage.googleapis.com') || 
                    (node.attrs.src.includes('firebase') && node.attrs.src.includes('token='))) {
                  initialImages.add(node.attrs.src);
                }
              }
              if (node.content) node.content.forEach(extractImages);
            };
            extractImages(content);
            previousImages.current = initialImages;
          }
        }
      } catch (error) {
        console.error('Error loading page:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPage();
    return () => { isMounted = false; };
  }, [pageId, user?.uid]);

  // Image upload
  const handleImageUpload = useCallback(async (file: File): Promise<{ url: string; path: string }> => {
    if (!user?.uid) throw new Error('User not authenticated');
    return await uploadImage(user.uid, file);
  }, [user?.uid]);

  // Initialize editor
  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1,2,3] } }),
      Image.extend({
        addAttributes() {
          return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            'data-temp': { default: null, renderHTML: (attributes: Record<string, any>) => ({ 'data-temp': attributes['data-temp'] }) },
            'data-upload-id': { default: null, renderHTML: (attributes: Record<string, any>) => ({ 'data-upload-id': attributes['data-upload-id'] }) },
            'data-storage-path': { default: null, renderHTML: (attributes: Record<string, any>) => ({ 'data-storage-path': attributes['data-storage-path'] }) }
          };
        },
        group: 'block',
        draggable: true,
      }).configure({ HTMLAttributes: { class: 'rounded-lg max-w-full h-auto my-6' }, allowBase64: true }),
      TextAlign.configure({ types: ['heading','paragraph','image','list_item'], defaultAlignment: 'left' }),
      TaskList.configure({ itemTypeName: 'listItem', HTMLAttributes: { class: 'not-prose' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start' } }),
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: editorInstance }) => {
      if (!contentLoaded.current) return;
      const content = editorInstance.getJSON();
      setPage(prev => prev ? { ...prev, content } : { 
        id: pageId || '', content, title: title || 'Untitled',
        userId: user?.uid || '', createdAt: new Date(), updatedAt: new Date()
      });
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
    },
    editorProps: {
      attributes: { class: 'editor-content prose mx-auto p-4', style: 'min-height:300px; width:100%; height:100%; overflow-y:auto; outline:none;' },
    },
    autofocus: true,
  });

  useEffect(() => {
    if (editor) editorRef.current = editor;
    return () => { editorRef.current = null; };
  }, [editor]);

  return {
    editor,
    loading,
    saving,
    title,
    setTitle,
    page,
    isPasting,
    hasUnsavedChanges,
    saveStatus,
    saveContent,
  };
}