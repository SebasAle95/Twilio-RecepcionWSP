import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Relevamiento } from '../types/relevamiento';
import {
  Registro, Vista, VistaDiaria,
  aTexto, conHora, aClave, deTexto,
  vistaDiaria, vistaSemanal, vistaMensual,
} from './vistas';

/**
 * Railway define RAILWAY_VOLUME_MOUNT_PATH cuando hay un volumen montado.
 * Ahi el archivo sobrevive a los reinicios; sin volumen cae en ./data, que es
 * efimero y sirve solo para desarrollo local.
 */
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  || process.env.DATA_DIR
  || path.join(process.cwd(), 'data');

export const EXCEL_PATH = path.join(DATA_DIR, 'relevamientos.xlsx');

const HOJA_DATOS = 'Datos';

// ── Workbook ─────────────────────────────────────────────────────────────────

async function obtenerWorkbook(): Promise<ExcelJS.Workbook> {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL_PATH)) {
    await wb.xlsx.readFile(EXCEL_PATH);
  }
  return wb;
}

// ── Hoja Datos (fuente de verdad) ────────────────────────────────────────────

const COLUMNAS_DATOS: Partial<ExcelJS.Column>[] = [
  { header: 'Fecha',     key: 'fecha',     width: 14 },
  { header: 'Recibido',  key: 'recibido',  width: 20 },
  { header: 'Local',     key: 'local',     width: 26 },
  { header: 'Cantidad',  key: 'cantidad',  width: 12 },
  { header: 'Remitente', key: 'remitente', width: 22 },
];

function leerDatos(wb: ExcelJS.Workbook): Registro[] {
  const ws = wb.getWorksheet(HOJA_DATOS);
  if (!ws) return [];

  const registros: Registro[] = [];
  ws.eachRow((row, nro) => {
    if (nro === 1) return; // encabezado

    const fecha = String(row.getCell(1).value ?? '').trim();
    const local = String(row.getCell(3).value ?? '').trim();
    if (!fecha || !local) return;

    registros.push({
      fecha,
      recibido:  String(row.getCell(2).value ?? '').trim(),
      local,
      cantidad:  Number(row.getCell(4).value ?? 0),
      remitente: String(row.getCell(5).value ?? ''),
    });
  });
  return registros;
}

// ── Escritura de hojas ───────────────────────────────────────────────────────

function recrearHoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const previa = wb.getWorksheet(nombre);
  if (previa) wb.removeWorksheet(previa.id);
  return wb.addWorksheet(nombre);
}

function estilarEncabezado(ws: ExcelJS.Worksheet): void {
  const fila = ws.getRow(1);
  fila.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E5C' } };
  fila.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function escribirDatos(wb: ExcelJS.Workbook, registros: Registro[]): void {
  const ws = recrearHoja(wb, HOJA_DATOS);
  ws.columns = COLUMNAS_DATOS;

  const ordenados = [...registros].sort((a, b) => {
    const fa = aClave(deTexto(a.fecha)) + a.recibido.slice(11);
    const fb = aClave(deTexto(b.fecha)) + b.recibido.slice(11);
    return fa === fb ? a.local.localeCompare(b.local) : fa.localeCompare(fb);
  });

  for (const r of ordenados) ws.addRow(r);
  estilarEncabezado(ws);
}

/** Hoja Diario: cada carga con su hora, y el acumulado del dia debajo. */
function escribirDiario(wb: ExcelJS.Workbook, vista: VistaDiaria): void {
  const ws = recrearHoja(wb, 'Diario');

  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Hora',  key: 'hora',  width: 10 },
    ...vista.locales.map(l => ({ header: l, key: l, width: 16 })),
    { header: 'Total', key: '__total', width: 12 },
  ];

  for (const dia of vista.dias) {
    for (const carga of dia.cargas) {
      const row: Record<string, string | number> = { fecha: dia.fecha, hora: carga.hora };
      vista.locales.forEach((l, i) => { row[l] = carga.valores[i]; });
      row.__total = carga.total;
      ws.addRow(row);
    }

    const row: Record<string, string | number> = { fecha: dia.fecha, hora: 'TOTAL DIA' };
    vista.locales.forEach((l, i) => { row[l] = dia.totales[i]; });
    row.__total = dia.totalGeneral;
    const filaTotal = ws.addRow(row);
    filaTotal.font = { bold: true };
    filaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F2EF' } };
  }

  ws.getColumn('__total').font = { bold: true };
  estilarEncabezado(ws);
}

function escribirVista(wb: ExcelJS.Workbook, vista: Vista): void {
  const ws = recrearHoja(wb, vista.titulo);

  ws.columns = [
    { header: vista.periodo, key: 'periodo', width: 24 },
    ...vista.locales.map(l => ({ header: l, key: l, width: 16 })),
    { header: 'Total', key: '__total', width: 12 },
  ];

  for (const fila of vista.filas) {
    const row: Record<string, string | number> = { periodo: fila.etiqueta };
    vista.locales.forEach((l, i) => { row[l] = fila.valores[i]; });
    row.__total = fila.total;
    ws.addRow(row);
  }

  const pie: Record<string, string | number> = { periodo: 'TOTAL' };
  vista.locales.forEach((l, i) => { pie[l] = vista.totales[i]; });
  pie.__total = vista.totalGeneral;
  ws.addRow(pie).font = { bold: true };

  ws.getColumn('__total').font = { bold: true };
  estilarEncabezado(ws);
}

// ── API publica ──────────────────────────────────────────────────────────────

/** Los registros guardados, para el panel web. */
export async function obtenerRegistros(): Promise<Registro[]> {
  if (!fs.existsSync(EXCEL_PATH)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  return leerDatos(wb);
}

/**
 * Serializa los mensajes: dos relevamientos simultaneos leyendo el mismo
 * archivo se pisarian entre si.
 */
let cola: Promise<unknown> = Promise.resolve();

export function agregarAlExcel(relevamiento: Relevamiento): Promise<void> {
  const tarea = cola.then(() => procesar(relevamiento));
  cola = tarea.catch(() => {}); // un fallo no debe trabar los mensajes siguientes
  return tarea;
}

async function procesar(relevamiento: Relevamiento): Promise<void> {
  const wb = await obtenerWorkbook();
  const registros = leerDatos(wb);

  // Cada mensaje se agrega: nunca reemplaza lo anterior.
  const recibido = conHora(new Date());
  for (const local of relevamiento.locales) {
    registros.push({
      fecha:     aTexto(relevamiento.fecha),
      recibido,
      local:     local.nombre,
      cantidad:  local.cantidad,
      remitente: relevamiento.remitente,
    });
  }

  escribirDatos(wb, registros);
  escribirDiario(wb, vistaDiaria(registros));
  escribirVista(wb, vistaSemanal(registros));
  escribirVista(wb, vistaMensual(registros));

  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(
    `Excel actualizado: carga de ${relevamiento.locales.length} locales, ` +
    `${registros.length} registros acumulados`,
  );
}
