import { Router, Request, Response } from 'express';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel } from '../services/excel';

export const webhookRouter = Router();

/** Un mensaje de texto entrante, ya normalizado. */
interface MensajeEntrante {
  texto:     string;
  remitente: string;
}

/**
 * Extrae los mensajes de texto del payload de Meta Cloud API.
 *
 * El payload viene anidado y puede traer varios mensajes de una sola vez.
 * Tambien llegan avisos de estado (entregado, leido) que no tienen `messages`
 * y se descartan solos.
 */
function extraerMensajes(body: any): MensajeEntrante[] {
  const mensajes: MensajeEntrante[] = [];

  for (const entry of body?.entry ?? []) {
    for (const cambio of entry?.changes ?? []) {
      for (const m of cambio?.value?.messages ?? []) {
        // Solo texto: ignoramos audios, imagenes, ubicaciones, etc.
        if (m?.type !== 'text' || !m?.text?.body) continue;
        mensajes.push({
          texto:     m.text.body,
          remitente: m.from ? `whatsapp:+${m.from}` : '',
        });
      }
    }
  }

  return mensajes;
}

/**
 * Verificacion del webhook.
 *
 * Al configurarlo, Meta hace un GET con un token y espera que le devolvamos
 * el challenge tal cual.
 */
webhookRouter.get('/whatsapp', (req: Request, res: Response) => {
  const token     = process.env.META_VERIFY_TOKEN;
  const modo      = req.query['hub.mode'];
  const enviado   = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!token) {
    console.warn('Verificacion rechazada: falta META_VERIFY_TOKEN');
    res.sendStatus(403);
    return;
  }

  if (modo === 'subscribe' && enviado === token) {
    console.log('Webhook verificado por Meta');
    res.status(200).send(String(challenge ?? ''));
    return;
  }

  console.warn('Verificacion rechazada: token incorrecto');
  res.sendStatus(403);
});

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  // Se responde 200 siempre: si devolvemos error, Meta reintenta el mismo
  // mensaje y el relevamiento se cargaria dos veces.
  try {
    const mensajes = extraerMensajes(req.body);

    if (!mensajes.length) {
      res.sendStatus(200);
      return;
    }

    for (const { texto, remitente } of mensajes) {
      console.log(`Mensaje recibido de ${remitente}:`);
      console.log(texto);

      const relevamiento = parsearRelevamiento(texto, remitente);

      if (!relevamiento) {
        console.log('Mensaje ignorado: no es un relevamiento valido');
        continue;
      }

      await agregarAlExcel(relevamiento);
      console.log(`Relevamiento del ${relevamiento.fecha.toLocaleDateString('es-AR')} procesado OK`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.sendStatus(200);
  }
});
