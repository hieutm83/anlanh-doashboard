import type { QueryClient } from '@tanstack/react-query';
import { uploadImport } from './batchUploader';
import type { DatasetType, ImportRow } from './types';

interface ImportRequest {
  file: File;
  datasetType: DatasetType;
  rows: ImportRow[];
  onProgress: (value: number) => void;
}

/**
 * Owns the complete write-heavy import lifecycle. `uploadImport` resolves only
 * after `finalize_import` has rebuilt every affected aggregate date.
 */
export async function coordinateImport(queryClient: QueryClient, request: ImportRequest) {
  const jobId = await uploadImport(request.file, request.datasetType, request.rows, request.onProgress);
  await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  return jobId;
}
