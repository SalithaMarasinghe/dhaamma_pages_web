import { useState } from 'react';
import { usePages } from '@/hooks/usePages';
import { useAuth } from '@/hooks/useAuth';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { PageCard } from './PageCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Dashboard() {
  const { pages, loading, searchTerm, setSearchTerm, createNewPage, deletePageData } = usePages();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPageTitle.trim()) return;
    
    try {
      setIsCreating(true);
      const pageId = await createNewPage({
        title: newPageTitle.trim(),
        content: { type: 'doc', content: [] }
      });
      
      // Navigate to the new page only if we got a valid pageId
      if (pageId) {
        setNewPageTitle('');
        setIsCreateDialogOpen(false);
        setLocation(`/editor/${pageId}`);
      }
    } catch (error) {
      console.error('Failed to create page:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (confirm('Are you sure you want to delete this page?')) {
      await deletePageData(pageId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onSearch={setSearchTerm} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex h-[calc(100vh-73px)]">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCreatePage={handleCreatePage} />
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="max-w-6xl mx-auto">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-96 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-full mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4 mb-4" />
                        <div className="flex justify-between">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const filteredPages = searchTerm 
    ? pages.filter(page => page.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : pages;

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex h-[calc(100vh-73px)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCreatePage={handleCreatePage} />
        
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              {/* Page Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your Pages</h2>
                <p className="text-muted-foreground">Create and organize your thoughts, insights, and reflections.</p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="flex items-center gap-2 h-10"
                      data-testid="button-create-page"
                    >
                      <i className="fas fa-plus"></i>
                      <span>New Page</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Page</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreatePage} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pageTitle">Page Title</Label>
                        <Input
                          id="pageTitle"
                          value={newPageTitle}
                          onChange={(e) => setNewPageTitle(e.target.value)}
                          placeholder="Enter page title"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCreateDialogOpen(false)}
                          disabled={isCreating}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={!newPageTitle.trim() || isCreating}>
                          {isCreating ? 'Creating...' : 'Create Page'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="secondary"
                  className="flex items-center gap-2 h-10"
                  data-testid="button-toggle-view"
                >
                  <i className="fas fa-th-large"></i>
                  Grid View
                </Button>
              </div>

              {/* Search Results Info */}
              {searchTerm && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground" data-testid="text-search-results">
                    {filteredPages.length} result{filteredPages.length !== 1 ? 's' : ''} for "{searchTerm}"
                  </p>
                </div>
              )}

              {/* Pages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPages.map(page => (
                  <PageCard 
                    key={page.id} 
                    page={page} 
                    onDelete={handleDeletePage}
                  />
                ))}
                
                {/* Empty State */}
                {filteredPages.length === 0 && !searchTerm && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground">No pages yet. Create your first page using the button above.</p>
                  </div>
                )}
              </div>

              {/* Empty State for Search */}
              {searchTerm && filteredPages.length === 0 && (
                <div className="text-center py-12" data-testid="empty-search-results">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-search text-muted-foreground text-xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No pages found</h3>
                  <p className="text-muted-foreground mb-4">Try adjusting your search terms</p>
                  <Button onClick={() => setSearchTerm('')} variant="outline" data-testid="button-clear-search">
                    Clear search
                  </Button>
                </div>
              )}

              {/* Empty State for No Pages */}
              {!searchTerm && pages.length === 0 && (
                <div className="text-center py-12" data-testid="empty-no-pages">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-lotus text-primary text-xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to Dhamma Page</h3>
                  <p className="text-muted-foreground mb-4">Create your first page to start your mindful note-taking journey</p>
                  <Button onClick={handleCreatePage} data-testid="button-create-first-page">
                    <i className="fas fa-plus mr-2"></i>
                    Create Your First Page
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Floating Action Button (Mobile) */}
      <Button 
        className="fixed bottom-8 right-8 md:hidden w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
        onClick={handleCreatePage}
        data-testid="button-create-page-floating"
      >
        <i className="fas fa-plus text-lg"></i>
      </Button>
    </div>
  );
}
