import { useEffect, useRef } from 'react';

type GeoRow = Record<string, string | number | null>;
declare global {
  interface Window {
    google?: {
      charts: { load: (version: string, options: object) => void; setOnLoadCallback: (callback: () => void) => void };
      visualization: { arrayToDataTable: (rows: unknown[][]) => unknown; GeoChart: new(element: HTMLElement) => { draw: (data: unknown, options: object) => void } };
    };
  }
}

export function VietnamGeoMap({ rows }: { rows: GeoRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const draw = () => {
      if (!ref.current || !window.google) return;
      const data = window.google.visualization.arrayToDataTable([
        ['Tỉnh/Thành', 'Doanh thu'],
        ...rows.map((row) => [String(row.province ?? row.label ?? 'Khác'), Number(row.revenue ?? 0)]),
      ]);
      new window.google.visualization.GeoChart(ref.current).draw(data, {
        region: 'VN',
        resolution: 'provinces',
        displayMode: 'regions',
        colorAxis: { colors: ['#dbeafe', '#2563eb'] },
        backgroundColor: 'transparent',
        datalessRegionColor: '#edf1f6',
        legend: 'none',
      });
    };
    const load = () => {
      window.google?.charts.load('current', { packages: ['geochart'] });
      window.google?.charts.setOnLoadCallback(draw);
    };
    if (window.google) load();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-charts]');
      if (existing) existing.addEventListener('load', load, { once: true });
      else {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/charts/loader.js';
        script.dataset.googleCharts = 'true';
        script.onload = load;
        document.head.appendChild(script);
      }
    }
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [rows]);

  return <div className="geo-map" ref={ref} />;
}
