const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const env = {
  supabaseUrl: url || '',
  supabaseAnonKey: anonKey || '',
  isConfigured: Boolean(url && anonKey),
};
