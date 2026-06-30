import { useEffect, useRef, useState } from 'react';
import type { DashboardFilters } from '../types/dashboard';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const display = (value: string) => value.split('-').reverse().join('/');

function preset(days: number) {
  const to = new Date(); to.setDate(to.getDate() - 1); const from = new Date(to); from.setDate(to.getDate() - days + 1);
  return { from: iso(from), to: iso(to) };
}
function yesterday() { const date = new Date(); date.setDate(date.getDate() - 1); return { from: iso(date), to: iso(date) }; }

export function DateFilter({ value, onChange }: { value: DashboardFilters; onChange: (next: DashboardFilters) => void }) {
  const [open, setOpen] = useState(false); const [custom, setCustom] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const choose = (range: { from: string; to: string }) => { onChange({ ...value, ...range }); setOpen(false); setCustom(false); };
  const active=(range:{from:string;to:string})=>value.from===range.from&&value.to===range.to?'selected':'';
  const month = (offset: number) => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth() + offset, 1); const to = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth(), 0); choose({ from: iso(from), to: iso(to) }); };
  return <div className="date-picker" ref={ref}>
    <button className="date-trigger" onClick={() => setOpen(!open)}><span>▣</span>{display(value.from)} - {display(value.to)}<b>⌄</b></button>
    {open && <div className="date-popover">
      <button className={active(yesterday())} onClick={() => choose(yesterday())}>Hôm qua</button><button className={active(preset(7))} onClick={() => choose(preset(7))}>7 ngày qua</button>
      <button className={active(preset(30))} onClick={() => choose(preset(30))}>30 ngày qua</button><button onClick={() => month(0)}>Tháng này</button><button onClick={() => month(-1)}>Tháng trước</button>
      <button className="custom-toggle" onClick={() => setCustom(!custom)}>Tùy chỉnh</button>
      {custom && <div className="custom-range"><label>Từ ngày<input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })}/></label><label>Đến ngày<input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })}/></label><button onClick={() => setOpen(false)}>Áp dụng</button></div>}
    </div>}
  </div>;
}

export function defaultRange(): DashboardFilters { const range = preset(7); return { ...range, channel: 'all' }; }
