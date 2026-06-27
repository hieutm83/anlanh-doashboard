import { supabase } from '../database/supabase';
import type { DatasetType, ImportRow } from './types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadImport(file: File, datasetType: DatasetType, rows: ImportRow[], onProgress: (value: number) => void) {
  const { data: job, error: beginError } = await supabase.rpc('begin_import', { p_dataset_type: datasetType, p_filename: file.name, p_total_rows: rows.length });
  if (beginError) throw beginError;
  const jobId = job as string;
  const { data: jobRow, error: jobError } = await supabase.from('import_jobs').select('organization_id').eq('id', jobId).single();
  if (jobError) throw jobError;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${jobRow.organization_id}/${jobId}/${safeName}`;
  const { error: storageError } = await supabase.storage.from('imports').upload(storagePath, file, { upsert: false });
  if (storageError) throw storageError;
  const { error: pathError } = await supabase.from('import_jobs').update({ storage_path: storagePath }).eq('id', jobId);
  if (pathError) throw pathError;
  const chunkSize = 750;
  for (let start = 0, batch = 0; start < rows.length; start += chunkSize, batch += 1) {
    const payload = rows.slice(start, start + chunkSize);
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error } = await supabase.rpc('import_generic_batch', { p_job_id: jobId, p_batch_no: batch, p_rows: payload });
      if (!error) { lastError = null; break; }
      lastError = error;
      await sleep(500 * 2 ** attempt + Math.random() * 250);
    }
    if (lastError) throw lastError;
    // Reserve the last 5% for database finalization and aggregate refresh.
    onProgress(Math.min(95, Math.round((start + payload.length) / rows.length * 95)));
  }
  const { error } = await supabase.rpc('finalize_import', { p_job_id: jobId });
  if (error) throw error;
  onProgress(100);
  return jobId;
}
