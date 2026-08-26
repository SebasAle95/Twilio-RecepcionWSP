import { LOCALES_CONOCIDOS } from '../config/locales';

/** Una venta de un local en una fecha. Clave única: fecha + local. */
export interface Registro {
  fecha:       string;  // DD-MM-YYYY
  local:       string;
  cantidad:    number;
  remitente:   string;
  actualizado: string;
}

/** Tabla pivote lista para renderizar: filas = periodo, columnas = locales. */
export interface Vista {
  titulo:    string;
  periodo:   string;           // encabezado de la primera columna
  locales:   string[];
  filas:     { etiqueta: string; valores: number[]; total: number }[];
  totales:   number[];         // total por local, al pie
  totalGeneral: number;
}

// ── Fechas ───────────────────────────────────────────────────────────────────

export const pad = (n: number) => n.toString().padStart(2, '0');

export function aTexto(f: Date): string {
  return `${pad(f.getDate())}-${pad(f.getMonth() + 1)}-${f.getFullYear()}`;
}

export function deTexto(s: string): Date {
  const [d, m, a] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Clave ordenable alfabéticamente (YYYY-MM-DD). */
export function aClave(f: Date): string {
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function inicioSemana(f: Date): Date {
  const x = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const dia = x.getDay();
  x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
  return x;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Armado de vistas ─────────────────────────────────────────────────────────

/** Locales conocidos primero (en el orden configurado), después los sueltos. */
export function ordenarLocales(registros: Registro[]): string[] {
  const presentes = new Set(registros.map(r => r.local));
  const conocidos = LOCALES_CONOCIDOS.filter(l => presentes.has(l));
  const extras    = [...presentes].filter(l => !LOCALES_CONOCIDOS.includes(l)).sort();
  return [...conocidos, ...extras];
}

/**
 * Agrupa los registros por periodo y suma por local.
 *
 * @param agrupar  de una fecha devuelve { clave (ordenable), etiqueta (visible) }
 */
function pivotear(
  titulo: string,
  periodo: string,
  registros: Registro[],
  agrupar: (f: Date) => { clave: string; etiqueta: string },
): Vista {
  const locales = ordenarLocales(registros);
  const grupos = new Map<string, { etiqueta: string; valores: Map<string, number> }>();

  for (const r of registros) {
    const { clave, etiqueta } = agrupar(deTexto(r.fecha));
    if (!grupos.has(clave)) grupos.set(clave, { etiqueta, valores: new Map() });
    const valores = grupos.get(clave)!.valores;
    valores.set(r.local, (valores.get(r.local) ?? 0) + r.cantidad);
  }

  const filas = [...grupos.keys()].sort().map(clave => {
    const { etiqueta, valores } = grupos.get(clave)!;
    const vals = locales.map(l => valores.get(l) ?? 0);
    return { etiqueta, valores: vals, total: vals.reduce((a, b) => a + b, 0) };
  });

  const totales = locales.map((_, i) => filas.reduce((a, f) => a + f.valores[i], 0));

  return {
    titulo,
    periodo,
    locales,
    filas,
    totales,
    totalGeneral: totales.reduce((a, b) => a + b, 0),
  };
}

export function vistaDiaria(registros: Registro[]): Vista {
  return pivotear('Diario', 'Fecha', registros, f => ({
    clave:    aClave(f),
    etiqueta: aTexto(f),
  }));
}

export function vistaSemanal(registros: Registro[]): Vista {
  return pivotear('Semanal', 'Semana', registros, f => {
    const ini = inicioSemana(f);
    const fin = new Date(ini);
    fin.setDate(fin.getDate() + 6);
    return {
      clave:    aClave(ini),
      etiqueta: `${pad(ini.getDate())}-${pad(ini.getMonth() + 1)} al ${pad(fin.getDate())}-${pad(fin.getMonth() + 1)}-${fin.getFullYear()}`,
    };
  });
}

export function vistaMensual(registros: Registro[]): Vista {
  return pivotear('Mensual', 'Mes', registros, f => ({
    clave:    `${f.getFullYear()}-${pad(f.getMonth() + 1)}`,
    etiqueta: `${MESES[f.getMonth()]} ${f.getFullYear()}`,
  }));
}

export function todasLasVistas(registros: Registro[]): Vista[] {
  return [vistaDiaria(registros), vistaSemanal(registros), vistaMensual(registros)];
}
