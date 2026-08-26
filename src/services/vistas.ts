import { LOCALES_CONOCIDOS } from '../config/locales';

/**
 * Una linea de un mensaje recibido.
 *
 * Los mensajes se acumulan: si en el dia llegan tres relevamientos, el total
 * del dia es la suma de los tres. Cada registro conserva la hora en que llego
 * para poder mostrar la linea de tiempo.
 */
export interface Registro {
  fecha:     string;  // DD-MM-YYYY — a que dia corresponde el relevamiento
  recibido:  string;  // DD-MM-YYYY HH:MM — cuando llego el mensaje
  local:     string;
  cantidad:  number;
  remitente: string;
}

/** Un mensaje: los valores que trajo, con su hora. */
export interface Carga {
  hora:      string;    // HH:MM
  recibido:  string;
  valores:   number[];  // alineado con `locales`
  total:     number;
}

/** Un dia con sus cargas y el acumulado. */
export interface Dia {
  fecha:        string;
  cargas:       Carga[];
  totales:      number[];
  totalGeneral: number;
}

export interface VistaDiaria {
  locales: string[];
  dias:    Dia[];       // mas reciente primero
}

/** Un dia dentro de la grilla del calendario. */
export interface DiaCalendario {
  fecha:  string;  // DD-MM-YYYY
  dia:    number;
  cargas: number;
  total:  number;
  nivel:  number;  // 1-4 segun el total, para el sombreado
}

/** Un mes con su grilla de 6 semanas. `null` = celda fuera del mes. */
export interface MesCalendario {
  clave:        string;                    // YYYY-MM
  etiqueta:     string;                    // "Agosto 2026"
  celdas:       (DiaCalendario | null)[];  // 42 celdas, arranca lunes
  diasConCarga: number;
  totalMes:     number;
}

/** Tabla pivote simple: filas = periodo, columnas = locales, celdas = suma. */
export interface Vista {
  titulo:       string;
  periodo:      string;
  locales:      string[];
  filas:        { etiqueta: string; valores: number[]; total: number }[];
  totales:      number[];
  totalGeneral: number;
}

// ── Fechas ───────────────────────────────────────────────────────────────────

export const pad = (n: number) => n.toString().padStart(2, '0');

/**
 * Zona horaria del relevamiento.
 *
 * El servidor de Railway corre en UTC. Sin convertir, las horas se mostrarian
 * 3 horas adelantadas y —peor— un mensaje enviado despues de las 21:00 se
 * guardaria con la fecha del dia siguiente.
 */
export const ZONA = process.env.ZONA_HORARIA || 'America/Argentina/Buenos_Aires';

/** Componentes de un instante, ya convertidos a ZONA. */
function partesEnZona(f: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(f);

  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;

  return {
    anio: Number(valor('year')),
    mes:  Number(valor('month')),
    dia:  Number(valor('day')),
    hora: valor('hour') === '24' ? '00' : valor('hour'), // en-CA usa 24 a medianoche
    min:  valor('minute'),
    seg:  valor('second'),
  };
}

/**
 * Formatea los componentes locales de un Date, sin convertir zonas.
 * Es la inversa exacta de `deTexto`, asi que el ida y vuelta siempre cierra.
 */
export function aTexto(f: Date): string {
  return `${pad(f.getDate())}-${pad(f.getMonth() + 1)}-${f.getFullYear()}`;
}

/** El dia de hoy en ZONA, como Date a medianoche local (para round-trip). */
export function hoy(): Date {
  const p = partesEnZona(new Date());
  return new Date(p.anio, p.mes - 1, p.dia);
}

/**
 * Marca de recepcion en ZONA, con segundos: es lo que separa una carga de otra.
 * Sin segundos, dos mensajes del mismo minuto se fusionarian en una sola
 * linea de la vista diaria.
 */
export function ahoraConHora(): string {
  const p = partesEnZona(new Date());
  return `${pad(p.dia)}-${pad(p.mes)}-${p.anio} ${p.hora}:${p.min}:${p.seg}`;
}

