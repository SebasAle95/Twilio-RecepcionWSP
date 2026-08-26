import { Vista, VistaDiaria } from '../services/vistas';

interface Datos {
  diaria:         VistaDiaria;
  semanal:        Vista;
  mensual:        Vista;
  totalRegistros: number;
  ultimaCarga:    string | null;
  clave:          string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const nf = new Intl.NumberFormat('es-AR');

/** Los ceros se atenuan para que la vista destaque donde si hubo ventas. */
function celda(n: number): string {
  return `<td${n === 0 ? ' class="cero"' : ''}>${nf.format(n)}</td>`;
}

// ── Pestaña diaria: linea de tiempo + acumulado ──────────────────────────────

function tablaDiaria(v: VistaDiaria): string {
  if (!v.dias.length) return '';

  const encabezados = v.locales.map(l => `<th>${esc(l)}</th>`).join('');

  const cuerpo = v.dias.map(dia => {
    const cargas = dia.cargas.map((c, i) => `
        <tr>
          <th scope="row" class="hora">
            ${i === 0 ? `<span class="fecha">${esc(dia.fecha)}</span>` : ''}
            <span class="marca">${esc(c.hora)}</span>
          </th>
          ${c.valores.map(celda).join('')}
          <td class="total">${nf.format(c.total)}</td>
        </tr>`).join('');

    const total = `
        <tr class="acumulado">
          <th scope="row">
            Total del día
            <span class="cuenta">${dia.cargas.length} ${dia.cargas.length === 1 ? 'carga' : 'cargas'}</span>
          </th>
          ${dia.totales.map(n => `<td>${nf.format(n)}</td>`).join('')}
          <td class="total">${nf.format(dia.totalGeneral)}</td>
        </tr>`;

    return cargas + total;
  }).join('');

  return `
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              ${encabezados}
              <th scope="col" class="total">Total</th>
            </tr>
          </thead>
          <tbody>${cuerpo}</tbody>
        </table>
      </div>`;
}

// ── Pestañas semanal y mensual ───────────────────────────────────────────────

function tablaPivote(v: Vista): string {
  if (!v.filas.length) return '';

  const encabezados = v.locales.map(l => `<th>${esc(l)}</th>`).join('');

  const filas = v.filas.map(f => `
        <tr>
          <th scope="row">${esc(f.etiqueta)}</th>
          ${f.valores.map(celda).join('')}
          <td class="total">${nf.format(f.total)}</td>
        </tr>`).join('');

  const pie = `
        <tr class="acumulado">
          <th scope="row">Total general</th>
          ${v.totales.map(n => `<td>${nf.format(n)}</td>`).join('')}
          <td class="total">${nf.format(v.totalGeneral)}</td>
        </tr>`;

  return `
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">${esc(v.periodo)}</th>
              ${encabezados}
              <th scope="col" class="total">Total</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
          <tfoot>${pie}</tfoot>
        </table>
      </div>`;
}

const vacio = `
    <section class="vacio">
      <h2>Todavía no hay datos</h2>
      <p>
        Cuando llegue el primer relevamiento por WhatsApp, las vistas diaria,
        semanal y mensual aparecen acá automáticamente.
      </p>
    </section>`;

const CSS = `
  :root {
    --ground:      #FAFAF7;
    --surface:     #FFFFFF;
    --ink:         #16211E;
    --muted:       #6B7672;
    --faint:       #A8AFAB;
    --border:      #E4E5E0;
    --accent:      #0F6E5C;
    --accent-soft: #E9F2EF;
    --shadow:      0 1px 2px rgba(22, 33, 30, .05), 0 8px 24px rgba(22, 33, 30, .04);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --ground:      #121614;
      --surface:     #1A201D;
      --ink:         #E8EBE9;
      --muted:       #98A19D;
      --faint:       #5C6663;
      --border:      #2A322E;
      --accent:      #4FBFA5;
      --accent-soft: #1E2E29;
      --shadow:      0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px rgba(0, 0, 0, .2);
    }
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 2rem 1.25rem 4rem;
    background: var(--ground);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .contenedor {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    margin: 0 0 .35rem;
    font-size: 1.5rem;
    font-weight: 650;
    letter-spacing: -.015em;
    text-wrap: balance;
  }

  .meta { margin: 0; color: var(--muted); font-size: .875rem; }

  .descargar {
    display: inline-flex;
    align-items: center;
    padding: .55rem 1rem;
    border-radius: 7px;
    background: var(--accent);
    color: #fff;
    font-size: .875rem;
    font-weight: 550;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity .15s ease;
  }
  .descargar:hover { opacity: .88; }
  .descargar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Pestañas */
  .tabs {
    display: flex;
    gap: .25rem;
    padding: .3rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 9px;
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
  }

  .tabs button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: .875rem;
    font-weight: 550;
    padding: .45rem 1.1rem;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: background .15s ease, color .15s ease;
  }
  .tabs button:hover { color: var(--ink); }
  .tabs button[aria-selected="true"] {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .panel[hidden] { display: none; }

  .bloque {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .scroll { overflow-x: auto; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: .7rem 1rem;
    font-size: .75rem;
    font-weight: 600;
    text-align: right;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  thead th:first-child,
  tbody th,
  tfoot th {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
    text-align: left;
    font-weight: 550;
  }
  thead th:first-child { z-index: 2; }

  tbody th, tfoot th { padding: .6rem 1rem; }

  td {
    padding: .6rem 1rem;
    text-align: right;
    border-top: 1px solid var(--border);
  }

  .cero { color: var(--faint); }
  .total { font-weight: 650; }

  /* Linea de tiempo: la hora de cada carga, con la fecha solo en la primera */
  .hora { line-height: 1.35; }
  .hora .fecha {
    display: block;
    font-size: .8rem;
    font-weight: 650;
    color: var(--accent);
  }
  .hora .marca {
    display: block;
    font-size: .875rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  /* Fila de acumulado */
  .acumulado th, .acumulado td {
    background: var(--accent-soft);
    border-top: 1px solid var(--border);
    font-weight: 650;
  }
  .acumulado th { color: var(--accent); }
  .acumulado .cuenta {
    display: block;
    font-size: .75rem;
    font-weight: 500;
    color: var(--muted);
  }

  .vacio {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 3rem 1.5rem;
    text-align: center;
    box-shadow: var(--shadow);
  }
  .vacio h2 { margin: 0 0 .5rem; font-size: 1.1rem; font-weight: 600; }
  .vacio p  { margin: 0 auto; max-width: 42ch; color: var(--muted); }

  @media (max-width: 600px) {
    body { padding: 1.25rem .75rem 3rem; }
    header { align-items: flex-start; }
  }
`;

const JS = `
  const tabs = document.querySelectorAll('.tabs button');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        const activo = t === tab;
        t.setAttribute('aria-selected', String(activo));
        document.getElementById(t.dataset.panel).hidden = !activo;
      });
      try { localStorage.setItem('tab', tab.dataset.panel); } catch (e) {}
    });
  });

  // Recordar la pestaña elegida entre visitas
  try {
    const guardada = localStorage.getItem('tab');
    if (guardada) {
      const tab = document.querySelector('.tabs button[data-panel="' + guardada + '"]');
      if (tab) tab.click();
    }
  } catch (e) {}
`;

export function renderPanel(d: Datos): string {
  const q = encodeURIComponent(d.clave);
  const hayDatos = d.totalRegistros > 0;

  const meta = hayDatos
    ? `${nf.format(d.totalRegistros)} registros`
      + (d.ultimaCarga ? ` · última carga ${esc(d.ultimaCarga)}` : '')
    : 'Esperando el primer mensaje';

  const cuerpo = hayDatos ? `
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="true"  data-panel="diario">Diario</button>
      <button role="tab" aria-selected="false" data-panel="semanal">Semanal</button>
      <button role="tab" aria-selected="false" data-panel="mensual">Mensual</button>
    </div>

    <div class="bloque panel" id="diario"  role="tabpanel">${tablaDiaria(d.diaria)}</div>
    <div class="bloque panel" id="semanal" role="tabpanel" hidden>${tablaPivote(d.semanal)}</div>
    <div class="bloque panel" id="mensual" role="tabpanel" hidden>${tablaPivote(d.mensual)}</div>
  ` : vacio;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Relevamientos</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="contenedor">
    <header>
      <div>
        <h1>Relevamiento de ventas</h1>
        <p class="meta">${meta}</p>
      </div>
      ${hayDatos ? `<a class="descargar" href="/panel/descargar?clave=${q}">Descargar Excel</a>` : ''}
    </header>
    ${cuerpo}
  </div>
  ${hayDatos ? `<script>${JS}</script>` : ''}
</body>
</html>`;
}
