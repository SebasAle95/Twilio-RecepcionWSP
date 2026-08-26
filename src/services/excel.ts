import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Relevamiento } from '../types/relevamiento';
import { subirAGoogleDrive, descargarDeGoogleDrive } from './gdrive';
import { LOCALES_CONOCIDOS } from '../config/locales';

const DATA_DIR   = path.join(process.cwd(), 'data');
const EXCEL_PATH = path.join(DATA_DIR, 'relevamientos.xlsx');

const HOJA_DATOS    = 'Datos';
const HOJA_DIARIO   = 'Diario';
const HOJA_SEMANAL  = 'Semanal';
const HOJA_MENSUAL  = 'Mensual';

/** Una venta de un local en una fecha. Clave única: fecha + local. */
interface Registro {
  fecha:       string;  // DD-MM-YYYY
  local:       string;
  cantidad:    number;
  remitente:   string;
  actualizado: string;  // cuándo se cargó o corrigió
}

// ── Fechas ───────────────────────────────────────────────────────────────────

const pad = (n: number) => n.toString().padStart(2, '0');

function aTexto(f: Date): string {
  return `${pad(f.getDate())}-${pad(f.getMonth() + 1)}-${f.getFullYear()}`;
}

function deTexto(s: string): Date {
  const [d, m, a] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Clave ordenable alfabéticamente (YYYY-MM-DD). */
function aClave(f: Date): string {
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
}

/** Lunes de la semana a la que pertenece la fecha. */
function inicioSemana(f: Date): Date {
  const x = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const dia = x.getDay();
  x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
  return x;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Workbook ─────────────────────────────────────────────────────────────────

/**
 * Trae el workbook, priorizando el historial de Drive.
 *
 * El disco de Railway es efímero: si el archivo local no está, hay que bajarlo
 * de Drive antes de agregar nada, o se pierde todo lo anterior.
 */
async function obtenerWorkbook(): Promise<ExcelJS.Workbook> {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(EXCEL_PATH)) {
    try {
      await descargarDeGoogleDrive(EXCEL_PATH);
    } catch (e) {
      // Si Drive falla, seguimos en local para no perder el mensaje entrante.
      // El upload posterior va a reintentar y ahí sí se reporta el error.
      console.error('No se pudo recuperar el historial de Drive:', e);
    }
  }

  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL_PATH)) {
    await wb.xlsx.readFile(EXCEL_PATH);
  }
  return wb;
}

// ── Hoja Datos (fuente de verdad) ────────────────────────────────────────────

const COLUMNAS_DATOS: Partial<ExcelJS.Column>[] = [
  { header: 'Fecha',       key: 'fecha',       width: 14 },
  { header: 'Local',       key: 'local',       width: 26 },
  { header: 'Cantidad',    key: 'cantidad',    width: 12 },
  { header: 'Remitente',   key: 'remitente',   width: 22 },
  { header: 'Actualizado', key: 'actualizado', width: 20 },
];

function leerDatos(wb: ExcelJS.Workbook): Registro[] {
  const ws = wb.getWorksheet(HOJA_DATOS);
  if (!ws) return [];

  const registros: Registro[] = [];
  ws.eachRow((row, nro) => {
    if (nro === 1) return; // encabezado

    const fecha = String(row.getCell(1).value ?? '').trim();
    const local = String(row.getCell(2).value ?? '').trim();
    if (!fecha || !local) return;

    registros.push({
      fecha,
      local,
      cantidad:    Number(row.getCell(3).value ?? 0),
      remitente:   String(row.getCell(4).value ?? ''),
      actualizado: String(row.getCell(5).value ?? ''),
    });
  });
  return registros;
}

/**
 * Aplica el relevamiento sobre los registros existentes.
 * Si ya hay un dato para esa fecha y local, se pisa (es una corrección).
 */
function upsert(registros: Registro[], rel: Relevamiento): { nuevos: number; corregidos: number } {
  const fecha = aTexto(rel.fecha);
  const ahora = new Date().toLocaleString('es-AR');

  let nuevos = 0;
  let corregidos = 0;

  for (const local of rel.locales) {
    const i = registros.findIndex(r => r.fecha === fecha && r.local === local.nombre);
    const registro: Registro = {
      fecha,
      local:       local.nombre,
      cantidad:    local.cantidad,
      remitente:   rel.remitente,
      actualizado: ahora,
    };

    if (i >= 0) {
      if (registros[i].cantidad !== local.cantidad) corregidos++;
      registros[i] = registro;
    } else {
      registros.push(registro);
      nuevos++;
    }
  }

  return { nuevos, corregidos };
}

// ── Armado de hojas ──────────────────────────────────────────────────────────

function recrearHoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const previa = wb.getWorksheet(nombre);
  if (previa) wb.removeWorksheet(previa.id);
  return wb.addWorksheet(nombre);
}

