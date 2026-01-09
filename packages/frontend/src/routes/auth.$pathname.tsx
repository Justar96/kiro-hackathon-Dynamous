import { createFileRoute } from '@tanstack/react-router';
import { AuthView } from '@neondatabase/neon-js/auth/react';

export const Route = createFileRoute('/auth/$pathname')({
  component: AuthPage,
});

function AuthPage() {
  const { pathname } = Route.useParams();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {pathname === 'sign-up' ? 'Create your account' : 'Sign in to Debate Platform'}
          </h2>
          <p className="mt-2 text-gray-600">Join the Persuasion Market</p>
        </div>
        <AuthView pathname={pathname} />
      </div>
    </div>
  );
}
