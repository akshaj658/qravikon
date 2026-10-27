/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { env, features } from './env';

// Use 'any' because we don't have generated database types.
// All data correctness is enforced by Zod schemas at the service layer.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type AnySupabaseClient = any;

let supabaseAdmin: AnySupabaseClient = null;
let supabaseClient: AnySupabaseClient = null;

if (features.supabase) {
  supabaseAdmin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
  supabaseClient = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!) as any;
}

export { supabaseAdmin, supabaseClient };

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function requireSupabase(): AnySupabaseClient {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}
