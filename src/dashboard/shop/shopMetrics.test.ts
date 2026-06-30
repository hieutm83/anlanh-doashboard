import { describe, expect, it } from 'vitest';
import { aggregateProducts, aggregateSources, parseMetric, safeRatio, type RawProduct } from './shopMetrics';

const product: RawProduct = { date:'2026-06-29',productId:'p1',productName:'Sản phẩm A',rawPayload:{
  'Buổi LIVE của người bán > GMV đã ghi nhận':'1.000.000₫','Buổi LIVE của người bán > Đơn hàng đã ghi nhận':'10','Buổi LIVE của người bán > Số món bán ra đã ghi nhận':'12',
  'Buổi LIVE của người bán > Lượt hiển thị sản phẩm':'2.000','Buổi LIVE của người bán > Lượt nhấp vào sản phẩm':'200','Buổi LIVE của người bán > Số lượt thêm vào giỏ':'50',
  'Video của người bán > GMV đã ghi nhận':'500.000₫','Video của người bán > Đơn hàng đã ghi nhận':'5','Video của người bán > Số món bán ra đã ghi nhận':'6',
  'Video của người bán > Lượt hiển thị sản phẩm':'1.000','Video của người bán > Lượt nhấp vào sản phẩm':'100','Video của người bán > Số lượt thêm vào giỏ':'20',
}};

describe('shop traffic metrics',()=>{
  it('parses Vietnamese formatted metrics',()=>{expect(parseMetric('1.234.567₫')).toBe(1234567);expect(parseMetric('12,5%')).toBe(12.5);});
  it('uses safe ratios',()=>{expect(safeRatio(1,0)).toBe(0);expect(safeRatio(50,200)).toBe(.25);});
  it('aggregates traffic by source without using sales as ATC',()=>{const live=aggregateSources([product]).find(x=>x.key==='sellerLive')!;expect(live.impressions).toBe(2000);expect(live.clicks).toBe(200);expect(live.atc).toBe(50);expect(live.sales).toBe(12);expect(live.ctr).toBe(.1);expect(live.ctor).toBe(.25);expect(live.conversionRate).toBe(.05);expect(live.cartToOrderRate).toBe(.2);});
  it('rolls source traffic into product totals',()=>{const row=aggregateProducts([product])[0];expect(row.gmv).toBe(1500000);expect(row.impressions).toBe(3000);expect(row.clicks).toBe(300);expect(row.atc).toBe(70);expect(row.sales).toBe(18);expect(row.ctr).toBe(.1);});
});
