import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getUserPages, createPage, updatePage, deletePage, searchPages, subscribeToPages } from '@/lib/firebase';
import type { Page, CreatePageData, UpdatePageData } from '@shared/types';
import { useToast } from './use-toast';

export function usePages() {
  const { user } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setPages([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    if (searchTerm) {
      // For search, use one-time query
      searchPages(user.uid, searchTerm)
        .then(setPages)
        .catch((error) => {
          console.error('Error searching pages:', error);
          toast({
            title: 'Error',
            description: 'Failed to search pages',
            variant: 'destructive',
          });
        })
        .finally(() => setLoading(false));
    } else {
      // For normal view, use real-time subscription
      unsubscribe = subscribeToPages(user.uid, (pagesData) => {
        setPages(pagesData);
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, searchTerm, toast]);

  const createNewPage = async (pageData: CreatePageData) => {
    if (!user) return;

    try {
      const pageId = await createPage(user.uid, pageData);
      toast({
        title: 'Success',
        description: 'Page created successfully',
      });
      return pageId;
    } catch (error) {
      console.error('Error creating page:', error);
      toast({
        title: 'Error',
        description: 'Failed to create page',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePageData = async (pageId: string, updates: UpdatePageData) => {
    if (!user) return;

    try {
      await updatePage(user.uid, pageId, updates);
    } catch (error) {
      console.error('Error updating page:', error);
      toast({
        title: 'Error',
        description: 'Failed to update page',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePageData = async (pageId: string) => {
    if (!user) return;

    try {
      await deletePage(user.uid, pageId);
      toast({
        title: 'Success',
        description: 'Page deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting page:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete page',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    pages,
    loading,
    searchTerm,
    setSearchTerm,
    createNewPage,
    updatePageData,
    deletePageData,
  };
}
