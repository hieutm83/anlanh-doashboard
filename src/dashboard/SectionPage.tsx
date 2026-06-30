import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfiguration, ChartType } from 'chart.js';
import { getDashboardSection } from '../api/dashboardApi';
import { DateFilter } from '../components/DateFilter';
import { useGlobalDateFilter } from '../app/DateFilterContext';
import { DashboardChart } from '../components/DashboardChart';
import { VietnamGeoMap } from '../components/VietnamGeoMap';
import { legacySpecs, type MetricKey } from './legacyDashboardSpecs';
import { exportJson, exportMarkdown } from '../export/download';
import { OperationsEditor } from './OperationsEditor';
import { aov, cpa, ctrPercent, roi } from './metrics';

type Row = Record<string, string | number | null>;
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const columnLabels: Record<string,string> = { label:'Tên/Nhóm',revenue:'Doanh thu',orders:'Đơn hàng',spend:'Tổng hoa hồng',quantity:'Số lượng',customers:'Khách hàng',impressions:'Hiển thị/Lượt xem',clicks:'Lượt nhấp',atc:'Thêm giỏ',checkout:'Thanh toán',buyers:'Người mua',cancelled_orders:'Đơn hủy',score:'Điểm hiệu suất',overdue:'Quá hạn',videos:'Video',standard_commission:'Hoa hồng tự nhiên',ad_commission:'Hoa hồng Ads',commission_rate:'Tỷ lệ hoa hồng',source_type:'Nhóm',view_2s_rate:'Xem 2s',view_6s_rate:'Xem 6s',view_25_rate:'Xem 25%',view_50_rate:'Xem 50%',view_75_rate:'Xem 75%',view_100_rate:'Xem 100%',province:'Tỉnh/Thành',date:'Ngày',status:'Trạng thái',priority:'Ưu tiên' };
const currencyColumns = new Set(['revenue','spend','standard_commission','ad_commission']);
const percentColumns = new Set(['commission_rate','view_2s_rate','view_6s_rate','view_25_rate','view_50_rate','view_75_rate','view_100_rate']);
const palette = ['#347ff0','#00b982','#8150ee','#ff963c','#ff5b7d','#45b8ad','#aeb4bb','#f5bd3d','#168dd1','#8653e7'];

const sum = (rows: Row[], key: MetricKey) => rows.reduce((total,row) => total + Number(row[key] ?? 0),0);
function kpiValue(rows: Row[], summary: Record<string,number>, metric: MetricKey, ratio?: 'roi'|'cpa'|'aov'|'ctr') {
  const get=(key:MetricKey)=>Number(summary[key]??sum(rows,key)); const value=get(metric); if(!ratio) return value;
  if(ratio==='roi') return roi(get('revenue'),get('spend'));
  if(ratio==='cpa') return cpa(get('spend'),get('orders'));
  if(ratio==='aov') return aov(get('revenue'),get('orders'));
  return ctrPercent(get('clicks'),get('impressions'));
}
function chartConfig(rows: Row[], item: { title:string; metric:MetricKey; secondary?:MetricKey; type?:'bar'|'line'|'doughnut' }): ChartConfiguration {
  const source=rows.length ? rows.slice(0,10) : [{label:'Chưa có dữ liệu'}]; const labels=source.map(row=>String(row.label ?? row.date ?? 'Khác'));
  const type=(item.type ?? 'bar') as ChartType;
  if(type==='doughnut') return { type:'doughnut',data:{labels,datasets:[{label:item.title,data:source.map(row=>Number(row[item.metric]??0)),backgroundColor:palette,borderColor:'#fff',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:9}}}}} } as ChartConfiguration;
  const datasets: ChartConfiguration['data']['datasets']=[{label:columnLabels[item.metric]??item.metric,data:source.map(row=>Number(row[item.metric]??0)),borderColor:palette[0],backgroundColor:type==='line'?'#347ff022':palette[0],fill:type==='line',tension:.3,borderRadius:type==='bar'?3:undefined}];
  if(item.secondary) datasets.push({type:'line',label:columnLabels[item.secondary]??item.secondary,data:source.map(row=>Number(row[item.secondary!]??0)),borderColor:palette[1],backgroundColor:palette[1],tension:.3,yAxisID:'y1'});
  return {type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:14,font:{size:9}}}},scales:{y:{beginAtZero:true,grid:{color:'#edf0f4'}},...(item.secondary?{y1:{beginAtZero:true,position:'right' as const,grid:{display:false}}}:{})}}} as ChartConfiguration;
}

