import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DatasetType, ParseResult } from './types';
import { validateHeaders, validateRows } from './schemaRegistry';
import { coordinateImports } from './importCoordinator';

type ParsedFile = { file: File; result: ParseResult };
const multiTypes = new Set<DatasetType>(['ads', 'product_analysis']);

export function ImportPage() {
  const queryClient = useQueryClient();
  const workerRef = useRef<Worker | null>(null);
  const [type, setType] = useState<DatasetType>('orders');
  const [entries, setEntries] = useState<ParsedFile[]>([]);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const isMulti = multiTypes.has(type);
  const totalRows = entries.reduce((sum, entry) => sum + entry.result.totalRows, 0);
  const totalErrors = entries.reduce((sum, entry) => sum + entry.result.errors.length, 0);

  const readableError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
      const value = error as { message?: string; details?: string; hint?: string; code?: string };
      return [value.message, value.details, value.hint, value.code].filter(Boolean).join(' - ') || JSON.stringify(error);
    }
    return String(error);
  };

  const mutation = useMutation({
    mutationFn: () => coordinateImports(queryClient, entries.map(({ file, result }) => ({ file, datasetType: type, rows: result.rows })), setProgress),
    onSuccess: (jobs) => setStatus(`Đã import thành công ${jobs.length} file và làm mới cache dashboard.`),
    onError: (error) => setStatus(`Import thất bại: ${readableError(error)}`),
  });

  const parseOne = (file: File) => new Promise<ParsedFile>((resolve, reject) => {
    const worker = new Worker(new URL('./workers/import.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (!data.ok) return reject(new Error(`${file.name}: ${data.error}`));
      const result = data.result as ParseResult;
      const missing = validateHeaders(type, result.headers, result.rows);
      result.errors = [
        ...missing.map((column) => ({ row: 1, column, message: `${file.name}: thiếu trường bắt buộc` })),
        ...validateRows(result.rows).map((error) => ({ ...error, message: `${file.name}: ${error.message}` })),
      ];
      resolve({ file, result });
    };
    worker.onerror = () => { worker.terminate(); reject(new Error(`${file.name}: Web Worker gặp lỗi.`)); };
    worker.postMessage({ file, datasetType: type });
  });

  const parseFiles = async (selected: FileList) => {
    const files = Array.from(selected);
    if (!files.length) return;
    if (!isMulti && files.length > 1) files.splice(1);
    setEntries([]);
    setProgress(0);
    setStatus(`Đang đọc 0/${files.length} file...`);
    const output: ParsedFile[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        output.push(await parseOne(files[index]));
        setEntries([...output]);
        setStatus(`Đang đọc ${index + 1}/${files.length} file...`);
      }
      if (isMulti) {
        const seen = new Map<string, string>();
        output.forEach((entry) => {
          const date = entry.result.metricDate;
          if (!date) return;
          const first = seen.get(date);
          if (first) entry.result.errors.push({ row: 1, column: 'Tên file', message: `${entry.file.name}: trùng ngày ${date} với ${first}` });
          else seen.set(date, entry.file.name);
        });
        setEntries([...output]);
      }
      const errors = output.reduce((sum, item) => sum + item.result.errors.length, 0);
      setStatus(errors ? `Đã đọc ${files.length} file, cần xử lý ${errors} lỗi.` : `${files.length} file đã sẵn sàng để import.`);
    } catch (error) {
      setStatus(`Lỗi: ${readableError(error)}`);
    }
  };

  const changeType = (next: DatasetType) => {
    workerRef.current?.terminate();
    setType(next);
    setEntries([]);
    setStatus('');
    setProgress(0);
  };
  const preview = entries[0]?.result;
  const dates = entries.map((entry) => entry.result.metricDate).filter(Boolean).sort() as string[];

  return <section>
    <header className="page-heading"><div><p>DATA PIPELINE</p><h1>Nhập dữ liệu</h1></div></header>
    <div className="import-grid">
      <article className="panel"><h2>1. Chọn nguồn dữ liệu</h2>
        <label>Loại dữ liệu<select value={type} onChange={(event) => changeType(event.target.value as DatasetType)}>
          <option value="orders">Tất cả đơn hàng</option>
          <option value="sample_orders">Đơn mẫu KOC</option>
          <option value="affiliate_orders">Đơn hàng Affiliate/KOC</option>
          <option value="ads">Quảng cáo TikTok</option>
          <option value="product_analysis">Phân tích sản phẩm</option>
        </select></label>
        <label className="drop-zone">CSV, XLSX hoặc XLS {isMulti && '- chọn nhiều file'}<input type="file" multiple={isMulti} accept=".csv,.xlsx,.xls" onChange={(event) => event.target.files && parseFiles(event.target.files)} /></label>
        <p className="field-note">Ads lấy ngày từ tên "creative data for product campaigns YYYY-MM-DD 00 ~ YYYY-MM-DD 23". Sản phẩm lấy ngày từ "product_list_YYYYMMDD".</p>
        <p>{status}</p>
        {progress > 0 && <progress value={progress} max="100" />}
      </article>
      <article className="panel"><h2>2. Kiểm tra và xác nhận</h2>{preview ? <>
        <div className="summary"><b>{entries.length}</b> file - <b>{totalRows.toLocaleString('vi-VN')}</b> dòng - <b>{totalErrors}</b> lỗi{dates.length > 0 && <> - {dates[0]} → {dates[dates.length - 1]}</>}</div>
        <div className="file-list">{entries.map(({ file, result }) => <div key={`${file.name}-${file.size}`}><span>{file.name}</span><b>{result.totalRows.toLocaleString('vi-VN')} dòng</b><em>{result.metricDate ?? 'ngày trong dữ liệu'}</em></div>)}</div>
        {totalErrors > 0 && <ul className="errors">{entries.flatMap((entry) => entry.result.errors).slice(0, 30).map((error, index) => <li key={index}>Dòng {error.row}, {error.column}: {error.message}</li>)}</ul>}
        <div className="preview"><table><thead><tr>{preview.headers.slice(0, 8).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 10).map((row, index) => <tr key={index}>{preview.headers.slice(0, 8).map((header) => <td key={header}>{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table></div>
        <button disabled={totalErrors > 0 || mutation.isPending || progress === 100} onClick={() => { setStatus(`Đang import ${entries.length} file...`); mutation.mutate(); }}>{mutation.isPending ? `Đang import ${entries.length} file...` : `Xác nhận import ${entries.length} file`}</button>
      </> : <p>Chọn file để xem preview. Dữ liệu chưa được gửi lên server ở bước này.</p>}</article>
    </div>
  </section>;
}
