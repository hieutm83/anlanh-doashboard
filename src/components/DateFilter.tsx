import type { DashboardFilters } from '../types/dashboard';

export function DateFilter({ value, onChange }: { value: DashboardFilters; onChange: (next: DashboardFilters) => void }) {
  return <div className="filter-bar">
    <label>Từ ngày<input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
    <label>Đến ngày<input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
    <label>Kênh<select value={value.channel} onChange={(e) => onChange({ ...value, channel: e.target.value as DashboardFilters['channel'] })}>
      <option value="all">Tất cả</option><option value="tiktok">TikTok</option><option value="shopee">Shopee</option>
    </select></label>
  </div>;
}
