import { LocalConcurrencia, Relevamiento } from '../types/relevamiento';
import { matchearLocal } from './fuzzy';
import { hoy, fechaCalendario, aTexto } from './vistas';

function esRelevamiento(texto: string): boolean {
  return texto.toUpperCase().includes('RELEVAMIENTO');
}

/**
 * A que jornada corresponde el mensaje.
 *
 * Con una fecha escrita en el texto la carga es retroactiva: va a ese dia.
 * Sin fecha va a la jornada en curso, que pasada la medianoche sigue siendo
 * la que arranco la manana anterior.
 *
 * Una fecha mal escrita no se puede consultar con quien la mando —el sistema
 * no responde mensajes— asi que ante la duda se prefiere la jornada en curso,
 * que es visible en el panel, antes que un dia lejano donde el dato se pierde.
 */
function extraerFecha(texto: string): Date {
  const jornada = hoy();

  const m = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return jornada;

  const dia  = Number(m[1]);
  const mes  = Number(m[2]);
  const anio = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);

  const fecha = new Date(anio, mes - 1, dia);

  // Una fecha imposible (32/13) no falla: Date la "rueda" a otra. Se detecta
  // comparando contra lo que se pidio.
  if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1 || fecha.getFullYear() !== anio) {
    console.warn(`Fecha inexistente en el mensaje: "${m[0]}". Se usa la jornada en curso.`);
    return jornada;
  }

  // Error humano tipico: a las 2 AM la jornada en curso es la del dia
  // anterior, pero la persona escribe la fecha de "hoy" del calendario.
  // Quiso decir "ahora", asi que va a la jornada en curso y no parte la noche.
  // Va antes que el chequeo de fecha futura, que si no se lleva este caso.
  if (aTexto(fecha) === aTexto(fechaCalendario())) return jornada;

  // Un relevamiento no puede ser de un dia que todavia no paso
  if (fecha.getTime() > jornada.getTime()) {
    console.warn(`Fecha futura en el mensaje: "${m[0]}". Se usa la jornada en curso.`);
    return jornada;
  }

  return fecha;
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
