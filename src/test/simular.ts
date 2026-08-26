/**
 * Simulacion local del flujo completo.
 *
 *   npm run simular
 *
 * Borra el Excel y lo reconstruye mandando varios mensajes, incluyendo
 * varias cargas en el mismo dia, para verificar que se acumulan.
 */
import fs from 'fs';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel, EXCEL_PATH, obtenerRegistros } from '../services/excel';
import { vistaDiaria } from '../services/vistas';

const REMITENTE = 'whatsapp:+5493812345678';

const CASOS: { etiqueta: string; mensaje: string }[] = [
  {
    etiqueta: 'Dia 1, manana',
    mensaje: `RELEVAMIENTO cada LOCAL 20-08-2026
Le Pain Quotidien: 10
Deli House: 5
Civediamo: 42`,
  },
  {
    etiqueta: 'Dia 1, mediodia — segunda carga del mismo dia',
    mensaje: `RELEVAMIENTO cada LOCAL 20-08-2026
Le Pain Quotidien: 8
Deli House: 3
Civediamo: 20`,
  },
  {
    etiqueta: 'Dia 1, tarde — tercera carga',
    mensaje: `RELEVAMIENTO cada LOCAL 20-08-2026
Le Pain Quotidien: 4
Deli House: 2
Civediamo: 15`,
  },
  {
    etiqueta: 'Dia 2 — con typos (prueba el fuzzy matching)',
    mensaje: `RELEVAMIENTO cada LOCAL 21-08-2026
Le Pain Quotidian: 12
Deli Hause: 7
Civediamo: 30`,
  },
];

async function main() {
  if (fs.existsSync(EXCEL_PATH)) {
    fs.unlinkSync(EXCEL_PATH);
    console.log('Excel anterior borrado — empezamos limpio\n');
  }

  for (const caso of CASOS) {
    console.log('='.repeat(70));
    console.log(caso.etiqueta);
    console.log('='.repeat(70));

    const rel = parsearRelevamiento(caso.mensaje, REMITENTE);
    if (!rel) {
      console.log('No se detecto como relevamiento\n');
      continue;
    }

    for (const l of rel.locales) {
      const typo = l.nombre !== l.nombreOriginal ? `  (corregido de "${l.nombreOriginal}")` : '';
      console.log(`  ${l.nombre.padEnd(22)} ${String(l.cantidad).padStart(4)}${typo}`);
    }

    await agregarAlExcel(rel);
    console.log('');

    // Las cargas del mismo minuto quedarian agrupadas; separamos para ver la
    // linea de tiempo como pasaria en la realidad.
    await new Promise(r => setTimeout(r, 1100));
  }

  // ── Verificacion ───────────────────────────────────────────────────────────
  const registros = await obtenerRegistros();
  const vista = vistaDiaria(registros);

  console.log('='.repeat(70));
  console.log('RESULTADO');
  console.log('='.repeat(70));

  for (const dia of vista.dias) {
    console.log(`\n${dia.fecha}  (${dia.cargas.length} cargas)`);
    console.log('  ' + 'Hora'.padEnd(8) + vista.locales.map(l => l.slice(0, 12).padStart(14)).join('') + 'Total'.padStart(8));
    for (const c of dia.cargas) {
      console.log('  ' + c.hora.padEnd(8) + c.valores.map(v => String(v).padStart(14)).join('') + String(c.total).padStart(8));
    }
    console.log('  ' + 'TOTAL'.padEnd(8) + dia.totales.map(v => String(v).padStart(14)).join('') + String(dia.totalGeneral).padStart(8));
  }

  const dia1 = vista.dias.find(d => d.fecha === '20-08-2026');
  const esperado = 22 + 10 + 77; // Le Pain 10+8+4, Deli 5+3+2, Civediamo 42+20+15
  const ok = dia1?.totalGeneral === esperado;

  console.log('\n' + '='.repeat(70));
  console.log(`Esperado para el 20-08: ${esperado}  |  Obtenido: ${dia1?.totalGeneral}  ${ok ? 'OK' : 'FALLA'}`);
  console.log('='.repeat(70));

  if (!ok) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
