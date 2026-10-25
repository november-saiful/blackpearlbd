import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { IconComponent } from '@/components/ui/icons';
import { Globe, HelpCircle, LayoutDashboard, LogOut, Monitor, Moon, Palette, Sun, User } from '@/components/ui/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import type { ContentLocale } from '@/lib/locale';

export type UserDropdownTheme = 'light' | 'dark' | 'system';

/** Every menu entry funnels through one action union so callers can switch on it. */
export type UserDropdownAction = 'profile' | 'admin' | 'help' | 'logout' | 'signin';

export interface UserDropdownUser {
  name?: string;
  /** Second line under the name, the account email, or a hint when signed out. */
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
  locale?: ContentLocale;
  onLocaleChange?: (locale: ContentLocale, event: ReactMouseEvent<HTMLElement>) => void;
  onAction?: (action: UserDropdownAction) => void;
  className?: string;
}

interface MenuItem {
  icon: IconComponent;
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

const THEME_OPTIONS: { value: UserDropdownTheme; icon: IconComponent; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

const LANGUAGE_OPTIONS: { value: ContentLocale; label: string; bangla?: boolean }[] = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা', bangla: true },
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
  locale = 'en',
  onLocaleChange,
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
          className="!size-10 cursor-pointer rounded-lg border border-white after:rounded-lg dark:border-gray-700"
        >
          <AvatarImage className="rounded-lg" src={resolvedUser.avatar ?? undefined} alt={resolvedUser.name} />
          <AvatarFallback className="rounded-lg">{resolvedUser.initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn('no-scrollbar w-[310px] rounded-xl p-0', className)}
      >
        <section className="rounded-xl border border-white/45 bg-white/30 p-1 dark:border-white/10 dark:bg-white/5">
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
                  ? 'border-amber-300/60 bg-amber-300/40 text-amber-800 dark:border-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'glass-chip text-muted-foreground',
              )}
            >
              {badgeText}
            </Badge>
          </div>

          {/* One compact row instead of three stacked rows: the panel is short
              on phones, and the icons already carry the meaning. */}
          {narrow ? (
            <div className="px-2 pb-1">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Palette className="size-4" />
                Appearance
              </div>
              <div
                role="group"
                aria-label="Appearance"
                className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1"
              >
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={theme === option.value}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => onThemeChange?.(option.value)}
                    className={cn(
                      'flex items-center justify-center rounded-md py-1.5 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      theme === option.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <option.icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
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
                  <DropdownMenuSubContent className="rounded-xl">
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

          <div className="mt-1 px-2 pb-1">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Globe className="size-4" />
              Language
            </div>
            <div
              role="group"
              aria-label="Content language"
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={locale === option.value}
                  onClick={(event) => onLocaleChange?.(option.value, event)}
                  style={
                    option.bangla
                      ? {
                          fontFamily:
                            "'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif",
                        }
                      : undefined
                  }
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    locale === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

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
