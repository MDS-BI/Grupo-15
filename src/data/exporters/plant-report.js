/**
 * @file Exportación local del reporte consolidado de planta (US-08), sin
 * dependencias externas: CSV para Excel y vista imprimible para PDF.
 */

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {ReturnType<typeof import('../../domain/plant-performance.js').buildConsolidatedReport>} report
 * @returns {string}
 */
export function reportToCsv(report) {
  const lines = [];
  lines.push(['Reporte consolidado de planta']);
  lines.push(['Período', report.period?.label || '']);
  lines.push(['Generado', report.generated_at || '']);
  lines.push([]);
  lines.push(['Centro', 'Carga (min)', 'Capacidad (min)', 'Utilización', 'OEE']);
  for (const [workCenterId, load] of Object.entries(report.load_by_work_center || {})) {
    const oee = report.oee_by_work_center?.[workCenterId];
    lines.push([
      workCenterId,
      load.load_minutes,
      load.capacity_minutes,
      load.load_ratio,
      oee && oee.oee !== null ? oee.oee : '',
    ]);
  }
  lines.push([]);
  lines.push(['Motivo de parada', 'Minutos']);
  for (const row of report.downtime_by_reason || []) {
    lines.push([row.reason_label || row.reason_id, row.downtime_minutes]);
  }
  lines.push([]);
  lines.push(['Cumplimiento', 'Órdenes a tiempo', 'Órdenes con fecha', 'Ratio']);
  lines.push([
    'Órdenes',
    report.fulfillment?.completed_on_time ?? 0,
    report.fulfillment?.total_with_due_date ?? 0,
    report.fulfillment?.ratio ?? '',
  ]);
  return lines.map((row) => row.map(csvCell).join(',')).join('\n');
}

/**
 * @param {ReturnType<typeof import('../../domain/plant-performance.js').buildConsolidatedReport>} report
 * @returns {string}
 */
export function reportToPrintableHtml(report) {
  const centerRows = Object.entries(report.load_by_work_center || {})
    .map(([workCenterId, load]) => {
      const oee = report.oee_by_work_center?.[workCenterId];
      return `<tr><td>${workCenterId}</td><td>${load.load_minutes}</td><td>${load.capacity_minutes}</td><td>${load.load_ratio}</td><td>${oee && oee.oee !== null ? oee.oee : '—'}</td></tr>`;
    })
    .join('');
  const downtimeRows = (report.downtime_by_reason || [])
    .map(
      (row) =>
        `<tr><td>${row.reason_label || row.reason_id}</td><td>${row.downtime_minutes}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Reporte de planta</title>
    <style>body{font-family:Arial,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%;margin-bottom:1.5rem}th,td{border:1px solid #999;padding:.4rem;text-align:left}</style>
    </head><body>
      <h1>Reporte consolidado de planta</h1>
      <p>Período: ${report.period?.label || ''} · Generado: ${report.generated_at || ''}</p>
      <p>Solo contexto operacional — no evaluación de desempeño.</p>
      <h2>Carga y OEE por centro</h2>
      <table><thead><tr><th>Centro</th><th>Carga (min)</th><th>Capacidad (min)</th><th>Utilización</th><th>OEE</th></tr></thead><tbody>${centerRows}</tbody></table>
      <h2>Paradas por motivo</h2>
      <table><thead><tr><th>Motivo</th><th>Minutos</th></tr></thead><tbody>${downtimeRows}</tbody></table>
      <h2>Cumplimiento</h2>
      <p>Órdenes a tiempo: ${report.fulfillment?.completed_on_time ?? 0} de ${report.fulfillment?.total_with_due_date ?? 0}.</p>
    </body></html>`;
}

/**
 * Descarga el CSV en el navegador (no-op fuera del navegador).
 * @param {Object} report
 * @param {string} [filename]
 */
export function downloadCsv(report, filename = 'reporte-planta.csv') {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }
  const blob = new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Abre una vista imprimible del reporte (PDF vía impresión del navegador).
 * @param {Object} report
 */
export function printReport(report) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return false;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(reportToPrintableHtml(report));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
