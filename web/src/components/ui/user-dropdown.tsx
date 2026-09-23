import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, LayoutDashboard, LogOut, Monitor, Moon, Palette, Sun, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type UserDropdownTheme = 'light' | 'dark' | 'system';

/** Every menu entry funnels through one action union so callers can switch on it. */
export type UserDropdownAction = 'profile' | 'admin' | 'help' | 'logout' | 'signin';

export interface UserDropdownUser {
  name?: string;
  /** Second line under the name — the account email, or a hint when signed out. */
  username?: string;
  avatar?: string | null;
  initials?: string;
}

export interface UserDropdownProps {
  user?: UserDropdownUser;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  theme?: UserDropdownTheme;
  onThemeChange?: (theme: UserDropdownTheme) => void;
  onAction?: (action: UserDropdownAction) => void;
  className?: string;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  action: UserDropdownAction;
}

const PROFILE_ITEMS: MenuItem[] = [
  { icon: User, label: 'Your profile', action: 'profile' },
  { icon: HelpCircle, label: 'Help & Support', action: 'help' },
];

const ADMIN_ITEMS: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Admin', action: 'admin' },
];

const THEME_OPTIONS: { value: UserDropdownTheme; icon: LucideIcon; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function UserDropdown({
  user = {},
  isAuthenticated = false,
  isAdmin = false,
  theme = 'system',
  onThemeChange,
  onAction,
  className,
}: UserDropdownProps) {
  // The panel is 310px: on a phone there is no room for a right-side
  // submenu (Radix flips it left, off-screen), so render the theme options
  // inline like the old menu did; wider screens get the design's submenu.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 560);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 560);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const resolvedUser = {
    name: user.name ?? (isAuthenticated ? 'User' : 'Guest'),
    username: user.username ?? (isAuthenticated ? '' : 'Sign in to access your profile'),
    avatar: user.avatar ?? null,
    initials: user.initials ?? 'G',
  };

  const badgeText = isAdmin ? 'Admin' : isAuthenticated ? 'Member' : 'Guest';

  const renderMenuItem = (item: MenuItem) => (
    <DropdownMenuItem
      key={item.action}
      className="cursor-pointer rounded-lg p-2"
      onClick={() => onAction?.(item.action)}
    >
      <span className="flex items-center gap-1.5 font-medium">
        <item.icon className="size-5 text-gray-500 dark:text-gray-400" />
        {item.label}
      </span>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar
          tabIndex={0}
          aria-label="Account menu"
          className="!size-11 cursor-pointer rounded-lg border border-white after:rounded-lg dark:border-gray-700"
        >
          <AvatarImage className="rounded-lg" src={resolvedUser.avatar ?? undefined} alt={resolvedUser.name} />
          <AvatarFallback className="rounded-lg">{resolvedUser.initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn('no-scrollbar w-[310px] rounded-lg bg-gray-50 p-0 dark:bg-black/90', className)}
      >
        {/* No backdrop-blur here: a backdrop-filter forces the panel onto its
            own GPU layer, which disables ClearType subpixel text rendering and
            makes every label look fuzzy. The section is opaque anyway. */}
        <section className="rounded-lg border border-gray-200 bg-white p-1 shadow dark:border-gray-700/20 dark:bg-gray-100/10">
          <div className="flex items-center p-2">
            <div className="flex flex-1 items-center gap-2">
              <Avatar className="size-10 border border-white dark:border-gray-700">
                <AvatarImage src={resolvedUser.avatar ?? undefined} alt={resolvedUser.name} />
                <AvatarFallback>{resolvedUser.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {resolvedUser.name}
                </h3>
                <p className="truncate text-xs text-muted-foreground">{resolvedUser.username}</p>
              </div>
            </div>
            <Badge
              className={cn(
                'rounded-full border-[0.5px] text-[11px] capitalize',
                isAdmin
                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/50 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              {badgeText}
            </Badge>
          </div>

          {/* Same sub-radio pattern the design uses for status, pointed at
              the theme — inlined on narrow screens where it can't fit. */}
          {narrow ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-muted-foreground">
                <Palette className="size-4" />
                Appearance
              </DropdownMenuLabel>
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-lg p-2',
                    theme === option.value && 'bg-accent text-accent-foreground',
                  )}
                  onClick={() => onThemeChange?.(option.value)}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <option.icon className="size-5 text-gray-500 dark:text-gray-400" />
                    {option.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer rounded-lg p-2">
                  <span className="flex items-center gap-1.5 font-medium text-gray-500 dark:text-gray-400">
                    <Palette className="size-5 text-gray-500 dark:text-gray-400" />
                    Appearance
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-lg bg-white dark:bg-white/10">
                    <DropdownMenuRadioGroup
                      value={theme}
                      onValueChange={(value) => onThemeChange?.(value as UserDropdownTheme)}
                    >
                      {THEME_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} className="gap-2" value={option.value}>
                          <option.icon className="size-5 text-gray-500 dark:text-gray-400" />
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuGroup>{PROFILE_ITEMS.map(renderMenuItem)}</DropdownMenuGroup>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>{ADMIN_ITEMS.map(renderMenuItem)}</DropdownMenuGroup>
            </>
          )}
        </section>

        <section className="mt-1 rounded-lg p-1">
          <DropdownMenuGroup>
            {isAuthenticated ? (
              renderMenuItem({ icon: LogOut, label: 'Log out', action: 'logout' })
            ) : (
              <DropdownMenuItem
                className="cursor-pointer rounded-lg p-2"
                onClick={() => onAction?.('signin')}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-gray-500 dark:text-gray-400">
                    <GoogleIcon />
                  </span>
                  Sign in with Google
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserDropdown;
