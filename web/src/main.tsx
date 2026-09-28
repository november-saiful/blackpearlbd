import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installPreloadRecovery } from '@/lib/preload-recovery';
import './index.css';

// Installed before anything else so a chunk whose CSS a redeploy removed is
// recovered with a reload instead of surfacing as "Unexpected Application Error".
installPreloadRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