export function deTexto(s: string): Date {
  const [d, m, a] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Clave ordenable alfabeticamente (YYYY-MM-DD). */
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

// ── Vistas ───────────────────────────────────────────────────────────────────

/** Locales conocidos primero (en el orden configurado), despues los sueltos. */
export function ordenarLocales(registros: Registro[]): string[] {
  const presentes = new Set(registros.map(r => r.local));
  const conocidos = LOCALES_CONOCIDOS.filter(l => presentes.has(l));
  const extras    = [...presentes].filter(l => !LOCALES_CONOCIDOS.includes(l)).sort();
  return [...conocidos, ...extras];
}

const suma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/**
 * Agrupa por dia y, dentro de cada dia, por mensaje recibido.
 * Los dias salen del mas reciente al mas viejo; las cargas, en orden cronologico.
 */
export function vistaDiaria(registros: Registro[]): VistaDiaria {
  const locales = ordenarLocales(registros);

  // fecha -> recibido -> local -> cantidad
  const porDia = new Map<string, Map<string, Map<string, number>>>();

  for (const r of registros) {
    if (!porDia.has(r.fecha)) porDia.set(r.fecha, new Map());
    const cargas = porDia.get(r.fecha)!;
    if (!cargas.has(r.recibido)) cargas.set(r.recibido, new Map());
    const valores = cargas.get(r.recibido)!;
    valores.set(r.local, (valores.get(r.local) ?? 0) + r.cantidad);
  }

  const dias: Dia[] = [...porDia.keys()]
    .sort((a, b) => aClave(deTexto(b)).localeCompare(aClave(deTexto(a)))) // desc
    .map(fecha => {
      const cargasMap = porDia.get(fecha)!;

      const cargas: Carga[] = [...cargasMap.keys()]
        .sort((a, b) => a.slice(11).localeCompare(b.slice(11))) // cronologico
        .map(recibido => {
          const v = cargasMap.get(recibido)!;
          const valores = locales.map(l => v.get(l) ?? 0);
          return {
            hora:     recibido.slice(11, 16), // HH:MM para mostrar
            recibido,
            valores,
            total:    suma(valores),
          };
        });

      const totales = locales.map((_, i) => suma(cargas.map(c => c.valores[i])));
      return { fecha, cargas, totales, totalGeneral: suma(totales) };
    });

  return { locales, dias };
}

/** Pivote generico para semanal y mensual. */
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

  const filas = [...grupos.keys()].sort().reverse().map(clave => {
    const { etiqueta, valores } = grupos.get(clave)!;
    const vals = locales.map(l => valores.get(l) ?? 0);
    return { etiqueta, valores: vals, total: suma(vals) };
  });

  const totales = locales.map((_, i) => suma(filas.map(f => f.valores[i])));

  return { titulo, periodo, locales, filas, totales, totalGeneral: suma(totales) };
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

/**
 * Grilla mensual que marca en que dias hubo carga y en cuales no.
 * Devuelve un mes por cada mes con datos, del mas reciente al mas viejo.
 */
export function vistaCalendario(registros: Registro[]): MesCalendario[] {
  if (!registros.length) return [];

  // fecha -> { cargas (mensajes distintos), total }
  const porFecha = new Map<string, { recibidos: Set<string>; total: number }>();

  for (const r of registros) {
    if (!porFecha.has(r.fecha)) porFecha.set(r.fecha, { recibidos: new Set(), total: 0 });
    const d = porFecha.get(r.fecha)!;
    d.recibidos.add(r.recibido);
    d.total += r.cantidad;
  }

  const maximo = Math.max(...[...porFecha.values()].map(d => d.total), 1);
  const nivelDe = (total: number) => Math.min(4, Math.ceil((total / maximo) * 4)) || 1;

  // Meses que tienen al menos un dia con datos
  const claves = new Set<string>();
  for (const fecha of porFecha.keys()) {
    const f = deTexto(fecha);
    claves.add(`${f.getFullYear()}-${pad(f.getMonth() + 1)}`);
  }

  return [...claves].sort().reverse().map(clave => {
    const [anio, mes] = clave.split('-').map(Number);
    const primero = new Date(anio, mes - 1, 1);
    const diasEnMes = new Date(anio, mes, 0).getDate();

    // Lunes = 0 para que la grilla arranque en lunes
    const offset = (primero.getDay() + 6) % 7;

    const celdas: (DiaCalendario | null)[] = Array(42).fill(null);
    let diasConCarga = 0;
    let totalMes = 0;

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = `${pad(dia)}-${pad(mes)}-${anio}`;
      const datos = porFecha.get(fecha);

      celdas[offset + dia - 1] = datos
        ? {
            fecha,
            dia,
            cargas: datos.recibidos.size,
            total:  datos.total,
            nivel:  nivelDe(datos.total),
          }
        : { fecha, dia, cargas: 0, total: 0, nivel: 0 };

      if (datos) {
        diasConCarga++;
        totalMes += datos.total;
      }
    }

    return {
      clave,
      etiqueta: `${MESES[mes - 1]} ${anio}`,
      celdas,
      diasConCarga,
      totalMes,
    };
  });
}
