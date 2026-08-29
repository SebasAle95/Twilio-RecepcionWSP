import {
  Vista, VistaDiaria, MesCalendario, Resumen, Comparado, PuntoTendencia,
} from '../services/vistas';

interface Datos {
  resumen:        Resumen;
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

// ── Indicador de variacion ───────────────────────────────────────────────────

/**
 * Flecha + signo, nunca color solo.
 *
 * Verde y rojo no se distinguen bajo daltonismo deuteranope, asi que la
 * direccion la carga la flecha y el signo; el color solo refuerza.
 */
function delta(c: Comparado, periodoAnterior: string): string {
  if (c.variacion === null) {
    return `<p class="delta neutro">Sin período anterior para comparar</p>`;
  }

  const sube  = c.variacion >= 0;
  const clase = c.variacion === 0 ? 'neutro' : sube ? 'sube' : 'baja';
  const signo = c.variacion === 0 ? '' : sube ? '+' : '';
  const flecha = c.variacion === 0 ? '—' : sube ? '▲' : '▼';

  return `
    <p class="delta ${clase}">
      <span class="flecha" aria-hidden="true">${flecha}</span>
      <strong>${signo}${c.variacion.toFixed(0)}%</strong>
      <span class="ref">vs ${esc(periodoAnterior)} (${nf.format(c.anterior)})</span>
    </p>`;
}

// ── Grafico de tendencia ─────────────────────────────────────────────────────

/** Redondea el maximo a un numero limpio para el eje. */
function escalaBonita(max: number): { tope: number; ticks: number[] } {
  if (max <= 0) return { tope: 10, ticks: [0, 5, 10] };

  const magnitud = Math.pow(10, Math.floor(Math.log10(max)));
  const paso     = [1, 2, 2.5, 5, 10].find(p => max <= magnitud * p * 4)! * magnitud;
  const tope     = Math.ceil(max / paso) * paso;

  const ticks: number[] = [];
  for (let v = 0; v <= tope; v += paso) ticks.push(v);
  return { tope, ticks };
}

function grafico(puntos: PuntoTendencia[]): string {
  const W = 760, H = 220;
  const ML = 46, MR = 14, MT = 14, MB = 30;
  const ancho = W - ML - MR;
  const alto  = H - MT - MB;

  const { tope, ticks } = escalaBonita(Math.max(...puntos.map(p => p.total)));

  const x = (i: number) => ML + (puntos.length === 1 ? ancho / 2 : (i / (puntos.length - 1)) * ancho);
  const y = (v: number) => MT + alto - (v / tope) * alto;

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const area  = `${linea} L${x(puntos.length - 1).toFixed(1)},${MT + alto} L${x(0).toFixed(1)},${MT + alto} Z`;

  const grillas = ticks.map(v => `
      <line class="grid" x1="${ML}" y1="${y(v).toFixed(1)}" x2="${W - MR}" y2="${y(v).toFixed(1)}" />
      <text class="tick-y" x="${ML - 10}" y="${(y(v) + 4).toFixed(1)}">${nf.format(v)}</text>`).join('');

  // Etiquetas del eje X salteadas para que no se amontonen.
  // El ultimo dia siempre se rotula; si el anterior queda pegado, se descarta.
  const cada  = Math.max(1, Math.ceil(puntos.length / 7));
  const final = puntos.length - 1;
  const marcados = new Set<number>();
  for (let i = 0; i < puntos.length; i += cada) marcados.add(i);
  for (const i of [...marcados]) {
    if (i !== 0 && final - i < cada) marcados.delete(i);
  }
  marcados.add(final);

  const ticksX = puntos.map((p, i) => marcados.has(i)
    ? `<text class="tick-x" x="${x(i).toFixed(1)}" y="${H - 10}">${esc(p.etiqueta)}</text>`
    : '').join('');

  const ultimo = puntos.length - 1;

  // Zonas de hover: mas anchas que los puntos, para poder apuntarlas
  const zonas = puntos.map((p, i) => {
    const w = ancho / Math.max(puntos.length - 1, 1);
    return `<rect class="zona" x="${(x(i) - w / 2).toFixed(1)}" y="${MT}" width="${w.toFixed(1)}" height="${alto}"
              data-etiqueta="${esc(p.etiqueta)}" data-total="${p.total}"
              data-cx="${x(i).toFixed(1)}" data-cy="${y(p.total).toFixed(1)}" />`;
  }).join('');

  return `
    <div class="gr-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img"
           aria-label="Personas por dia, ultimos ${puntos.length} dias">
        ${grillas}
        <path class="area"  d="${area}" />
        <path class="linea" d="${linea}" />
        <line class="cursor" x1="0" y1="${MT}" x2="0" y2="${MT + alto}" style="display:none" />
        <circle class="punto-fin" cx="${x(ultimo).toFixed(1)}" cy="${y(puntos[ultimo].total).toFixed(1)}" r="4.5" />
        ${ticksX}
        ${zonas}
      </svg>
      <div class="tooltip" hidden></div>
    </div>`;
}

// ── Ranking de locales ───────────────────────────────────────────────────────

function ranking(items: { local: string; total: number }[]): string {
  if (!items.length) return '<p class="vacio-chico">Todavía no hay datos de este mes.</p>';

  const max = Math.max(...items.map(i => i.total), 1);

  const filas = items.map(i => `
      <li>
        <span class="rk-local">${esc(i.local)}</span>
        <span class="rk-barra">
          <span class="rk-fill" style="width:${((i.total / max) * 100).toFixed(1)}%"></span>
        </span>
        <span class="rk-valor">${nf.format(i.total)}</span>
      </li>`).join('');

  return `<ol class="ranking">${filas}</ol>`;
}

// ── Tablas ───────────────────────────────────────────────────────────────────

/**
 * Locales como filas y tiempo como columnas.
 *
 * Al reves la tabla queda de 13 columnas y el scroll horizontal esconde el
 * nombre del local detras de la columna fija.
 */
function tabla(
  encabezadoFila: string,
  columnas: { etiqueta: string; sub?: string }[],
  locales: string[],
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

function tablaDiaria(v: VistaDiaria): string {
  if (!v.dias.length) return '';

  return v.dias.map(dia => {
    const n = dia.cargas.length;

    return `
    <section class="tarjeta" id="dia-${esc(dia.fecha)}">
      <header class="tarjeta-cab">
        <h3>${esc(dia.fecha)}</h3>
        <p><strong>${nf.format(dia.totalGeneral)}</strong> personas · ${n} ${n === 1 ? 'carga' : 'cargas'}</p>
      </header>
      ${tabla(
        'Local',
        dia.cargas.map((c, i) => ({ etiqueta: c.hora, sub: `carga ${i + 1}` })),
        v.locales,
        (l, c) => dia.cargas[c].valores[l],
        dia.totales,
        dia.totalGeneral,
      )}
    </section>`;
  }).join('');
}

function tablaPivote(v: Vista): string {
  if (!v.filas.length) return '';
  return `
    <section class="tarjeta">
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

// ── Calendario ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function mesCalendario(m: MesCalendario, visible: boolean): string {
  const celdas = m.celdas.map(c => {
    if (!c) return '<div class="dia fuera"></div>';
    if (c.cargas === 0) return `<div class="dia sin-carga"><span class="num">${c.dia}</span></div>`;

    const cargas = `${c.cargas} ${c.cargas === 1 ? 'carga' : 'cargas'}`;
    return `<button class="dia con-carga n${c.nivel}" data-fecha="${esc(c.fecha)}"
              title="${esc(c.fecha)} · ${cargas} · ${nf.format(c.total)} personas">
              <span class="num">${c.dia}</span>
              <span class="valor">${nf.format(c.total)}</span>
            </button>`;
  }).join('');

  return `
      <div class="mes" data-mes="${esc(m.clave)}"${visible ? '' : ' hidden'}>
        <div class="grilla-cab">${DIAS_SEMANA.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="grilla">${celdas}</div>
        <p class="resumen-mes">
          ${m.diasConCarga} ${m.diasConCarga === 1 ? 'día' : 'días'} con carga ·
          ${nf.format(m.totalMes)} personas
        </p>
      </div>`;
}

function calendario(meses: MesCalendario[]): string {
  if (!meses.length) return '';

  return `
    <section class="tarjeta">
      <div class="cal">
        <div class="nav-mes">
          <button id="mes-anterior" aria-label="Mes anterior"${meses.length < 2 ? ' disabled' : ''}>&#8249;</button>
          <span id="mes-actual">${esc(meses[0].etiqueta)}</span>
          <button id="mes-siguiente" aria-label="Mes siguiente" disabled>&#8250;</button>
        </div>
        ${meses.map((m, i) => mesCalendario(m, i === 0)).join('')}
        <p class="leyenda">Tocá un día con carga para ver el detalle.</p>
      </div>
    </section>`;
}

const vacio = `
    <section class="tarjeta vacio">
      <h2>Todavía no hay datos</h2>
      <p>
        Cuando llegue el primer relevamiento por WhatsApp, el resumen y las
        vistas diaria, semanal y mensual aparecen acá automáticamente.
      </p>
    </section>`;

// ── Estilos ──────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    color-scheme: light;
    --plane:      #f9f9f7;
    --surface:    #fcfcfb;
    --ink:        #0b0b0b;
    --ink-2:      #52514e;
    --muted:      #898781;
    --grid:       #e1e0d9;
    --axis:       #c3c2b7;
    --border:     rgba(11, 11, 11, .10);
    --accent:     #2a78d6;
    --accent-10:  rgba(42, 120, 214, .10);
    --accent-16:  rgba(42, 120, 214, .16);
    --good:       #006300;
    --bad:        #d03b3b;
    --sombra:     0 1px 2px rgba(11, 11, 11, .05), 0 8px 24px rgba(11, 11, 11, .04);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --plane:     #0d0d0d;
      --surface:   #1a1a19;
      --ink:       #ffffff;
      --ink-2:     #c3c2b7;
      --muted:     #898781;
      --grid:      #2c2c2a;
      --axis:      #383835;
      --border:    rgba(255, 255, 255, .10);
      --accent:    #3987e5;
      --accent-10: rgba(57, 135, 229, .12);
      --accent-16: rgba(57, 135, 229, .20);
      --good:      #0ca30c;
      --bad:       #d03b3b;
      --sombra:    0 1px 2px rgba(0, 0, 0, .35), 0 8px 24px rgba(0, 0, 0, .25);
    }
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
    --plane:     #0d0d0d;
    --surface:   #1a1a19;
    --ink:       #ffffff;
    --ink-2:     #c3c2b7;
    --muted:     #898781;
    --grid:      #2c2c2a;
    --axis:      #383835;
    --border:    rgba(255, 255, 255, .10);
    --accent:    #3987e5;
    --accent-10: rgba(57, 135, 229, .12);
    --accent-16: rgba(57, 135, 229, .20);
    --good:      #0ca30c;
    --bad:       #d03b3b;
    --sombra:    0 1px 2px rgba(0, 0, 0, .35), 0 8px 24px rgba(0, 0, 0, .25);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 1.75rem 1.25rem 4rem;
    background: var(--plane);
    color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .contenedor {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Encabezado ── */
  header.principal {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }
  h1 {
    margin: 0 0 .3rem;
    font-size: 1.4rem;
    font-weight: 640;
    letter-spacing: -.015em;
    text-wrap: balance;
  }
  .meta { margin: 0; color: var(--ink-2); font-size: .85rem; }
  .acciones { display: flex; align-items: center; gap: .6rem; }

  /* ── Selector de tema ── */
  .tema {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .tema button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: .78rem;
    font-weight: 550;
    padding: .3rem .6rem;
    border-radius: 6px;
    cursor: pointer;
    line-height: 1.3;
  }
  .tema button:hover { color: var(--ink); }
  .tema button[aria-pressed="true"] { background: var(--accent-16); color: var(--ink); }
  .tema button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .descargar {
    display: inline-flex;
    align-items: center;
    padding: .5rem .95rem;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font-size: .85rem;
    font-weight: 560;
    text-decoration: none;
    white-space: nowrap;
  }
  .descargar:hover { filter: brightness(1.08); }
  .descargar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* ── Tarjetas ── */
  .tarjeta {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--sombra);
    overflow: hidden;
  }
  .tarjeta-cab {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: .5rem;
    padding: .85rem 1.15rem;
    border-bottom: 1px solid var(--border);
  }
  .tarjeta-cab h3 {
    margin: 0;
    font-size: .92rem;
    font-weight: 640;
    font-variant-numeric: tabular-nums;
  }
  .tarjeta-cab p { margin: 0; font-size: .8rem; color: var(--ink-2); }

  h2.seccion {
    margin: 0;
    padding: .85rem 1.15rem;
    border-bottom: 1px solid var(--border);
    font-size: .74rem;
    font-weight: 640;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--ink-2);
  }

  /* ── Resumen ── */
  .resumen {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 820px) { .resumen { grid-template-columns: 1fr; } }

  .kpi { padding: 1.15rem 1.25rem 1.25rem; }
  .kpi .etiqueta {
    margin: 0 0 .2rem;
    font-size: .74rem;
    font-weight: 620;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--muted);
  }
  .kpi .periodo { margin: 0 0 .5rem; font-size: .8rem; color: var(--ink-2); }
  /* El margen por defecto del <p> escala con la fuente: a 3.4rem deja un hueco enorme */
  .kpi .valor {
    margin: 0;
    font-size: 2rem;
    font-weight: 640;
    letter-spacing: -.02em;
    line-height: 1.05;
  }
  .kpi.hero .valor { font-size: 3.4rem; }
  .kpi .unidad { font-size: .85rem; font-weight: 500; color: var(--ink-2); margin-left: .35rem; }

  .delta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: .35rem;
    margin: .5rem 0 0;
    font-size: .82rem;
  }
  .delta .flecha { font-size: .72rem; }
  .delta.sube   { color: var(--good); }
  .delta.baja   { color: var(--bad); }
  .delta.neutro { color: var(--muted); }
  .delta .ref { color: var(--ink-2); font-weight: 400; }

  .kpi .cargas {
    margin: .75rem 0 0;
    padding-top: .7rem;
    border-top: 1px solid var(--border);
    font-size: .8rem;
    color: var(--ink-2);
  }

  /* ── Grafico ── */
  /* align-items:start — si no, la tarjeta del grafico se estira a la altura
     del ranking y queda un hueco muerto debajo de la linea */
  .paneles {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    align-items: start;
    gap: 1.25rem;
  }
  @media (max-width: 900px) { .paneles { grid-template-columns: 1fr; } }

  .gr-wrap { position: relative; padding: 1rem 1.15rem 1.15rem; }
  /* Alto automatico: estirar el viewBox deformaria el texto y los trazos */
  .gr-wrap svg { width: 100%; height: auto; display: block; overflow: visible; }

  .grid   { stroke: var(--grid); stroke-width: 1; }
  .area   { fill: var(--accent-10); stroke: none; }
  .linea  { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .cursor { stroke: var(--axis); stroke-width: 1; }
  .punto-fin { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
  .tick-y, .tick-x {
    fill: var(--muted);
    font-size: 11px;
    font-family: system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
  }
  .tick-y { text-anchor: end; }
  .tick-x { text-anchor: middle; }
  .zona   { fill: transparent; cursor: crosshair; }

  .tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: var(--ink);
    color: var(--surface);
    padding: .35rem .55rem;
    border-radius: 6px;
    font-size: .78rem;
    line-height: 1.35;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
  }
  .tooltip b { font-variant-numeric: tabular-nums; }

  /* ── Ranking ── */
  .ranking {
    list-style: none;
    margin: 0;
    padding: .9rem 1.15rem 1.15rem;
    display: flex;
    flex-direction: column;
    gap: .55rem;
  }
  .ranking li {
    display: grid;
    grid-template-columns: minmax(6rem, 9rem) 1fr auto;
    align-items: center;
    gap: .7rem;
    font-size: .85rem;
  }
  .rk-local {
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rk-barra { height: 18px; display: flex; align-items: center; }
  .rk-fill {
    height: 100%;
    min-width: 2px;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
  }
  .rk-valor { font-weight: 620; font-variant-numeric: tabular-nums; }
  .vacio-chico { margin: 0; padding: 1.5rem 1.15rem; color: var(--muted); font-size: .85rem; }

  /* ── Pestañas ── */
  .tabs {
    display: flex;
    gap: .25rem;
    padding: .3rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
  }
  .tabs button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: .85rem;
    font-weight: 550;
    padding: .45rem 1.05rem;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .tabs button:hover { color: var(--ink); }
  .tabs button[aria-selected="true"] { background: var(--accent-16); color: var(--ink); }
  .tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .panel { display: flex; flex-direction: column; gap: 1rem; }
  .panel[hidden] { display: none; }

  /* ── Tablas ── */
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
    opacity: .7;
  }

  /* La primera columna queda fija; la sombra avisa que flota sobre el resto */
  thead th:first-child, tbody th, tfoot th {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
    text-align: left;
    font-weight: 550;
    white-space: nowrap;
    box-shadow: 1px 0 0 var(--border), 6px 0 8px -6px rgba(0, 0, 0, .16);
  }
  thead th:first-child { z-index: 2; text-transform: uppercase; font-size: .72rem; }
  tbody th, tfoot th { padding: .55rem .9rem; font-size: .875rem; color: var(--ink); }

  td {
    padding: .55rem .9rem;
    text-align: right;
    border-top: 1px solid var(--border);
    font-size: .9rem;
    white-space: nowrap;
  }
  tbody tr:hover th, tbody tr:hover td { background: var(--accent-10); }

  .cero { color: var(--muted); }
  .total { font-weight: 640; }
  thead .total, tbody .total, tfoot .total { border-left: 1px solid var(--border); }

  .acumulado th, .acumulado td {
    background: var(--accent-10);
    border-top: 2px solid var(--border);
    font-weight: 640;
  }

  /* ── Calendario ── */
  .cal { padding: 1.15rem; }
  .nav-mes {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .75rem;
    margin-bottom: 1rem;
  }
  .nav-mes span { min-width: 11rem; text-align: center; font-weight: 620; }
  .nav-mes button {
    appearance: none;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 1.05rem;
    line-height: 1;
    cursor: pointer;
  }
  .nav-mes button:hover:not(:disabled) { background: var(--accent-10); }
  .nav-mes button:disabled { opacity: .35; cursor: default; }
  .nav-mes button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .grilla-cab, .grilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: .3rem; }
  .grilla-cab { margin-bottom: .4rem; }
  .grilla-cab span {
    text-align: center;
    font-size: .68rem;
    font-weight: 620;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--muted);
  }

  .dia {
    aspect-ratio: 1;
    min-height: 3rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .05rem;
    padding: .2rem;
    font: inherit;
  }
  .dia.fuera { border: 0; }
  .dia.sin-carga { color: var(--muted); background: transparent; }
  .dia.sin-carga .num { font-size: .78rem; }

  .dia.con-carga {
    cursor: pointer;
    border-color: transparent;
    color: var(--ink);
    transition: transform .12s ease;
  }
  .dia.con-carga:hover { transform: translateY(-1px); }
  .dia.con-carga:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  /*
   * Sombreado secuencial: un solo tono, del mas claro al mas intenso.
   *
   * Se corta en 58% a proposito. Mas arriba, en tema claro el fondo llega a un
   * azul medio donde el texto oscuro pierde contraste, y en tema oscuro pasa lo
   * mismo con el texto claro. Con este tope var(--ink) queda legible en ambos.
   */
  .dia.n1 { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
  .dia.n2 { background: color-mix(in srgb, var(--accent) 26%, var(--surface)); }
  .dia.n3 { background: color-mix(in srgb, var(--accent) 42%, var(--surface)); }
  .dia.n4 { background: color-mix(in srgb, var(--accent) 58%, var(--surface)); }

  .dia .num { font-size: .74rem; font-weight: 620; opacity: .85; }
  .dia .valor { font-size: .92rem; font-weight: 640; font-variant-numeric: tabular-nums; line-height: 1.1; }

  .resumen-mes, .leyenda {
    margin: 1rem 0 0;
    text-align: center;
    font-size: .8rem;
    color: var(--ink-2);
  }
  .leyenda { margin-top: .35rem; font-size: .75rem; color: var(--muted); }

  .vacio { padding: 3rem 1.5rem; text-align: center; }
  .vacio h2 { margin: 0 0 .5rem; font-size: 1.05rem; font-weight: 620; }
  .vacio p  { margin: 0 auto; max-width: 44ch; color: var(--ink-2); }

  @media (max-width: 600px) {
    body { padding: 1.25rem .75rem 3rem; }
    header.principal { align-items: flex-start; }
    .kpi.hero .valor { font-size: 2.6rem; }
  }
`;

// ── Script del cliente ───────────────────────────────────────────────────────

/** Se ejecuta antes de pintar para que no haya destello del tema equivocado. */
const JS_TEMA = `
  try {
    var t = localStorage.getItem('tema');
    if (t === 'claro' || t === 'oscuro') {
      document.documentElement.dataset.theme = t === 'claro' ? 'light' : 'dark';
    }
  } catch (e) {}
`;

const JS = (etiquetasMeses: string[]) => `
  // ── Tema ──
  var botonesTema = document.querySelectorAll('.tema button');

  function aplicarTema(t) {
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = (t === 'claro' ? 'light' : 'dark');

    botonesTema.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tema === t));
    });
    try { localStorage.setItem('tema', t); } catch (e) {}
  }

  botonesTema.forEach(function (b) {
    b.addEventListener('click', function () { aplicarTema(b.dataset.tema); });
  });

  try { aplicarTema(localStorage.getItem('tema') || 'auto'); } catch (e) { aplicarTema('auto'); }

  // ── Pestañas ──
  var tabs = document.querySelectorAll('.tabs button');

  function abrirTab(nombre) {
    tabs.forEach(function (t) {
      var activo = t.dataset.panel === nombre;
      t.setAttribute('aria-selected', String(activo));
      var p = document.getElementById(t.dataset.panel);
      if (p) p.hidden = !activo;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      abrirTab(tab.dataset.panel);
      try { localStorage.setItem('tab', tab.dataset.panel); } catch (e) {}
    });
  });

  try {
    var guardada = localStorage.getItem('tab');
    if (guardada && document.getElementById(guardada)) abrirTab(guardada);
  } catch (e) {}

  // ── Tooltip del gráfico ──
  var wrap = document.querySelector('.gr-wrap');
  if (wrap) {
    var svg     = wrap.querySelector('svg');
    var tip     = wrap.querySelector('.tooltip');
    var cursor  = wrap.querySelector('.cursor');

    wrap.querySelectorAll('.zona').forEach(function (z) {
      z.addEventListener('mouseenter', function () {
        var cx = parseFloat(z.dataset.cx), cy = parseFloat(z.dataset.cy);
        var caja = svg.getBoundingClientRect();
        var vb = svg.viewBox.baseVal;

        cursor.setAttribute('x1', cx);
        cursor.setAttribute('x2', cx);
        cursor.style.display = '';

        tip.innerHTML = z.dataset.etiqueta + ' · <b>' + z.dataset.total + '</b> personas';
        tip.hidden = false;
        tip.style.left = (svg.offsetLeft + (cx / vb.width) * caja.width) + 'px';
        tip.style.top  = (svg.offsetTop + (cy / vb.height) * caja.height - 8) + 'px';
      });
    });

    wrap.addEventListener('mouseleave', function () {
      tip.hidden = true;
      cursor.style.display = 'none';
    });
  }

  // ── Calendario ──
  var meses = [].slice.call(document.querySelectorAll('.mes'));

  if (meses.length) {
    var anterior  = document.getElementById('mes-anterior');
    var siguiente = document.getElementById('mes-siguiente');
    var titulo    = document.getElementById('mes-actual');
    var etiquetas = ${JSON.stringify(etiquetasMeses)};
    var i = 0;

    function mostrarMes(nuevo) {
      i = nuevo;
      meses.forEach(function (m, k) { m.hidden = k !== i; });
      titulo.textContent = etiquetas[i];
      siguiente.disabled = i === 0;                 // el indice crece hacia el pasado
      anterior.disabled  = i === meses.length - 1;
    }

    anterior.addEventListener('click',  function () { if (i < meses.length - 1) mostrarMes(i + 1); });
    siguiente.addEventListener('click', function () { if (i > 0) mostrarMes(i - 1); });

    document.querySelectorAll('.dia.con-carga').forEach(function (btn) {
      btn.addEventListener('click', function () {
        abrirTab('diario');
        try { localStorage.setItem('tab', 'diario'); } catch (e) {}
        var t = document.getElementById('dia-' + btn.dataset.fecha);
        if (t) {
          t.scrollIntoView({ behavior: 'smooth', block: 'center' });
          t.animate(
            [{ boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 0 transparent' }],
            { duration: 1600, easing: 'ease-out' },
          );
        }
      });
    });
  }
`;

// ── Render ───────────────────────────────────────────────────────────────────

export function renderPanel(d: Datos): string {
  const q = encodeURIComponent(d.clave);
  const hayDatos = d.totalRegistros > 0;
  const r = d.resumen;

  const meta = hayDatos
    ? `${nf.format(d.totalRegistros)} registros` + (d.ultimaCarga ? ` · última carga ${esc(d.ultimaCarga)}` : '')
    : 'Esperando el primer mensaje';

  const resumenHtml = `
    <div class="resumen">
      <section class="tarjeta kpi hero">
        <p class="etiqueta">Hoy</p>
        <p class="periodo">${esc(r.hoy.etiqueta)}</p>
        <p class="valor">${nf.format(r.hoy.total)}<span class="unidad">personas</span></p>
        ${delta(r.hoy, 'ayer')}
        <p class="cargas">
          ${r.hoy.cargas === 0
            ? 'Sin cargas todavía hoy'
            : `${r.hoy.cargas} ${r.hoy.cargas === 1 ? 'carga recibida' : 'cargas recibidas'}`}
        </p>
      </section>

      <section class="tarjeta kpi">
        <p class="etiqueta">Esta semana</p>
        <p class="periodo">${esc(r.semana.etiqueta)}</p>
        <p class="valor">${nf.format(r.semana.total)}</p>
        ${delta(r.semana, 'la semana pasada')}
      </section>

      <section class="tarjeta kpi">
        <p class="etiqueta">Este mes</p>
        <p class="periodo">${esc(r.mes.etiqueta)}</p>
        <p class="valor">${nf.format(r.mes.total)}</p>
        ${delta(r.mes, 'el mes pasado')}
      </section>
    </div>

    <div class="paneles">
      <section class="tarjeta">
        <h2 class="seccion">Personas por día · últimos 14 días</h2>
        ${grafico(r.tendencia)}
      </section>

      <section class="tarjeta">
        <h2 class="seccion">Locales · ${esc(r.mes.etiqueta)}</h2>
        ${ranking(r.ranking)}
      </section>
    </div>`;

  const cuerpo = hayDatos ? `
    ${resumenHtml}

    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="true"  data-panel="diario">Diario</button>
      <button role="tab" aria-selected="false" data-panel="semanal">Semanal</button>
      <button role="tab" aria-selected="false" data-panel="mensual">Mensual</button>
      <button role="tab" aria-selected="false" data-panel="calendario">Calendario</button>
    </div>

    <div class="panel" id="diario"     role="tabpanel">${tablaDiaria(d.diaria)}</div>
    <div class="panel" id="semanal"    role="tabpanel" hidden>${tablaPivote(d.semanal)}</div>
    <div class="panel" id="mensual"    role="tabpanel" hidden>${tablaPivote(d.mensual)}</div>
    <div class="panel" id="calendario" role="tabpanel" hidden>${calendario(d.calendario)}</div>
  ` : vacio;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Relevamiento de concurrencia</title>
  <script>${JS_TEMA}</script>
  <style>${CSS}</style>
</head>
<body>
  <div class="contenedor">
    <header class="principal">
      <div>
        <h1>Relevamiento de concurrencia</h1>
        <p class="meta">${meta}</p>
      </div>
      <div class="acciones">
        <div class="tema" role="group" aria-label="Tema">
          <button data-tema="claro"  aria-pressed="false">Claro</button>
          <button data-tema="auto"   aria-pressed="true">Auto</button>
          <button data-tema="oscuro" aria-pressed="false">Oscuro</button>
        </div>
        ${hayDatos ? `<a class="descargar" href="/panel/descargar?clave=${q}">Descargar Excel</a>` : ''}
      </div>
    </header>
    ${cuerpo}
  </div>
  <script>${JS(d.calendario.map(m => m.etiqueta))}</script>
</body>
</html>`;
}
