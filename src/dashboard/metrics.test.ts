import { describe,expect,it } from 'vitest';
import { aov,cpa,ctrPercent,roi,weightedCompletion } from './metrics';
describe('dashboard formulas',()=>{
  it('calculates commercial ratios safely',()=>{expect(roi(500,100)).toBe(5);expect(cpa(100,4)).toBe(25);expect(aov(1000,4)).toBe(250);expect(ctrPercent(25,1000)).toBe(2.5);expect(roi(10,0)).toBe(0);});
  it('weights planner completion by priority',()=>{expect(weightedCompletion([{priority:3,completed:true},{priority:1,completed:false}])).toBe(75);});
});
