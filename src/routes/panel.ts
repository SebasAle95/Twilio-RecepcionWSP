import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { obtenerRegistros, EXCEL_PATH } from '../services/excel';
import { vistaDiaria, vistaSemanal, vistaMensual } from '../services/vistas';
import { renderPanel } from '../views/panel';

export const panelRouter = Router();

/**
 * El panel es público en internet, así que va detrás de una clave que viaja
 * en la query string. No es autenticación seria — es para que la URL no sea
 * adivinable. Si no hay clave configurada, el panel queda cerrado.
 */
function exigirClave(req: Request, res: Response, next: NextFunction): void {
  const esperada = process.env.PANEL_CLAVE;

  if (!esperada) {
    res.status(503).type('text/plain; charset=utf-8')
      .send('El panel no está configurado. Falta la variable PANEL_CLAVE.');
    return;
  }

  if (req.query.clave !== esperada) {
    res.status(401).type('text/plain; charset=utf-8')
      .send('Clave incorrecta.');
    return;
  }

  next();
}

panelRouter.get('/', exigirClave, async (req, res) => {
  try {
    const registros = await obtenerRegistros();

    const ultimaCarga = registros.length
      ? registros.reduce((max, r) => (r.recibido > max ? r.recibido : max), '')
      : null;

    res.type('text/html; charset=utf-8').send(renderPanel({
      diaria:         vistaDiaria(registros),
      semanal:        vistaSemanal(registros),
      mensual:        vistaMensual(registros),
      totalRegistros: registros.length,
      ultimaCarga,
      clave: String(req.query.clave),
    }));
  } catch (e: any) {
    console.error('Error armando el panel:', e);
    res.status(500).type('text/plain; charset=utf-8')
      .send('Error al leer los datos.');
  }
});

panelRouter.get('/descargar', exigirClave, (_req, res) => {
  if (!fs.existsSync(EXCEL_PATH)) {
    res.status(404).type('text/plain; charset=utf-8')
      .send('Todavía no hay datos cargados.');
    return;
  }
  res.download(EXCEL_PATH, 'relevamientos.xlsx');
});
