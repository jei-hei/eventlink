/** Build and trigger a CSV file download in the browser. */
export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (cell: string) => `"${String(cell ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
