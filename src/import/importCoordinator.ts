import type { QueryClient } from '@tanstack/react-query';
import { uploadImport } from './batchUploader';
import type { DatasetType, ImportRow } from './types';

export interface ImportRequest {
  file: File;
  datasetType: DatasetType;
  rows: ImportRow[];
}

/** Uploads at most two daily files concurrently to protect browser memory and DB locks. */
export async function coordinateImports(
  queryClient: QueryClient,
  requests: ImportRequest[],
  onProgress: (value: number) => void,
) {
  const progress = requests.map(() => 0);
  const jobs: string[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < requests.length) {
      const index = cursor++;
      const request = requests[index];
      const job = await uploadImport(request.file, request.datasetType, request.rows, (value) => {
        progress[index] = value;
        onProgress(Math.round(progress.reduce((sum, item) => sum + item, 0) / progress.length));
      });
      jobs[index] = job;
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, requests.length) }, worker));
  await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  return jobs;
}
