import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AuthProvider, AuthModalProvider, ToastProvider, ErrorBoundary } from './components';
import { Web3Provider } from './lib';
import { routeTree } from './routeTree.gen';
import type { RouterContext } from './routes/__root';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
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
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Web3Provider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <AuthModalProvider>
                  <RouterProvider router={router} />
                </AuthModalProvider>
              </ToastProvider>
            </QueryClientProvider>
          </AuthProvider>
        </Web3Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
