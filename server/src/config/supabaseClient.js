import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-side client using the SERVICE ROLE key, which bypasses Row Level
// Security -- this is what lets the API read/write tables that are locked
// down from the frontend/anon key. Never expose this client or its key to
// the browser.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
