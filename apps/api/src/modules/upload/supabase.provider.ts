import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

/**
 * Server-only Supabase client, authenticated with the service role key.
 * This bypasses RLS entirely — that's intentional: our NestJS API is the
 * single authority over authorization (via JWT + RolesGuard), not Supabase
 * Auth or Postgres RLS. This client must NEVER be sent to the frontend.
 */
export const SupabaseProvider = {
  provide: SUPABASE_CLIENT,
  useFactory: (): SupabaseClient => {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to enable image uploads',
      );
    }
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  },
};
