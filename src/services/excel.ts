import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Relevamiento } from '../types/relevamiento';

const DATA_DIR = path.join(process.cwd(), 'data');
const EXCEL_PATH = path.join(DATA_DIR, 'relevamientos.xlsx');

// ── Helpers de nombre de hoja ────────────────────────────────────────────────

function nombreHojaDia(fecha: Date): string {
  const d = fecha.getDate().toString().padStart(2, '0');
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const a = fecha.getFullYear();
  return `${d}-${m}-${a}`;
}

function nombreHojaSemana(fecha: Date): string {
  const inicio = new Date(fecha);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  return `Sem ${fmt(inicio)} al ${fmt(fin)}`;
}

function nombreHojaMes(fecha: Date): string {
  const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];
  return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// ── Workbook ─────────────────────────────────────────────────────────────────

async function obtenerWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL_PATH)) {
    await wb.xlsx.readFile(EXCEL_PATH);
  }
  return wb;
}

const COLUMNAS: Partial<ExcelJS.Column>[] = [
  { header: 'Fecha',           key: 'fecha',           width: 14 },
  { header: 'Local',           key: 'local',           width: 25 },
  { header: 'Nombre original', key: 'nombreOriginal',  width: 25 },
  { header: 'Cantidad',        key: 'cantidad',        width: 12 },
  { header: 'Remitente',       key: 'remitente',       width: 20 },
];

function obtenerOCrearHoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  let ws = wb.getWorksheet(nombre);
  if (!ws) {
    ws = wb.addWorksheet(nombre);
    ws.columns = COLUMNAS;
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    header.alignment = { horizontal: 'center' };
  }
  return ws;
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function agregarAlExcel(relevamiento: Relevamiento): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const wb = await obtenerWorkbook();

  const hojasDestino = [
    nombreHojaDia(relevamiento.fecha),
    nombreHojaSemana(relevamiento.fecha),
    nombreHojaMes(relevamiento.fecha),
  ];

  const fechaStr = nombreHojaDia(relevamiento.fecha);

  for (const nombre of hojasDestino) {
    const ws = obtenerOCrearHoja(wb, nombre);

    for (const local of relevamiento.locales) {
      ws.addRow({
        fecha:          fechaStr,
        local:          local.nombre,
        nombreOriginal: local.nombre !== local.nombreOriginal ? local.nombreOriginal : '',
        cantidad:       local.cantidad,
        remitente:      relevamiento.remitente,
      });
    }
  }

  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(`Excel actualizado: ${EXCEL_PATH}`);
}
