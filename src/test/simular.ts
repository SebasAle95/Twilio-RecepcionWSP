/**
 * Simulacion local del flujo completo.
 *
 *   npm run simular
 *
 * Borra el Excel y lo reconstruye con historial de las ultimas semanas, para
 * poder ver el dashboard con datos. Al final verifica que las cargas del mismo
 * dia se acumulen en vez de pisarse.
 */
import fs from 'fs';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel, EXCEL_PATH, obtenerRegistros } from '../services/excel';
import { vistaDiaria, resumen, hoy, aTexto } from '../services/vistas';
import { LOCALES_CONOCIDOS } from '../config/locales';

const REMITENTE = 'whatsapp:+5493816343407';
const DIAS_HISTORIAL = 20;

/** Pseudo-aleatorio determinista, para que la simulacion sea reproducible. */
function aleatorio(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function fechaHace(dias: number): Date {
  const f = hoy();
  f.setDate(f.getDate() - dias);
  return f;
}

/** Un mensaje como el que manda la persona que releva. */
function armarMensaje(fecha: Date, rnd: () => number, factor: number): string {
  const lineas = LOCALES_CONOCIDOS
    // No todos los locales aparecen en cada carga
    .filter(() => rnd() > 0.15)
    .map(local => {
      const base = 10 + Math.floor(rnd() * 90);
      return `${local}: ${Math.round(base * factor)}`;
    });

  return `RELEVAMIENTO cada LOCAL ${aTexto(fecha)}\n${lineas.join('\n')}`;
}

async function sembrarHistorial() {
  const rnd = aleatorio(42);

  for (let d = DIAS_HISTORIAL; d >= 0; d--) {
    const fecha = fechaHace(d);

    // Los domingos no se releva, para que el calendario muestre huecos
    if (fecha.getDay() === 0) continue;

    // Entre una y tres cargas por dia
    const cargas = 1 + Math.floor(rnd() * 3);

    for (let c = 0; c < cargas; c++) {
      const rel = parsearRelevamiento(armarMensaje(fecha, rnd, 0.6 + rnd() * 0.8), REMITENTE);
      if (rel) await agregarAlExcel(rel);
      await new Promise(r => setTimeout(r, 1010)); // separa las cargas en la linea de tiempo
    }
  }
}

/** Manda dos cargas iguales hoy y verifica que se sumen en vez de pisarse. */
async function verificarAcumulacion(): Promise<boolean> {
  const fecha = aTexto(hoy());
  const mensaje = `RELEVAMIENTO cada LOCAL ${fecha}\nCivediamo: 100`;

  const antes = (await obtenerRegistros())
    .filter(r => r.fecha === fecha && r.local === 'Civediamo')
    .reduce((a, r) => a + r.cantidad, 0);

  for (let i = 0; i < 2; i++) {
    const rel = parsearRelevamiento(mensaje, REMITENTE);
    if (rel) await agregarAlExcel(rel);
    await new Promise(r => setTimeout(r, 1010));
  }

  const despues = (await obtenerRegistros())
    .filter(r => r.fecha === fecha && r.local === 'Civediamo')
    .reduce((a, r) => a + r.cantidad, 0);

  const esperado = antes + 200;
  const ok = despues === esperado;

  console.log(`\nAcumulacion: Civediamo paso de ${antes} a ${despues} (esperado ${esperado}) ${ok ? 'OK' : 'FALLA'}`);
  return ok;
}

/** El fuzzy matching tiene que reconocer los nombres mal escritos. */
async function verificarFuzzy(): Promise<boolean> {
  const rel = parsearRelevamiento(
    `RELEVAMIENTO cada LOCAL\nLe Pain Quotidian: 5\nDeli Hause: 3\nEl Sultn: 8`,
    REMITENTE,
  );

  const nombres = rel?.locales.map(l => l.nombre) ?? [];
  const ok = nombres.join('|') === 'Le Pain Quotidien|Deli House|El Sultan';

  console.log(`Fuzzy matching: ${nombres.join(', ')} ${ok ? 'OK' : 'FALLA'}`);
  return ok;
}

async function main() {
  if (fs.existsSync(EXCEL_PATH)) {
    fs.unlinkSync(EXCEL_PATH);
    console.log('Excel anterior borrado — empezamos limpio\n');
  }

  console.log(`Sembrando ${DIAS_HISTORIAL} dias de historial...`);
  await sembrarHistorial();

  const okAcum  = await verificarAcumulacion();
  const okFuzzy = await verificarFuzzy();

  const registros = await obtenerRegistros();
  const r = resumen(registros);
  const v = vistaDiaria(registros);

  console.log('\n' + '='.repeat(64));
  console.log('RESUMEN');
  console.log('='.repeat(64));
  console.log(`Registros totales : ${registros.length}`);
  console.log(`Dias con carga    : ${v.dias.length}`);
  console.log(`Hoy               : ${r.hoy.total} personas (${r.hoy.cargas} cargas)` +
              (r.hoy.variacion !== null ? `  ${r.hoy.variacion > 0 ? '+' : ''}${r.hoy.variacion.toFixed(0)}% vs ayer` : ''));
  console.log(`Semana            : ${r.semana.total}` +
              (r.semana.variacion !== null ? `  ${r.semana.variacion > 0 ? '+' : ''}${r.semana.variacion.toFixed(0)}% vs anterior` : ''));
  console.log(`Mes               : ${r.mes.total}`);
  console.log(`Top del mes       : ${r.ranking[0]?.local} (${r.ranking[0]?.total})`);
  console.log('='.repeat(64));

  if (!okAcum || !okFuzzy) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
