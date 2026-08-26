import { Vista, VistaDiaria, MesCalendario } from '../services/vistas';

interface Datos {
  diaria:         VistaDiaria;
  semanal:        Vista;
  mensual:        Vista;
  calendario:     MesCalendario[];
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

/** Los ceros se atenuan para que la vista destaque donde si hubo gente. */
function celda(n: number): string {
  return `<td${n === 0 ? ' class="cero"' : ''}>${nf.format(n)}</td>`;
}

// ── Pestaña diaria: linea de tiempo + acumulado ──────────────────────────────

function tablaDiaria(v: VistaDiaria): string {
  if (!v.dias.length) return '';

  const encabezados = v.locales.map(l => `<th>${esc(l)}</th>`).join('');

  const cuerpo = v.dias.map(dia => {
    const cargas = dia.cargas.map((c, i) => `
        <tr${i === 0 ? ` id="dia-${esc(dia.fecha)}"` : ''}>
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

// ── Pestaña calendario ───────────────────────────────────────────────────────

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function mesCalendario(m: MesCalendario, visible: boolean): string {
  const celdas = m.celdas.map(c => {
    if (!c) return '<div class="dia fuera"></div>';

    if (c.cargas === 0) {
      return `<div class="dia sin-carga"><span class="num">${c.dia}</span></div>`;
    }

    const cargas = `${c.cargas} ${c.cargas === 1 ? 'carga' : 'cargas'}`;
    return `<button class="dia con-carga n${c.nivel}" data-fecha="${esc(c.fecha)}"
              title="${esc(c.fecha)} · ${cargas} · total ${nf.format(c.total)}">
              <span class="num">${c.dia}</span>
              <span class="valor">${nf.format(c.total)}</span>
              <span class="puntos">${'·'.repeat(Math.min(c.cargas, 4))}</span>
            </button>`;
  }).join('');

  return `
      <div class="mes" data-mes="${esc(m.clave)}"${visible ? '' : ' hidden'}>
        <div class="grilla-encabezado">
          ${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="grilla">${celdas}</div>
        <p class="resumen-mes">
          ${m.diasConCarga} ${m.diasConCarga === 1 ? 'día' : 'días'} con carga ·
          total ${nf.format(m.totalMes)}
        </p>
      </div>`;
}

function calendario(meses: MesCalendario[]): string {
  if (!meses.length) return '';

  // El primero es el mes mas reciente
  const cuerpo = meses.map((m, i) => mesCalendario(m, i === 0)).join('');

  return `
      <div class="cal">
        <div class="nav-mes">
          <button id="mes-anterior" aria-label="Mes anterior"${meses.length < 2 ? ' disabled' : ''}>&#8249;</button>
          <span id="mes-actual">${esc(meses[0].etiqueta)}</span>
          <button id="mes-siguiente" aria-label="Mes siguiente" disabled>&#8250;</button>
        </div>
        ${cuerpo}
        <p class="leyenda">Tocá un día con carga para ver el detalle.</p>
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

  /* Calendario */
  .cal { padding: 1.25rem; }

  .nav-mes {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .75rem;
    margin-bottom: 1.1rem;
  }
  .nav-mes span {
    min-width: 11rem;
    text-align: center;
    font-weight: 600;
    font-size: 1rem;
  }
  .nav-mes button {
    appearance: none;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    transition: background .15s ease;
  }
  .nav-mes button:hover:not(:disabled) { background: var(--accent-soft); }
  .nav-mes button:disabled { opacity: .3; cursor: default; }
  .nav-mes button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .grilla-encabezado, .grilla {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: .3rem;
  }

  .grilla-encabezado {
    margin-bottom: .4rem;
  }
  .grilla-encabezado span {
    text-align: center;
    font-size: .7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--muted);
  }

  .dia {
    aspect-ratio: 1;
    min-height: 3.1rem;
    border: 1px solid var(--border);
    border-radius: 7px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .05rem;
    padding: .2rem;
    font: inherit;
  }

  .dia.fuera { border: 0; }

  .dia.sin-carga { color: var(--faint); background: transparent; }
  .dia.sin-carga .num { font-size: .8rem; }

  .dia.con-carga {
    cursor: pointer;
    border-color: transparent;
    color: var(--accent);
    background: var(--accent-soft);
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .dia.con-carga:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(15, 110, 92, .18);
  }
  .dia.con-carga:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  /* Sombreado por volumen del dia */
  .dia.n1 { background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
  .dia.n2 { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .dia.n3 { background: color-mix(in srgb, var(--accent) 38%, var(--surface)); }
  .dia.n4 { background: color-mix(in srgb, var(--accent) 55%, var(--surface)); color: #fff; }

  @media (prefers-color-scheme: dark) {
    .dia.n4 { color: var(--ground); }
  }

  .dia .num { font-size: .78rem; font-weight: 600; opacity: .85; }
  .dia .valor {
    font-size: .95rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .dia .puntos { font-size: .7rem; line-height: .6; opacity: .7; letter-spacing: .1em; }

  .resumen-mes, .leyenda {
    margin: 1rem 0 0;
    text-align: center;
    font-size: .8rem;
    color: var(--muted);
  }
  .leyenda { margin-top: .4rem; font-size: .75rem; }

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

const JS = (etiquetasMeses: string[]) => `
  const tabs = document.querySelectorAll('.tabs button');

  function abrirTab(nombre) {
    tabs.forEach(t => {
      const activo = t.dataset.panel === nombre;
      t.setAttribute('aria-selected', String(activo));
      document.getElementById(t.dataset.panel).hidden = !activo;
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      abrirTab(tab.dataset.panel);
      try { localStorage.setItem('tab', tab.dataset.panel); } catch (e) {}
    });
  });

  // Recordar la pestaña elegida entre visitas
  try {
    const guardada = localStorage.getItem('tab');
    if (guardada && document.getElementById(guardada)) abrirTab(guardada);
  } catch (e) {}

  // ── Calendario ────────────────────────────────────────────────────────────
  const meses = [...document.querySelectorAll('.mes')];  // [0] = mas reciente

  if (meses.length) {
    const anterior  = document.getElementById('mes-anterior');
    const siguiente = document.getElementById('mes-siguiente');
    const titulo    = document.getElementById('mes-actual');
    const etiquetas = ${JSON.stringify(etiquetasMeses)};
    let i = 0;

    function mostrarMes(nuevo) {
      i = nuevo;
      meses.forEach((m, k) => { m.hidden = k !== i; });
      titulo.textContent = etiquetas[i];
      // El indice crece hacia el pasado
      siguiente.disabled = i === 0;
      anterior.disabled  = i === meses.length - 1;
    }

    anterior.addEventListener('click',  () => { if (i < meses.length - 1) mostrarMes(i + 1); });
    siguiente.addEventListener('click', () => { if (i > 0) mostrarMes(i - 1); });

    // Tocar un dia lleva a su detalle en la pestaña Diario
    document.querySelectorAll('.dia.con-carga').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirTab('diario');
        try { localStorage.setItem('tab', 'diario'); } catch (e) {}

        const fila = document.getElementById('dia-' + btn.dataset.fecha);
        if (fila) {
          fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
          fila.animate(
            [{ background: 'var(--accent-soft)' }, { background: 'transparent' }],
            { duration: 1600, easing: 'ease-out' },
          );
        }
      });
    });
  }
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
      <button role="tab" aria-selected="false" data-panel="calendario">Calendario</button>
    </div>

    <div class="bloque panel" id="diario"     role="tabpanel">${tablaDiaria(d.diaria)}</div>
    <div class="bloque panel" id="semanal"    role="tabpanel" hidden>${tablaPivote(d.semanal)}</div>
    <div class="bloque panel" id="mensual"    role="tabpanel" hidden>${tablaPivote(d.mensual)}</div>
    <div class="bloque panel" id="calendario" role="tabpanel" hidden>${calendario(d.calendario)}</div>
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
        <h1>Relevamiento de concurrencia</h1>
        <p class="meta">${meta}</p>
      </div>
      ${hayDatos ? `<a class="descargar" href="/panel/descargar?clave=${q}">Descargar Excel</a>` : ''}
    </header>
    ${cuerpo}
  </div>
  ${hayDatos ? `<script>${JS(d.calendario.map(m => m.etiqueta))}</script>` : ''}
</body>
</html>`;
}
