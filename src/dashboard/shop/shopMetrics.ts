export type SourceKey = 'sellerLive'|'sellerVideo'|'affiliate'|'shopTab'|'card';
export type MetricKey = 'gmv'|'orders'|'sales'|'customers'|'impressions'|'clicks'|'atc'|'ctr'|'ctor'|'aov'|'addToCartRate'|'conversionRate'|'cartToOrderRate';
export type MetricTotals = Record<MetricKey, number>;
export type RawProduct = { date:string; productId:string; productName:string; rawPayload:Record<string,unknown> };
export type ProductMetrics = MetricTotals & { label:string; date:string; productId:string };
export type SourceMetrics = MetricTotals & { key:SourceKey; label:string };

const sourceDefs: Array<{key:SourceKey;label:string;groups:string[]}> = [
  {key:'sellerLive',label:'LIVE người bán',groups:['buoi live cua nguoi ban','live nguoi ban','seller live']},
  {key:'sellerVideo',label:'Video Inhouse',groups:['video cua nguoi ban','seller video']},
  {key:'affiliate',label:'Video TTLK',groups:['lien ket','tiep thi lien ket','affiliate','creator','nha sang tao']},
  {key:'shopTab',label:'Tab cửa hàng',groups:['tat ca','all','tong quan']},
  {key:'card',label:'Thẻ sản phẩm',groups:['the san pham cua nguoi ban','the san pham','product card','card']},
];
const aliases: Record<Exclude<MetricKey,'ctr'|'ctor'|'aov'|'addToCartRate'|'conversionRate'|'cartToOrderRate'>,string[]> = {
  gmv:['gmv da ghi nhan','gmv bao gom thue','gmv'], orders:['don hang da ghi nhan','don hang sku da ghi nhan','don hang'],
  sales:['so mon ban ra da ghi nhan','so mon ban ra'], customers:['so luong khach hang uoc tinh','khach hang'],
  impressions:['luot hien thi san pham trong tab cua hang','luot hien thi san pham','impressions'],
  clicks:['luot nhap vao san pham trong tab cua hang','luot nhap vao san pham','clicks','views'],
  atc:['so luot them vao gio tu tab cua hang','so luot them vao gio','nguoi dung them vao gio hang','nguoi dung atc','add to cart'],
};
const empty = (): MetricTotals => ({gmv:0,orders:0,sales:0,customers:0,impressions:0,clicks:0,atc:0,ctr:0,ctor:0,aov:0,addToCartRate:0,conversionRate:0,cartToOrderRate:0});
export const safeRatio=(n:number,d:number)=>d>0?n/d:0;
export function parseMetric(value:unknown) { if(typeof value==='number')return Number.isFinite(value)?value:0; let s=String(value??'').replace(/[₫%\s]/g,''); if(!s||['-','--','—'].includes(s))return 0; const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;if(dots&&commas){const dec=s.lastIndexOf('.')>s.lastIndexOf(',')?'.':',';s=s.split(dec==='.'?',':'.').join('').replace(dec,'.')}else if(dots>1)s=s.replace(/\./g,'');else if(commas>1)s=s.replace(/,/g,'');else if(commas===1){const p=s.split(',');s=p[1]?.length===3?p.join(''):p.join('.')}else if(dots===1){const p=s.split('.');if(p[1]?.length===3)s=p.join('')}return Number.parseFloat(s.replace(/[^0-9.\-]/g,''))||0; }
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function entries(payload:Record<string,unknown>){return Object.entries(payload).map(([key,value])=>{const parts=key.split('>');return {group:normalize(parts.length>1?parts[0]:''),field:normalize(parts.at(-1)??key),value};});}
function read(payload:Record<string,unknown>,groups:string[],fields:string[]){const es=entries(payload),gs=groups.map(normalize),fs=fields.map(normalize);const grouped=es.find(e=>gs.some(g=>e.group===g||e.group.includes(g))&&fs.some(f=>e.field===f||e.field.includes(f)));const fallback=es.find(e=>!e.group&&fs.some(f=>e.field===f||e.field.includes(f)));return parseMetric((grouped??fallback)?.value);}
function derive<T extends MetricTotals>(value:T):T{value.ctr=safeRatio(value.clicks,value.impressions);value.ctor=safeRatio(value.atc,value.clicks);value.aov=safeRatio(value.gmv,value.orders);value.addToCartRate=value.ctor;value.conversionRate=safeRatio(value.orders,value.clicks);value.cartToOrderRate=safeRatio(value.orders,value.atc);return value;}
export function readSourceMetric(product:RawProduct,key:SourceKey,metric:keyof typeof aliases){const def=sourceDefs.find(x=>x.key===key)!;return read(product.rawPayload,def.groups,aliases[metric]);}
export function aggregateSources(products:RawProduct[]):SourceMetrics[]{return sourceDefs.map(def=>{const value=empty();products.forEach(p=>(Object.keys(aliases) as Array<keyof typeof aliases>).forEach(metric=>value[metric]+=readSourceMetric(p,def.key,metric)));return {...derive(value),key:def.key,label:def.label};});}
export function aggregateProducts(products:RawProduct[]):ProductMetrics[]{const map=new Map<string,ProductMetrics>();for(const product of products){const key=product.productId||product.productName;const current=map.get(key)??{...empty(),label:product.productName||product.productId,date:product.date,productId:product.productId};const sources=aggregateSources([product]);for(const metric of Object.keys(aliases) as Array<keyof typeof aliases>)current[metric]+=sources.reduce((sum,row)=>sum+row[metric],0);current.date=product.date>current.date?product.date:current.date;map.set(key,current)}return [...map.values()].map(derive).sort((a,b)=>b.gmv-a.gmv);}
