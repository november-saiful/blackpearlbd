import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { queryClient } from './App';
import { api } from '@/lib/api';
import { installPreloadRecovery } from '@/lib/preload-recovery';
// Loaded before the site stylesheet so Tailwind utilities (and the site's own
// layers, emitted later) can still override OpenGlass's class-scoped rules,
// while OpenGlass's class-level material rules keep beating Tailwind's
// element-level preflight resets.
import 'open-glass-ui/styles.css';
import './index.css';

// Installed before anything else so a chunk whose CSS a redeploy removed is
// recovered with a reload instead of surfacing as "Unexpected Application Error".
installPreloadRecovery();

// The home hero and the deals grid are the largest thing on their first screen
// and both render from the deals response, so start that request while React is
// still mounting; TanStack Query hands the same promise to the page later. The
// photo the grid leads with is named in the served HTML by the edge renderer,
// which is where it belongs: the parser asks for it beside the stylesheet, long
// before this module has downloaded, parsed or run. The hero paints text first,
// so it keeps asking for its own picture once the route is up.
queryClient.prefetchQuery({ queryKey: ['deals'], queryFn: () => api.getDeals() });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
