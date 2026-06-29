import { useEffect, useRef } from 'react';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'Barlow', 'Segoe UI', sans-serif";
Chart.defaults.color = '#555555';
Chart.defaults.plugins.legend.position = 'bottom';

export function DashboardChart({ config }: { config: ChartConfiguration }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, config);
    return () => chart.destroy();
  }, [config]);
  return <div className="chart-wrap"><canvas ref={canvas} /></div>;
}
