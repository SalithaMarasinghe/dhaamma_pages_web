import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';
import type { Page } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PageCardProps {
  page: Page;
  onDelete: (pageId: string) => void;
}

export function PageCard({ page, onDelete }: PageCardProps) {
  const getPreviewText = (content: any): string => {
    if (!content || !content.content) return '';
    
    // Extract text from Tiptap JSON structure
    const extractText = (nodes: any[]): string => {
      return nodes.map(node => {
        if (node.type === 'text') {
          return node.text || '';
        } else if (node.content) {
          return extractText(node.content);
        }
        return '';
      }).join(' ');
    };
    
    const text = extractText(content.content);
    return text.slice(0, 150) + (text.length > 150 ? '...' : '');
  };

  const calculateReadTime = (content: any): string => {
    const text = getPreviewText(content);
    const words = text.split(' ').length;
    const minutes = Math.ceil(words / 200); // Average reading speed
    return `${minutes} min read`;
  };

  const preview = getPreviewText(page.content);
  const readTime = calculateReadTime(page.content);
  const timeAgo = formatDistanceToNow(page.updatedAt, { addSuffix: true });

  return (
    <Card className="page-card cursor-pointer group transition-all hover:-translate-y-1 hover:shadow-lg" data-testid={`card-page-${page.id}`}>
      <CardContent className="p-6">
        <Link href={`/editor/${page.id}`} className="block">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-page-title-${page.id}`}>
                {page.title || 'Untitled'}
              </h3>
              {preview && (
                <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-page-preview-${page.id}`}>
                  {preview}
                </p>
              )}
            </div>
          </div>
        </Link>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between text-xs text-muted-foreground w-full">
            <span data-testid={`text-page-updated-${page.id}`}>{timeAgo}</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <i className="fas fa-clock"></i>
                <span data-testid={`text-page-readtime-${page.id}`}>{readTime}</span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 h-8 w-8 transition-opacity"
                    data-testid={`button-page-menu-${page.id}`}
                  >
                    <i className="fas fa-ellipsis-v text-sm"></i>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/editor/${page.id}`} data-testid={`link-edit-page-${page.id}`}>
                      <i className="fas fa-edit mr-2"></i>
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(page.id);
                    }}
                    className="text-destructive"
                    data-testid={`button-delete-page-${page.id}`}
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
