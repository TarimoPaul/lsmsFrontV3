/**
 * Client-side exports shared by feature modules — replaces Flutter's
 * per-module `*_export_service.dart` (which wrote temp files on web and never
 * actually downloaded anything).
 *
 *   downloadCsv('categories', ['Name', 'Products'], rows.map((r) => [r.name, r.count]));
 *   printReport({ title: 'Categories', headers, rows, summary: [['Total', '12']] });
 */

export type Cell = string | number | boolean | null | undefined;

/** `categories_2026-09-23.csv` */
export function exportFileName(base: string, ext: string, now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${base}_${d}.${ext}`;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Swahili/accents correctly. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadCsv(base: string, headers: string[], rows: Cell[][]): void {
  downloadBlob(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), exportFileName(base, 'csv'));
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PrintReport {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Cell[][];
  /** Label/value pairs rendered above the table. */
  summary?: Array<[string, string | number]>;
  /** Column indexes to right-align (numbers). */
  numeric?: number[];
}

/**
 * Print-ready report (the browser's "Save as PDF" produces the PDF) rendered
 * in a hidden iframe, so no PDF library ships in the bundle.
 */
/** HTML-escape a cell for the print templates. */
export function escapeHtml(v: Cell): string {
  return (v === null || v === undefined ? '' : String(v))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function printReport(r: PrintReport): void {
  const esc = escapeHtml;
  const num = new Set(r.numeric ?? []);
  const td = (v: Cell, i: number, tag = 'td') => `<${tag}${num.has(i) ? ' class="n"' : ''}>${esc(v)}</${tag}>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    @page { margin: 14mm; }
    body { font: 12px/1.45 'Plus Jakarta Sans', system-ui, sans-serif; color: #0f172a; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3b7597; padding-bottom: 8px; margin-bottom: 14px; }
    h1 { font-size: 18px; margin: 0; color: #3b7597; } small { color: #64748b; }
    .sum { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .sum div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; } .sum b { display: block; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fafbfc; } .n { text-align: right; font-variant-numeric: tabular-nums; }
  </style></head><body>
    <header><div><h1>${esc(r.title)}</h1>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ''}</div>
    <small>LSMS · ${esc(new Date().toLocaleString())}</small></header>
    ${r.summary?.length ? `<div class="sum">${r.summary.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    <table><thead><tr>${r.headers.map((h, i) => td(h, i, 'th')).join('')}</tr></thead>
    <tbody>${r.rows.map((row) => `<tr>${row.map((v, i) => td(v, i)).join('')}</tr>`).join('')}</tbody></table>
  </body></html>`;
  printHtml(html);
}

/** Print a complete HTML document from a hidden iframe (receipts, reports). */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    // Browsers that don't fire afterprint (or block print) still clean up.
    setTimeout(cleanup, 60_000);
  }, 150);
}