export function SectionPage({ section, title, canEdit=false }: { section:string; title:string; canEdit?:boolean }) {
  const spec=legacySpecs[section]; const {filters,setFilters}=useGlobalDateFilter(); const [detail,setDetail]=useState<Row|null>(null);
  const query=useQuery({queryKey:['dashboard',section,filters.from,filters.to],queryFn:()=>getDashboardSection(section,filters),staleTime:5*60_000});
  const rows=query.data?.rows??[]; const summary=query.data?.summary??{}; const charts=useMemo(()=>spec?.charts.map(item=>chartConfig(rows,item))??[],[rows,spec]);
  if(!spec) return <div className="state error">Chưa định nghĩa dashboard: {section}</div>;
  return <><header className="mb-5 flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-2xl font-bold text-[#1a1a1a]">{title}</h1><div className="heading-tools">{canEdit&&<OperationsEditor section={section}/>}<button className="export-button" onClick={()=>exportJson(`${section}-${filters.from}-${filters.to}`,query.data)}>JSON</button><button className="export-button" onClick={()=>exportMarkdown(`${section}-${filters.from}-${filters.to}`,rows)}>MD</button><button className="refresh" onClick={()=>query.refetch()}>↻</button><DateFilter value={filters} onChange={setFilters}/></div></header>
    {query.isLoading&&<div className="state">Đang đọc dữ liệu tổng hợp…</div>}{query.error&&<div className="state error">Không thể tải dữ liệu: {query.error.message}</div>}
    {!query.isLoading&&!query.error&&<>
      {spec.kpis.length>0&&<section className={`mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 ${spec.kpis.length>8?'xl:grid-cols-5':'xl:grid-cols-4'}`}>{spec.kpis.map((item,index)=>{const value=kpiValue(rows,summary,item.metric,item.ratio);return <article className="legacy-kpi" key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.currency?`${money.format(value)} ₫`:item.ratio==='ctr'?`${number.format(value)}%`:number.format(value)}</strong><small>{rows.length?`Từ ${rows.length} nhóm dữ liệu`:'Chưa có dữ liệu'}</small></article>})}</section>}
      {spec.charts.length>0&&<section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">{spec.charts.map((item,index)=><article className="card" key={`${item.title}-${index}`}><h2 className="mb-4 text-xs font-bold text-slate-700">{item.title}</h2><div className="legacy-chart-wrap">{item.title.includes('Bản đồ')?<VietnamGeoMap rows={rows}/>:<DashboardChart config={charts[index]}/>}</div></article>)}</section>}
      {spec.tables.map((table,index)=><article className="card mb-5" key={`${table.title}-${index}`}><h2 className="mb-4 text-sm font-bold">{table.title}</h2><div className="legacy-table-scroll"><table><thead><tr>{table.columns.map(column=><th key={column}>{columnLabels[column]??column}</th>)}<th>Chi tiết</th></tr></thead><tbody>{rows.length?rows.slice(0,100).map((row,rowIndex)=><tr key={rowIndex}>{table.columns.map(column=><td key={column}>{currencyColumns.has(column)?`${money.format(Number(row[column]??0))} ₫`:percentColumns.has(column)?`${number.format(Number(row[column]??0)*100)}%`:typeof row[column]==='number'?number.format(Number(row[column])):String(row[column]??'—')}</td>)}<td><button className="detail-button" onClick={()=>setDetail(row)}>Xem</button></td></tr>):<tr><td colSpan={table.columns.length+1} className="empty-cell">Không có dữ liệu trong khoảng thời gian đã chọn</td></tr>}</tbody></table></div></article>)}
    </>}
    {detail&&<div className="legacy-modal" onClick={()=>setDetail(null)}><article onClick={event=>event.stopPropagation()}><header><h2>Chi tiết: {String(detail.label??'Dữ liệu')}</h2><button onClick={()=>setDetail(null)}>×</button></header><div className="detail-grid">{Object.entries(detail).map(([key,value])=><div key={key}><span>{columnLabels[key]??key}</span><b>{String(value??'—')}</b></div>)}</div></article></div>}
  </>;
}
