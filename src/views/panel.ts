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

/**
 * Todas las tablas van con los locales como filas y el tiempo como columnas.
 *
 * Al reves —locales como columnas— la tabla queda de 13 columnas y obliga a
 * un scroll horizontal donde el nombre del local se pierde de vista. Los
 * locales son muchos y fijos; los periodos, pocos.
 */
function tabla(
  encabezadoFila: string,
  columnas: { etiqueta: string; sub?: string }[],
  locales: string[],
  /** valorDe(indiceLocal, indiceColumna) */
  valorDe: (l: number, c: number) => number,
  totalesPorLocal: number[],
  totalGeneral: number,
): string {
  const cabecera = columnas.map(c => `
            <th scope="col">
              <span class="col-titulo">${esc(c.etiqueta)}</span>
              ${c.sub ? `<span class="col-sub">${esc(c.sub)}</span>` : ''}
            </th>`).join('');

  const filas = locales.map((local, l) => `
          <tr>
            <th scope="row">${esc(local)}</th>
            ${columnas.map((_, c) => celda(valorDe(l, c))).join('')}
            <td class="total">${nf.format(totalesPorLocal[l])}</td>
          </tr>`).join('');

  const totalesColumna = columnas.map((_, c) =>
    locales.reduce((acc, _l, l) => acc + valorDe(l, c), 0));

  const pie = `
          <tr class="acumulado">
            <th scope="row">Total</th>
            ${totalesColumna.map(n => `<td>${nf.format(n)}</td>`).join('')}
            <td class="total">${nf.format(totalGeneral)}</td>
          </tr>`;

  return `
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">${esc(encabezadoFila)}</th>
              ${cabecera}
              <th scope="col" class="total">Total</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
          <tfoot>${pie}</tfoot>
        </table>
      </div>`;
}

// ── Pestaña diaria: una tarjeta por dia, con sus cargas ──────────────────────

function tablaDiaria(v: VistaDiaria): string {
  if (!v.dias.length) return '';

  return v.dias.map(dia => {
    const cargas = dia.cargas.length;

    const cuerpo = tabla(
      'Local',
      dia.cargas.map((c, i) => ({ etiqueta: c.hora, sub: `carga ${i + 1}` })),
      v.locales,
      (l, c) => dia.cargas[c].valores[l],
      dia.totales,
      dia.totalGeneral,
    );

    return `
    <section class="dia-tarjeta" id="dia-${esc(dia.fecha)}">
      <header class="dia-cabecera">
        <h2>${esc(dia.fecha)}</h2>
        <p>
          <strong>${nf.format(dia.totalGeneral)}</strong> personas ·
          ${cargas} ${cargas === 1 ? 'carga' : 'cargas'}
        </p>
      </header>
      ${cuerpo}
    </section>`;
  }).join('');
}

// ── Pestañas semanal y mensual ───────────────────────────────────────────────

function tablaPivote(v: Vista): string {
  if (!v.filas.length) return '';

  // v.filas viene con un periodo por fila; acá el periodo pasa a ser columna.
  return `
    <section class="dia-tarjeta">
      ${tabla(
        'Local',
        v.filas.map(f => ({ etiqueta: f.etiqueta })),
        v.locales,
        (l, c) => v.filas[c].valores[l],
        v.totales,
        v.totalGeneral,
      )}
    </section>`;
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
    background: transparent;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Cada dia (o cada vista agregada) es una tarjeta */
  .dia-tarjeta {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .dia-cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: .5rem;
    padding: .85rem 1.15rem;
    border-bottom: 1px solid var(--border);
  }
  .dia-cabecera h2 {
    margin: 0;
    font-size: .95rem;
    font-weight: 650;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .dia-cabecera p { margin: 0; font-size: .8rem; color: var(--muted); }
  .dia-cabecera strong { color: var(--ink); font-variant-numeric: tabular-nums; }

  /* El scroll horizontal solo aparece si hay muchas columnas */
  .scroll { overflow-x: auto; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  thead th {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: .6rem .9rem;
    font-size: .72rem;
    font-weight: 600;
    text-align: right;
    color: var(--muted);
    letter-spacing: .03em;
    white-space: nowrap;
    vertical-align: bottom;
  }
  .col-titulo { display: block; font-variant-numeric: tabular-nums; }
  .col-sub {
    display: block;
    font-size: .62rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: .06em;
    opacity: .65;
  }

  /* La primera columna queda fija; la sombra avisa que flota sobre el resto */
  thead th:first-child,
  tbody th,
  tfoot th {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
    text-align: left;
    font-weight: 550;
    white-space: nowrap;
    box-shadow: 1px 0 0 var(--border), 6px 0 8px -6px rgba(0, 0, 0, .18);
  }
  thead th:first-child {
    z-index: 2;
    text-transform: uppercase;
    font-size: .72rem;
  }

  tbody th, tfoot th { padding: .55rem .9rem; font-size: .875rem; }

  td {
    padding: .55rem .9rem;
    text-align: right;
    border-top: 1px solid var(--border);
    font-size: .9rem;
    white-space: nowrap;
  }

  tbody tr:hover th,
  tbody tr:hover td { background: var(--accent-soft); }

  .cero { color: var(--faint); }
  .total { font-weight: 650; }
  thead .total, tbody .total, tfoot .total {
    border-left: 1px solid var(--border);
  }

  /* Fila de totales */
  .acumulado th, .acumulado td {
    background: var(--accent-soft);
    border-top: 2px solid var(--border);
    font-weight: 650;
  }
  .acumulado th { color: var(--accent); }

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
