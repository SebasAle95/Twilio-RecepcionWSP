import { LocalConcurrencia, Relevamiento } from '../types/relevamiento';
import { matchearLocal } from './fuzzy';
import { hoy, fechaCalendario, aTexto, HORA_CORTE, PRIMER_DIA } from './vistas';

function esRelevamiento(texto: string): boolean {
  return texto.toUpperCase().includes('RELEVAMIENTO');
}

/**
 * Fecha precedida por la palabra "fecha": la forma recomendada de pedirla.
 *
 * Acepta cualquier separador (\D) y no solo la barra: la palabra ya deja
 * clara la intencion, y un resbalon de tecla —"07(08/2026", con el parentesis
 * pegado a la barra— mandaria la carga al dia de hoy sin que nadie se entere.
 */
const FECHA_CON_PALABRA = /fecha\s*:?\s*(\d{1,2})\D(\d{1,2})\D(\d{2,4})/i;

/**
 * Fecha suelta en cualquier parte del texto, por si se olvidan la palabra.
 * Acá los separadores van acotados: sin la palabra que confirme la intencion,
 * ser permisivo convertiria cualquier par de numeros en una fecha.
 */
const FECHA_SUELTA = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;

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

  // La que lleva la palabra manda: es la que la persona escribio a proposito
  const m = texto.match(FECHA_CON_PALABRA) ?? texto.match(FECHA_SUELTA);
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

  // Ni antes del inicio del relevamiento: un año mal tipeado ("01/06/25")
  // mandaria la carga a un periodo que el panel no muestra
  if (fecha.getTime() < PRIMER_DIA.getTime()) {
    console.warn(`Fecha anterior al ${aTexto(PRIMER_DIA)}: "${m[0]}". Se usa la jornada en curso.`);
    return jornada;
  }

  return fecha;
}

/**
 * Hora declarada con "hora HH:MM". Acepta 24 horas y tambien am/pm.
 * Los minutos son opcionales: "hora 13" vale igual que "hora 13:00".
 */
const HORA_DECLARADA = /hora\s*:?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;

/**
 * A que momento corresponde la carga, si el mensaje lo declara.
 *
 * Devuelve "DD-MM-YYYY HH:MM:SS" ubicado en la jornada `fecha`. Una hora
 * anterior al corte cae en el dia calendario siguiente, porque las 02:00 de
 * una jornada ocurren despues de la medianoche.
 */
function extraerMomento(texto: string, fecha: Date): string | undefined {
  const m = texto.match(HORA_DECLARADA);
  if (!m) return undefined;

  let hora = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const sufijo = m[3]?.toLowerCase().replace(/\./g, '');

  if (sufijo === 'pm' && hora < 12) hora += 12;
  if (sufijo === 'am' && hora === 12) hora = 0;

  if (hora > 23 || min > 59) {
    console.warn(`Hora invalida en el mensaje: "${m[0]}". Se usa la hora de recepcion.`);
    return undefined;
  }

  const dia = new Date(fecha);
  if (hora < HORA_CORTE) dia.setDate(dia.getDate() + 1);

  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${aTexto(dia)} ${dosDigitos(hora)}:${dosDigitos(min)}:00`;
}

/**
 * Una linea que declara la fecha o la hora de la carga, no un local.
 *
 * "Fecha 01/06/26 Hora 11:00" en una linea propia termina en ":00", asi que el
 * patron "Local: N" la toma por un local con 0 personas. Ese local falso
 * aparece despues como una fila mas en todas las tablas.
 */
const FECHA_U_HORA = /\b(fecha|hora)\b/i;

export function esLineaDeFechaOHora(nombre: string): boolean {
  return FECHA_U_HORA.test(nombre);
}

export function parsearRelevamiento(texto: string, remitente: string): Relevamiento | null {
  if (!esRelevamiento(texto)) return null;

  const fecha = extraerFecha(texto);
  const momento = extraerMomento(texto, fecha);
  const locales: LocalConcurrencia[] = [];

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  for (const linea of lineas) {
    // Patrón: "Nombre Local: 42"
    const match = linea.match(/^(.+?):\s*(\d+)\s*$/);
    if (!match) continue;

    const nombreOriginal = match[1]!.trim();
    const cantidad = parseInt(match[2]!, 10);

    // Ignorar la línea de encabezado "RELEVAMIENTO cada LOCAL" y las que
    // declaran la fecha o la hora, que ya se leyeron más arriba
    if (nombreOriginal.toUpperCase().includes('RELEVAMIENTO')) continue;
    if (esLineaDeFechaOHora(nombreOriginal)) continue;

    const nombre = matchearLocal(nombreOriginal);

    locales.push({ nombre, nombreOriginal, cantidad });
  }

  if (locales.length === 0) return null;

  return { fecha, remitente, locales, textoOriginal: texto, momento };
}
