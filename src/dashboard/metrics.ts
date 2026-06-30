export const safeRatio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;
export const roi = (revenue: number, spend: number) => safeRatio(revenue, spend);
export const cpa = (spend: number, orders: number) => safeRatio(spend, orders);
export const aov = (revenue: number, orders: number) => safeRatio(revenue, orders);
export const ctrPercent = (clicks: number, impressions: number) => safeRatio(clicks, impressions) * 100;
export function weightedCompletion(tasks: Array<{ priority: number; completed: boolean }>) {
  const totals=tasks.reduce((acc,task)=>{const weight=Math.min(3,Math.max(1,Number(task.priority)||1));acc.possible+=weight;if(task.completed)acc.earned+=weight;return acc;},{earned:0,possible:0});
  return safeRatio(totals.earned,totals.possible)*100;
}
