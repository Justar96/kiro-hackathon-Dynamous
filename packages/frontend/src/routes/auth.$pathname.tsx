import { createFileRoute } from '@tanstack/react-router';
import { AuthView } from '@neondatabase/neon-js/auth/react';

export const Route = createFileRoute('/auth/$pathname')({
  component: AuthPage,
});

function AuthPage() {
  const { pathname } = Route.useParams();

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-primary">
            {pathname === 'sign-up' ? 'Create your account' : 'Sign in to Thesis'}
          </h2>
          <p className="mt-2 text-text-secondary">Join Thesis</p>
        </div>
        <AuthView pathname={pathname} />
      </div>
    </div>
  );
}
