import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel } from '../services/excel';

// Mensaje de prueba — igual al formato real que llega por WhatsApp
const MENSAJE_PRUEBA = `RELEVAMIENTO  cada LOCAL
Le Pain Quotidien: 1
Deli House: 0
Civediamo: 42
Costal: 0
Medialuna: 0
Gonna: 49
El Sultan: 121
Boqueria: 52
Don Ruiz: 60
Sushi Fabric: 16
Persicco: 6`;

// Simulación con typos para probar el fuzzy matching
const MENSAJE_CON_TYPOS = `RELEVAMIENTO cada LOCAL
Le Pain Quotidian: 3
Deli Hause: 7
Civediamo: 10
El Sultn: 88
Boqueria: 30
Don Ruíz: 15`;

async function simular(etiqueta: string, mensaje: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`PRUEBA: ${etiqueta}`);
  console.log('='.repeat(60));

  const resultado = parsearRelevamiento(mensaje, 'whatsapp:+5493812345678');

  if (!resultado) {
    console.log('❌ No se detectó como relevamiento');
    return;
  }

  console.log(`✅ Fecha detectada: ${resultado.fecha.toLocaleDateString('es-AR')}`);
  console.log(`✅ Locales parseados: ${resultado.locales.length}`);
  console.log('');
  console.log('Local reconocido'.padEnd(25) + 'Original recibido'.padEnd(25) + 'Cantidad');
  console.log('-'.repeat(65));

  for (const local of resultado.locales) {
    const typo = local.nombre !== local.nombreOriginal ? ` ← CORREGIDO` : '';
    console.log(
      local.nombre.padEnd(25) +
      local.nombreOriginal.padEnd(25) +
      local.cantidad.toString() +
      typo
    );
  }

  console.log('\nGuardando en Excel...');
  await agregarAlExcel(resultado);
  console.log('✅ Excel actualizado en data/relevamientos.xlsx');
}

(async () => {
  await simular('Mensaje normal', MENSAJE_PRUEBA);
  await simular('Mensaje con typos', MENSAJE_CON_TYPOS);
  console.log('\n✅ Simulación completada. Abrí data/relevamientos.xlsx para ver el resultado.');
})();
