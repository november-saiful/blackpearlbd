import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
