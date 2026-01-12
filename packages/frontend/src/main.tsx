import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthProvider, AuthModalProvider, ToastProvider, ErrorBoundary, NewDebateModalProvider } from './components';
import { routeTree } from './routeTree.gen';
import type { RouterContext } from './routes/__root';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute default
      gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
      retry: 1,
      refetchOnWindowFocus: false, // Prevent excessive refetches on tab switch
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: 0, // Don't retry mutations by default
    },
  },
});

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  } satisfies RouterContext,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthModalProvider>
              <NewDebateModalProvider>
                <RouterProvider router={router} />
              </NewDebateModalProvider>
            </AuthModalProvider>
          </ToastProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
