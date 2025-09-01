import { usePages } from '@/hooks/usePages';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePage: () => void;
}

export function Sidebar({ isOpen, onClose, onCreatePage }: SidebarProps) {
  const { pages } = usePages();
  const [location] = useLocation();

  const recentPages = pages.slice(0, 10);

  return (
    <aside className={cn(
      "flex flex-col w-64 bg-card border-r border-border transition-all duration-200 pt-4",
      "md:flex", // Always show on desktop
      isOpen ? "flex" : "hidden md:flex" // Show/hide on mobile based on isOpen
    )}>

      <nav className="flex-1 px-4 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
            Recent Pages
          </div>
          
          {recentPages.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-pages">
              No pages yet. Create your first page!
            </div>
          ) : (
            recentPages.map(page => (
              <Link 
                key={page.id} 
                href={`/editor/${page.id}`} 
                className={cn(
                  "sidebar-nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-muted hover:translate-x-1",
                  location === `/editor/${page.id}` && "bg-muted"
                )}
                onClick={onClose}
                data-testid={`link-page-${page.id}`}
              >
                <i className="fas fa-file-alt text-muted-foreground text-xs"></i>
                <span className="truncate">{page.title || 'Untitled'}</span>
              </Link>
            ))
          )}
        </div>
      </nav>
    </aside>
  );
}
