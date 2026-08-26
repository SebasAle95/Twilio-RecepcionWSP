/**
 * Simulación local del flujo completo.
 *
 *   npm run simular
 *
 * Borra data/relevamientos.xlsx y lo reconstruye mandando varios mensajes,
 * incluyendo correcciones, para verificar que no se duplican filas.
 */
import fs from 'fs';
import path from 'path';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel } from '../services/excel';

process.env.SKIP_DRIVE = '1';

const EXCEL_PATH = path.join(process.cwd(), 'data', 'relevamientos.xlsx');
const REMITENTE  = 'whatsapp:+5493812345678';

const CASOS: { etiqueta: string; mensaje: string }[] = [
  {
    etiqueta: 'Día 1 — mensaje normal',
    mensaje: `RELEVAMIENTO cada LOCAL 20-08-2026
Le Pain Quotidien: 10
Deli House: 5
Civediamo: 42
El Sultan: 100`,
  },
  {
    etiqueta: 'Día 2 — con typos (prueba el fuzzy matching)',
    mensaje: `RELEVAMIENTO cada LOCAL 21-08-2026
Le Pain Quotidian: 12
Deli Hause: 7
Civediamo: 30
El Sultn: 88`,
  },
  {
    etiqueta: 'Día 2 — CORRECCIÓN completa (reenvían todo el mensaje)',
    mensaje: `RELEVAMIENTO cada LOCAL 21-08-2026
Le Pain Quotidien: 15
Deli House: 7
Civediamo: 30
El Sultan: 90`,
  },
  {
    etiqueta: 'Día 1 — CORRECCIÓN parcial (solo un local, días después)',
    mensaje: `RELEVAMIENTO cada LOCAL 20-08-2026
Civediamo: 50`,
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
      console.log('No se detectó como relevamiento\n');
      continue;
    }

    console.log(`Fecha: ${rel.fecha.toLocaleDateString('es-AR')}`);
    for (const l of rel.locales) {
      const typo = l.nombre !== l.nombreOriginal ? `  (corregido de "${l.nombreOriginal}")` : '';
      console.log(`  ${l.nombre.padEnd(22)} ${String(l.cantidad).padStart(4)}${typo}`);
    }

    await agregarAlExcel(rel);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('Esperado: 4 registros del 20-08 y 4 del 21-08 (8 en total).');
  console.log('Civediamo el 20-08 debe valer 50, y El Sultan el 21-08 debe valer 90.');
  console.log(`Abrí ${EXCEL_PATH} y revisá las hojas Datos, Diario, Semanal y Mensual.`);
  console.log('='.repeat(70));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
