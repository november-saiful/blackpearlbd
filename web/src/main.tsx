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

// The homepage hero is the largest thing on the first screen and it renders
// from the deals response. Start that request now, while React is still
// mounting, instead of waiting for the lazy Home route to run its effects;
// TanStack Query hands the same promise to the page when it asks for ['deals'].
queryClient.prefetchQuery({ queryKey: ['deals'], queryFn: () => api.getDeals() });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
