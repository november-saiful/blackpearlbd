import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { queryClient } from './App';
import { api } from '@/lib/api';
import { installPreloadRecovery } from '@/lib/preload-recovery';
import type { TourDeal } from '@/types';
// Loaded before the site stylesheet so Tailwind utilities (and the site's own
// layers, emitted later) can still override OpenGlass's class-scoped rules,
// while OpenGlass's class-level material rules keep beating Tailwind's
// element-level preflight resets.
import 'open-glass-ui/styles.css';
import './index.css';

// Installed before anything else so a chunk whose CSS a redeploy removed is
// recovered with a reload instead of surfacing as "Unexpected Application Error".
installPreloadRecovery();

// The homepage hero is the largest thing on the first screen and it renders
// from the deals response. Start that request now, while React is still
// mounting, instead of waiting for the lazy Home route to run its effects;
// TanStack Query hands the same promise to the page when it asks for ['deals'].
// The leading photo follows the same instant it is known: the carousel cannot
// mount until the route chunk has parsed, which on a phone leaves roughly a
// second of the connection idle. Featured deals lead the carousel, and the
// cards reuse the same URLs, so this byte is never spent twice. Only the home
// page orders deals that way, so the warm is limited to it.
queryClient
  .prefetchQuery({ queryKey: ['deals'], queryFn: () => api.getDeals() })
  .then(() => {
    if (window.location.pathname.replace(/\/+$/, '') !== '') return;
    const deals = queryClient.getQueryData<TourDeal[]>(['deals']) ?? [];
    const leading = [...deals].sort(
      (a, b) => Number(b.is_featured) - Number(a.is_featured),
    )[0];
    if (leading?.image_url) {
      const warm = new Image();
      warm.src = leading.image_url;
    }
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
