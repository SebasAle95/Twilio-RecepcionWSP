import { LocalConcurrencia, Relevamiento } from '../types/relevamiento';
import { matchearLocal } from './fuzzy';
import { hoy } from './vistas';

function esRelevamiento(texto: string): boolean {
  return texto.toUpperCase().includes('RELEVAMIENTO');
}

function extraerFecha(texto: string): Date {
  const match = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    const anioCompleto = anio!.length === 2 ? `20${anio}` : anio!;
    return new Date(Number(anioCompleto), Number(mes) - 1, Number(dia));
  }
  // Sin fecha en el mensaje, es el dia de hoy en la zona del relevamiento
  return hoy();
}

export function parsearRelevamiento(texto: string, remitente: string): Relevamiento | null {
  if (!esRelevamiento(texto)) return null;

  const fecha = extraerFecha(texto);
  const locales: LocalConcurrencia[] = [];

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    // Patrón: "Nombre Local: 42"
    const match = linea.match(/^(.+?):\s*(\d+)\s*$/);
    if (!match) continue;

    const nombreOriginal = match[1]!.trim();
    const cantidad = parseInt(match[2]!, 10);

    // Ignorar la línea de encabezado "RELEVAMIENTO cada LOCAL"
    if (nombreOriginal.toUpperCase().includes('RELEVAMIENTO')) continue;

    const nombre = matchearLocal(nombreOriginal);

    locales.push({ nombre, nombreOriginal, cantidad });
  }

  if (locales.length === 0) return null;

  return { fecha, remitente, locales, textoOriginal: texto };
}
