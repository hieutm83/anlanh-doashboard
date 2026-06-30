import { useState } from 'react';
import { DashboardChart } from '../../components/DashboardChart';
import { EmptyRow, formatMoney, formatNumber, ShopHeader, ShopState, type ShopRow, useShopChart, useShopTraffic } from './shared';

export function ShopProductDetails() {
  const state = useShopTraffic('products'); const { rows } = state; const [detail, setDetail] = useState<ShopRow|null>(null);
  const pie = useShopChart(rows, 'GMV', 'revenue', 'doughnut'); const combo = useShopChart(rows, 'Đơn hàng', 'orders', 'bar', 'revenue');
  const gmv = useShopChart(rows, 'GMV', 'revenue', 'line'); const traffic = useShopChart(rows, 'Lượt xem', 'impressions', 'line');
  const ctr = useShopChart(rows, 'CTR', 'ctr', 'line'); const cr = useShopChart(rows, 'CR', 'conversionRate', 'line');
  const chart = (title: string, config: Parameters<typeof DashboardChart>[0]['config'], tall=false) => <article className="card"><h3 className="mb-4 text-sm font-bold text-slate-800">{title}</h3><div className={tall?'h-[280px]':'h-[240px]'}><DashboardChart config={config}/></div></article>;
  return <><ShopHeader title="Chi tiết Sản phẩm" state={state}/><ShopState state={state}>
    <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">{chart('GMV theo Sản phẩm', pie, true)}{chart('Đơn hàng, CTR & CR theo Sản phẩm', combo, true)}</section>
    <article className="card mb-6"><h3 className="mb-4 text-sm font-bold">Hiệu quả chi tiết theo Sản phẩm (Cửa hàng)</h3><div className="overflow-x-auto"><table className="min-w-[980px]"><thead><tr><th>Sản phẩm</th><th>GMV</th><th>Số món</th><th>Đơn hàng</th><th>Hiển thị</th><th>Lượt xem</th><th>CTR TB</th><th>CR TB</th><th>Chi tiết</th></tr></thead><tbody>{rows.length ? rows.map((row,i) => { const impressions=Number(row.impressions??0), clicks=Number(row.clicks??0), orders=Number(row.orders??0); return <tr key={i}><td>{String(row.label??'—')}</td><td>{formatMoney(row.revenue)}</td><td>{formatNumber(row.sales)}</td><td>{formatNumber(orders)}</td><td>{formatNumber(impressions)}</td><td>{formatNumber(clicks)}</td><td>{formatNumber(Number(row.ctr??0)*100)}%</td><td>{formatNumber(Number(row.conversionRate??0)*100)}%</td><td><button className="detail-button" onClick={() => setDetail(row)}>Chi tiết SF</button></td></tr> }) : <EmptyRow colSpan={9}/>}</tbody></table></div></article>
    <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">{chart('Diễn biến GMV',gmv)}{chart('Diễn biến Traffic (Lượt xem trang)',traffic)}{chart('Diễn biến CTR',ctr)}{chart('Diễn biến CR',cr)}</section>
  </ShopState>{detail&&<div className="legacy-modal" onClick={() => setDetail(null)}><article onClick={e=>e.stopPropagation()}><header><h2>Chi tiết: {String(detail.label??'Sản phẩm')}</h2><button onClick={()=>setDetail(null)}>×</button></header><div className="detail-grid">{Object.entries(detail).map(([key,value])=><div key={key}><span>{key}</span><b>{String(value??'—')}</b></div>)}</div></article></div>}</>;
}
