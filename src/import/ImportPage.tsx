import { useRef, useState } from 'react';
import type { DatasetType, ParseResult } from './types';
import { validateHeaders, validateRows } from './schemaRegistry';
import { uploadImport } from './batchUploader';

export function ImportPage() {
  const workerRef = useRef<Worker | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DatasetType>('orders');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const parse = (next: File) => {
    setFile(next); setStatus('Đang đọc file trong Web Worker…'); setParsed(null);
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./workers/import.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (!data.ok) return setStatus(`Lỗi: ${data.error}`);
      const result = data.result as ParseResult;
      const missing = validateHeaders(type, result.headers);
      result.errors = [...missing.map((column) => ({ row: 1, column, message: 'Thiếu cột bắt buộc' })), ...validateRows(result.rows, result.headers)];
      setParsed(result); setStatus(missing.length ? 'Cấu trúc file chưa hợp lệ.' : 'File đã sẵn sàng để import.');
    };
    worker.postMessage({ file: next, datasetType: type });
  };
  const confirm = async () => {
    if (!file || !parsed || parsed.errors.length) return;
    try { setStatus('Đang import theo batch…'); await uploadImport(file, type, parsed.rows, setProgress); setStatus('Import hoàn tất và aggregate đã được cập nhật.'); }
    catch (error) { setStatus(`Import thất bại: ${error instanceof Error ? error.message : String(error)}`); }
  };
  return <section><header className="page-heading"><div><p>DATA PIPELINE</p><h1>Nhập dữ liệu</h1></div></header>
    <div className="import-grid"><article className="panel"><h2>1. Chọn nguồn dữ liệu</h2><label>Loại dữ liệu<select value={type} onChange={(e) => setType(e.target.value as DatasetType)}><option value="orders">Đơn hàng</option><option value="ads">Quảng cáo</option><option value="products">Sản phẩm</option><option value="creator_performance">KOC Performance</option><option value="videos">Video</option><option value="traffic">Traffic</option></select></label><label className="drop-zone">CSV, XLSX hoặc XLS<input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} /></label><p>{status}</p>{progress > 0 && <progress value={progress} max="100" />}</article>
      <article className="panel"><h2>2. Kiểm tra và xác nhận</h2>{parsed ? <><div className="summary"><b>{parsed.totalRows.toLocaleString('vi-VN')}</b> dòng · <b>{parsed.errors.length}</b> lỗi</div>{parsed.errors.length > 0 && <ul className="errors">{parsed.errors.slice(0, 20).map((error, i) => <li key={i}>Dòng {error.row}, {error.column}: {error.message}</li>)}</ul>}<div className="preview"><table><thead><tr>{parsed.headers.slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 10).map((row, i) => <tr key={i}>{parsed.headers.slice(0, 8).map((h) => <td key={h}>{String(row[h] ?? '')}</td>)}</tr>)}</tbody></table></div><button disabled={parsed.errors.length > 0 || progress === 100} onClick={confirm}>Xác nhận import</button></> : <p>Chọn file để xem preview. Dữ liệu chưa được gửi lên server ở bước này.</p>}</article></div>
  </section>;
}