function estilarEncabezado(ws: ExcelJS.Worksheet): void {
  const fila = ws.getRow(1);
  fila.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  fila.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function escribirDatos(wb: ExcelJS.Workbook, registros: Registro[]): void {
  const ws = recrearHoja(wb, HOJA_DATOS);
  ws.columns = COLUMNAS_DATOS;

  const ordenados = [...registros].sort((a, b) => {
    const fa = aClave(deTexto(a.fecha));
    const fb = aClave(deTexto(b.fecha));
    return fa === fb ? a.local.localeCompare(b.local) : fa.localeCompare(fb);
  });

  for (const r of ordenados) ws.addRow(r);
  estilarEncabezado(ws);
}

/** Locales conocidos primero (en el orden configurado), después los que aparecieron sueltos. */
function ordenarLocales(registros: Registro[]): string[] {
  const presentes = new Set(registros.map(r => r.local));
  const conocidos = LOCALES_CONOCIDOS.filter(l => presentes.has(l));
  const extras    = [...presentes].filter(l => !LOCALES_CONOCIDOS.includes(l)).sort();
  return [...conocidos, ...extras];
}

/**
 * Arma una hoja pivote: filas = periodo, columnas = locales, celdas = suma.
 *
 * @param agrupar  de un registro devuelve { clave, etiqueta } del periodo
 */
function escribirPivote(
  wb: ExcelJS.Workbook,
  nombre: string,
  etiquetaPeriodo: string,
  registros: Registro[],
  agrupar: (f: Date) => { clave: string; etiqueta: string },
): void {
  const ws = recrearHoja(wb, nombre);
  const locales = ordenarLocales(registros);

  ws.columns = [
    { header: etiquetaPeriodo, key: 'periodo', width: 24 },
    ...locales.map(l => ({ header: l, key: l, width: 16 })),
    { header: 'Total', key: '__total', width: 12 },
  ];

  // clave de periodo -> { etiqueta, local -> suma }
  const grupos = new Map<string, { etiqueta: string; valores: Map<string, number> }>();

  for (const r of registros) {
    const { clave, etiqueta } = agrupar(deTexto(r.fecha));
    if (!grupos.has(clave)) grupos.set(clave, { etiqueta, valores: new Map() });
    const valores = grupos.get(clave)!.valores;
    valores.set(r.local, (valores.get(r.local) ?? 0) + r.cantidad);
  }

  for (const clave of [...grupos.keys()].sort()) {
    const { etiqueta, valores } = grupos.get(clave)!;
    const fila: Record<string, string | number> = { periodo: etiqueta };
    let total = 0;
    for (const l of locales) {
      const v = valores.get(l) ?? 0;
      fila[l] = v;
      total += v;
    }
    fila.__total = total;
    ws.addRow(fila);
  }

  ws.getColumn('__total').font = { bold: true };
  estilarEncabezado(ws);
}

function reconstruirVistas(wb: ExcelJS.Workbook, registros: Registro[]): void {
  escribirPivote(wb, HOJA_DIARIO, 'Fecha', registros, f => ({
    clave:    aClave(f),
    etiqueta: aTexto(f),
  }));

  escribirPivote(wb, HOJA_SEMANAL, 'Semana', registros, f => {
    const ini = inicioSemana(f);
    const fin = new Date(ini);
    fin.setDate(fin.getDate() + 6);
    return {
      clave:    aClave(ini),
      etiqueta: `${pad(ini.getDate())}-${pad(ini.getMonth() + 1)} al ${pad(fin.getDate())}-${pad(fin.getMonth() + 1)}-${fin.getFullYear()}`,
    };
  });

  escribirPivote(wb, HOJA_MENSUAL, 'Mes', registros, f => ({
    clave:    `${f.getFullYear()}-${pad(f.getMonth() + 1)}`,
    etiqueta: `${MESES[f.getMonth()]} ${f.getFullYear()}`,
  }));
}

// ── Export principal ─────────────────────────────────────────────────────────

/**
 * Serializa los mensajes: dos relevamientos simultáneos leyendo el mismo
 * archivo se pisarían entre sí.
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
  const { nuevos, corregidos } = upsert(registros, relevamiento);

  escribirDatos(wb, registros);
  reconstruirVistas(wb, registros);

  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(
    `Excel actualizado: ${nuevos} nuevos, ${corregidos} corregidos, ${registros.length} registros en total`,
  );

  // SKIP_DRIVE=1 permite correr la simulación local sin credenciales.
  if (process.env.SKIP_DRIVE === '1') {
    console.log('SKIP_DRIVE=1 — no se sube a Drive');
    return;
  }

  const url = await subirAGoogleDrive(EXCEL_PATH);
  console.log(`Google Drive: ${url}`);
}
