import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  onSearch?: (term: string) => void;
  showSearch?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({ onSearch, showSearch = true, onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleSidebar}
            data-testid="button-sidebar-toggle"
          >
            <i className="fas fa-bars text-muted-foreground"></i>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-lotus text-primary-foreground text-sm"></i>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Dhamma Page</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="relative hidden sm:block">
              <Input
                type="text"
                placeholder="Search pages..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-64 pl-10 pr-4 bg-muted"
                data-testid="input-search-pages"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm"></i>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-2" data-testid="button-user-menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                  <AvatarFallback>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <i className="fas fa-chevron-down text-muted-foreground text-xs"></i>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-4 py-2">
                <p className="text-sm font-medium" data-testid="text-username">{user?.displayName || 'User'}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-email">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} data-testid="button-sign-out">
                <i className="fas fa-sign-out-alt mr-2"></i>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
