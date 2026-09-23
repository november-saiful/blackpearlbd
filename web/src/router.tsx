import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

// ── Chunk-load recovery ───────────────────────────────────────────────────
// A tab running an older build can request a hashed chunk that a redeploy
// deleted, and a flaky network can drop the fetch outright; React.lazy turns
// either into a rejected route ("Unexpected Application Error"). Recover in
// two steps: retry once for transient failures, then hard-reload once per
// session — a fresh index.html only references chunks that actually exist.
const CHUNK_RELOAD_FLAG = 'bp-chunk-reload';

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function lazyPage(factory: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
      return mod;
    } catch {
      // The failure may have been a transient network error — retry once.
      await delay(700);
      try {
        const mod = await factory();
        sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
        return mod;
      } catch (err) {
        // Still failing: most likely a stale chunk from a recent deploy.
        if (!sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
          sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
          window.location.reload();
          // Stay on the Suspense fallback while the page reloads; only throw
          // if the reload was blocked, so we can never reload-loop.
          await delay(3000);
        }
        throw err;
      }
    }
  });
}

// ── Lazy-loaded page components (each becomes its own chunk) ──────────
const Home = lazyPage(() => import('@/pages/Home'));
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
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
// refresh actually fixes — lazyPage() already retried and auto-reloaded once,
// so reaching this boundary means the tab itself needs a fresh index.html.
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  // Chrome: "Failed to fetch dynamically imported module"
  // Firefox: "error loading dynamically imported module"
  // Safari:  "Importing a module script failed"
  return /dynamically imported module|module script failed/i.test(message);
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
    ? 'The app was updated while this tab was open, so the page it tried to load no longer exists. Refreshing loads the latest version.'
    : 'An unexpected error occurred. Refreshing often fixes it.';

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
        <pre className="max-w-full max-h-48 overflow-auto rounded-md bg-muted p-3 text-left text-xs">
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
