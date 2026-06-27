export function downloadText(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportJson(name: string, value: unknown) {
  downloadText(`${name}.json`, JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
}

export function exportMarkdown(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return downloadText(`${name}.md`, '_Không có dữ liệu._', 'text/markdown');
  const columns = Object.keys(rows[0]);
  const clean = (v: unknown) => String(v ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const content = [
    `# ${name}`,
    '',
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((key) => clean(row[key])).join(' | ')} |`),
  ].join('\n');
  downloadText(`${name}.md`, content, 'text/markdown;charset=utf-8');
}
