import { createAuthClient } from '@neondatabase/neon-js/auth';

// Neon Auth client configuration
// Environment variable: VITE_NEON_AUTH_URL (get from Neon Console → Auth → Configuration)
export const authClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL || ''
);
