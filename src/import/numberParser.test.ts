import { describe,expect,it } from 'vitest';
import { parseLocalizedNumber,parseMoney } from './numberParser';
describe('Vietnamese import numbers',()=>{
  it('preserves decimal metrics',()=>{expect(parseLocalizedNumber('319,2')).toBe(319.2);expect(parseLocalizedNumber('1.234')).toBe(1234);expect(parseLocalizedNumber('12,5%')).toBe(12.5)});
  it('cleans all thousands separators from money',()=>{expect(parseMoney('32.400.000 ₫')).toBe(32400000);expect(parseMoney('32,400,000')).toBe(32400000);expect(parseMoney('2.460.000')).toBe(2460000)});
});
