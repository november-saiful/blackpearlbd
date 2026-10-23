import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import Home from '@/pages/Home';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { reloadForStaleBuild } from '@/lib/preload-recovery';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ── Chunk-load recovery ───────────────────────────────────────────────────
// A tab running an older build can request a hashed chunk that a redeploy
// deleted, and a flaky network can drop the fetch outright; React.lazy turns
// either into a rejected route ("Unexpected Application Error"). Recover in
// two steps: retry once for transient failures, then reload, a fresh
// index.html only references chunks that actually exist.
//
// The reload budget lives in src/lib/preload-recovery.ts and is shared with the
// page-level `vite:preloadError` handler, so both paths together still reload
// at most a couple of times per tab. An earlier version cleared the flag
// whenever any chunk loaded successfully, which let a permanently broken asset
// reload the page forever.

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function lazyPage(factory: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch {
      // The failure may have been a transient network error. Retry once.
      await delay(700);
      try {
        return await factory();
      } catch (err) {
        // Still failing: most likely a stale chunk from a recent deploy.
        if (reloadForStaleBuild()) {
          // Stay on the Suspense fallback while the page reloads; only throw
          // once the reload budget is spent, so we can never reload-loop.
          await delay(3000);
        }
        throw err;
      }
    }
  });
}

// ── Page components ──────────────────────────────────────────────────
// Home ships with the entry bundle: it is the landing route, and as a lazy
// chunk the shell painted first and held the page skeleton for the whole
// download, measured at 80 ms on a fast link and longer on a slow one. Every
// other route stays split, and the document names the chunk its URL needs so
// the download starts before React asks for it (see routePreloadPlugin in
// vite.config.ts).
const Deals = lazyPage(() => import('@/pages/Deals'));
const DealDetailPage = lazyPage(() => import('@/pages/DealDetail'));
const BuildPackage = lazyPage(() => import('@/pages/BuildPackage'));
const ProfilePage = lazyPage(() => import('@/pages/Profile'));
const SearchResults = lazyPage(() => import('@/pages/SearchResults'));
const NotFound = lazyPage(() => import('@/pages/NotFound'));
const AuthCallback = lazyPage(() => import('@/pages/AuthCallback'));

// Admin pages are grouped into a single "admin" chunk via manualChunks,
// but each is still lazy-loaded so nothing loads until /admin is hit.
const AdminDashboard = lazyPage(() => import('@/pages/Admin/Dashboard'));
const AdminUsers = lazyPage(() => import('@/pages/Admin/Users'));
const AdminDeals = lazyPage(() => import('@/pages/Admin/Deals'));
const AdminBookings = lazyPage(() => import('@/pages/Admin/Bookings'));
const AdminCustomPackages = lazyPage(() => import('@/pages/Admin/CustomPackages'));
const AdminReviews = lazyPage(() => import('@/pages/Admin/Reviews'));
const AdminMedia = lazyPage(() => import('@/pages/Admin/Media'));

// ── Suspense wrapper ─────────────────────────────────────────────────
// The fallback has to hold a full viewport: at 60vh the footer was already
// on screen when the lazy page mounted, then the hero pushed it out and the
// shift registered as a 0.32 CLS. A page-shaped skeleton reserves the space
// and reads as loading instead of as a stalled spinner.
function PageLoader() {
  return (
    <div
      className="min-h-[100svh] px-4 py-6 md:px-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-[42vh] min-h-[240px] rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ── Route error boundary ─────────────────────────────────────────────────
// One boundary shared by every route through `errorElement` (see the route
// config below): errors in a child route bubble up to the nearest ancestor
// that defines one, so the root route's boundary covers all of them.
// Chunk-load failures get their own message because they are the one error a
// refresh actually fixes: lazyPage() already retried and auto-reloaded once,
// so reaching this boundary means the tab itself needs a fresh index.html.
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  // Chrome: "Failed to fetch dynamically imported module"
  // Chrome: "Failed to load module script" (the asset answered with HTML)
  // Firefox: "error loading dynamically imported module"
  // Safari:  "Importing a module script failed"
  // Vite:   "Unable to preload CSS for /assets/<chunk>.css" (chunk CSS gone)
  return /dynamically imported module|module script|unable to preload css/i.test(message);
}

function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  const chunkLoad = isChunkLoadError(error);
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  const title = chunkLoad
    ? 'This page failed to load'
    : notFound
      ? 'Page not found'
      : 'Something went wrong';
  const message = chunkLoad
    ? 'The app was updated while this tab was open, so the page it tried to load no longer exists. Press Ctrl+Shift+R (⌘⇧R on Mac) to load the latest version with a fresh cache.'
    : 'An unexpected error occurred. Press Ctrl+Shift+R (⌘⇧R on Mac) to load the latest version with a fresh cache.';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="w-10 h-10 text-destructive" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        {notFound && (
          <p className="text-xs text-muted-foreground">
            Error {error.status} {error.statusText}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2" aria-hidden="true" />
          Refresh
        </Button>
        <Button variant="outline" onClick={() => navigate('/')}>
          Go home
        </Button>
      </div>
      {import.meta.env.DEV && (
        <pre className="glass-chip max-w-full max-h-48 overflow-auto rounded-md p-3 text-left text-xs">
          {error instanceof Error ? error.stack || error.message : String(error)}
        </pre>
      )}
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  {
    path: '/auth/callback',
    element: (
      <SuspenseWrapper>
        <AuthCallback />
      </SuspenseWrapper>
    ),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <Home />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'deals',
        element: (
          <SuspenseWrapper>
            <Deals />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'deals/:slug',
        element: (
          <SuspenseWrapper>
            <DealDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'build-package',
        element: (
          <SuspenseWrapper>
            <BuildPackage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'search',
        element: (
          <SuspenseWrapper>
            <SearchResults />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'profile',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminUsers />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/deals',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminDeals />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/bookings',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminBookings />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/reviews',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminReviews />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/media',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminMedia />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/custom-packages',
        element: (
          <SuspenseWrapper>
            <ProtectedRoute requireAdmin>
              <AdminCustomPackages />
            </ProtectedRoute>
          </SuspenseWrapper>
        ),
      },
      {
        path: '*',
        element: (
          <SuspenseWrapper>
            <NotFound />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);
