import { supabase } from '../database/supabase';
import type { DashboardFilters, OverviewResult, PageResult } from '../types/dashboard';

function previousRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(start.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export async function getOverview(filters: DashboardFilters): Promise<OverviewResult> {
  const prev = previousRange(filters.from, filters.to);
  const { data, error } = await supabase.rpc('dashboard_overview', {
    p_from: filters.from,
    p_to: filters.to,
    p_prev_from: prev.from,
    p_prev_to: prev.to,
    p_channel: filters.channel === 'all' ? null : filters.channel ?? null,
  });
  if (error) throw error;
  return data as OverviewResult;
}

export async function getDetailPage(
  filters: DashboardFilters,
  cursor: string | null,
  pageSize = 50,
): Promise<PageResult<Record<string, unknown>>> {
  const { data, error } = await supabase.rpc('dashboard_order_page', {
    p_from: filters.from,
    p_to: filters.to,
    p_channel: filters.channel === 'all' ? null : filters.channel ?? null,
    p_cursor: cursor,
    p_page_size: Math.min(pageSize, 200),
  });
  if (error) throw error;
  return data as PageResult<Record<string, unknown>>;
}
