import { supabase } from '../database/supabase';

export type AppRole = 'admin' | 'editor' | 'viewer';

export async function getCurrentRole(): Promise<AppRole> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Phiên đăng nhập không hợp lệ.');
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.user.id)
    .single();
  if (error) throw error;
  return data.role as AppRole;
}
