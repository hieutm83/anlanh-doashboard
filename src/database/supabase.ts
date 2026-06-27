import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Publishable/anon key is intentionally public. RLS is the security boundary.
export const supabase = createClient(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
