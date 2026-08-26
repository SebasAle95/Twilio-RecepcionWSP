import { Vista } from '../services/vistas';

interface Datos {
  vistas:         Vista[];
  totalRegistros: number;
  actualizado:    string | null;
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

function celda(n: number): string {
  // Los ceros se atenúan para que la vista destaque donde sí hubo ventas.
  const clase = n === 0 ? ' class="cero"' : '';
  return `<td${clase}>${nf.format(n)}</td>`;
}

function tabla(v: Vista): string {
  const encabezados = v.locales.map(l => `<th>${esc(l)}</th>`).join('');

  const filas = v.filas.map(f => `
      <tr>
        <th scope="row">${esc(f.etiqueta)}</th>
        ${f.valores.map(celda).join('')}
        <td class="total">${nf.format(f.total)}</td>
      </tr>`).join('');

  const pie = `
      <tr class="pie">
        <th scope="row">Total</th>
        ${v.totales.map(n => `<td>${nf.format(n)}</td>`).join('')}
        <td class="total">${nf.format(v.totalGeneral)}</td>
      </tr>`;

  return `
    <section class="bloque">
      <h2>${esc(v.titulo)}</h2>
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
      </div>
    </section>`;
}

const vacio = `
    <section class="vacio">
      <h2>Todavía no hay datos</h2>
      <p>
        Cuando llegue el primer relevamiento por WhatsApp, las tablas diaria,
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
    gap: 2rem;
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

  .meta {
    margin: 0;
    color: var(--muted);
    font-size: .875rem;
  }

  .descargar {
    display: inline-flex;
    align-items: center;
    gap: .5rem;
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
  .descargar:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .bloque {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .bloque h2 {
    margin: 0;
    padding: .9rem 1.15rem;
    border-bottom: 1px solid var(--border);
    font-size: .78rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--accent);
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

  tbody th, tfoot th { padding: .65rem 1rem; }

  td {
    padding: .65rem 1rem;
    text-align: right;
    border-top: 1px solid var(--border);
  }

  tbody tr:hover th,
  tbody tr:hover td { background: var(--accent-soft); }

  .cero { color: var(--faint); }

  .total { font-weight: 650; }

  tfoot th, tfoot td {
    border-top: 2px solid var(--border);
    font-weight: 650;
    background: var(--surface);
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

export function renderPanel(d: Datos): string {
  const q = encodeURIComponent(d.clave);

  const cuerpo = d.totalRegistros === 0
    ? vacio
    : d.vistas.map(tabla).join('\n');

  const meta = d.totalRegistros === 0
    ? 'Esperando el primer mensaje'
    : `${nf.format(d.totalRegistros)} registros`
      + (d.actualizado ? ` · última carga ${esc(d.actualizado)}` : '');

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
      ${d.totalRegistros > 0
        ? `<a class="descargar" href="/panel/descargar?clave=${q}">Descargar Excel</a>`
        : ''}
    </header>
    ${cuerpo}
  </div>
</body>
</html>`;
}
