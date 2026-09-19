import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// ── Lazy-loaded page components (each becomes its own chunk) ──────────
const Home = lazy(() => import('@/pages/Home'));
const Deals = lazy(() => import('@/pages/Deals'));
const DealDetailPage = lazy(() => import('@/pages/DealDetail'));
const BuildPackage = lazy(() => import('@/pages/BuildPackage'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const SearchResults = lazy(() => import('@/pages/SearchResults'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

// Admin pages are grouped into a single "admin" chunk via manualChunks,
// but each is still lazy-loaded so nothing loads until /admin is hit.
const AdminDashboard = lazy(() => import('@/pages/Admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/Admin/Users'));
const AdminDeals = lazy(() => import('@/pages/Admin/Deals'));
const AdminBookings = lazy(() => import('@/pages/Admin/Bookings'));
const AdminCustomPackages = lazy(() => import('@/pages/Admin/CustomPackages'));
const AdminReviews = lazy(() => import('@/pages/Admin/Reviews'));
const AdminMedia = lazy(() => import('@/pages/Admin/Media'));

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

// ── Router ───────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  {
    path: '/auth/callback',
    element: (
      <SuspenseWrapper>
        <AuthCallback />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/',
    element: <RootLayout />,
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
