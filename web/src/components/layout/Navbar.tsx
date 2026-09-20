import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Shield,
  ChevronDown
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function Navbar() {
  const { user, profile, isAdmin, isAuthenticated, signInWithGoogle, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const closeProfileMenu = useCallback(() => setIsProfileMenuOpen(false), []);

  // Click-outside + Escape key for profile dropdown
  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node) &&
        profileButtonRef.current && !profileButtonRef.current.contains(e.target as Node)
      ) {
        closeProfileMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeProfileMenu();
        profileButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileMenuOpen, closeProfileMenu]);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/logo.svg" alt="BlackPearl" className="h-8 w-8 object-contain color-[hsl(var(--primary))]" />
              <span className="text-xl font-bold text-primary hidden sm:block">BlackPearl</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/deals" className="text-muted-foreground hover:text-foreground transition-colors">
              Tour Deals
            </Link>
            <Link to="/build-package" className="text-muted-foreground hover:text-foreground transition-colors">
              Build Package
            </Link>
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <NotificationBell />
                <div className="relative">
                <button
                  ref={profileButtonRef}
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="hidden sm:block">{profile?.full_name || 'User'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {isProfileMenuOpen && (
                  <div
                    ref={profileMenuRef}
                    role="menu"
                    className="absolute right-0 mt-2 w-48 bg-background rounded-md shadow-lg py-1 border border-border"
                  >
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <Button onClick={signInWithGoogle}>
                Sign in with Google
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/deals"
              className="block px-3 py-2 text-muted-foreground hover:bg-accent rounded-md"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Tour Deals
            </Link>
            <Link
              to="/build-package"
              className="block px-3 py-2 text-muted-foreground hover:bg-accent rounded-md"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Build Package
            </Link>
            
            {isAuthenticated ? (
              <>
                <div className="px-3 py-2">
                  <NotificationBell />
                </div>
                <Link
                  to="/profile"
                  className="block px-3 py-2 text-muted-foreground hover:bg-accent rounded-md"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                  className="block px-3 py-2 text-muted-foreground hover:bg-accent rounded-md"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Admin Panel
                </Link>
                )}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="block w-full text-left px-3 py-2 text-muted-foreground hover:bg-accent rounded-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="px-3 py-2">
                <Button onClick={signInWithGoogle} className="w-full">
                  Sign in with Google
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
