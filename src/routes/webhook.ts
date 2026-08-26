import { Router, Request, Response } from 'express';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel } from '../services/excel';

export const webhookRouter = Router();

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const body: string = req.body.Body || '';
    const remitente: string = req.body.From || '';

    console.log(`Mensaje recibido de ${remitente}:`);
    console.log(body);

    const relevamiento = parsearRelevamiento(body, remitente);

    if (!relevamiento) {
      console.log('Mensaje ignorado: no es un relevamiento válido');
      res.status(200).send('<Response></Response>');
      return;
    }

    await agregarAlExcel(relevamiento);

    console.log(`Relevamiento del ${relevamiento.fecha.toLocaleDateString('es-AR')} procesado OK`);
    res.status(200).send('<Response></Response>');
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.status(200).send('<Response></Response>');
  }
});
