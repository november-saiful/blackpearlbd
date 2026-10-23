import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { GlassSystemProvider } from 'open-glass-ui';
import { router } from './router';
import { ThemeProvider, useTheme } from './lib/theme-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Every glass surface in the app is rendered by OpenGlass, so its appearance
// must follow the site's own light/dark toggle rather than the OS alone.
// ThemeProvider owns that state (it writes the `dark` class on <html>), so the
// provider is mounted inside it and fed the resolved theme. `renderer="auto"`
// keeps rendering CSS-first. The theme boundary is `display: contents` so it
// adds no box to the layout while still passing its tokens down the DOM.
function GlassRoot({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <GlassSystemProvider
      renderer="auto"
      toasts={false}
      theme={{ appearance: resolvedTheme, className: 'contents' }}
    >
      {children}
    </GlassSystemProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <GlassRoot>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </QueryClientProvider>
      </GlassRoot>
    </ThemeProvider>
  );
}

export default App;