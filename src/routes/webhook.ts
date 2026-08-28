import { Router, Request, Response } from 'express';
import { parsearRelevamiento } from '../services/parser';
import { agregarAlExcel } from '../services/excel';

export const webhookRouter = Router();

/** Un mensaje entrante, ya normalizado sin importar de donde vino. */
interface MensajeEntrante {
  texto:     string;
  remitente: string;
}

/**
 * Twilio manda form-urlencoded con Body y From.
 * Meta Cloud API manda JSON anidado.
 *
 * Aceptamos los dos para poder migrar de proveedor sin cortar el servicio.
 */
function extraerMensajes(body: any): MensajeEntrante[] {
  // ── Twilio ──
  if (typeof body?.Body === 'string') {
    return [{ texto: body.Body, remitente: body.From ?? '' }];
  }

  // ── Meta Cloud API ──
  // entry[].changes[].value.messages[] — puede traer varios de una
  const mensajes: MensajeEntrante[] = [];

  for (const entry of body?.entry ?? []) {
    for (const cambio of entry?.changes ?? []) {
      for (const m of cambio?.value?.messages ?? []) {
        // Solo mensajes de texto; ignoramos audios, imagenes, etc.
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
 * Verificacion del webhook de Meta.
 *
 * Al configurarlo, Meta hace un GET con un token y espera que le devolvamos
 * el challenge. Twilio no usa esto.
 */
webhookRouter.get('/whatsapp', (req: Request, res: Response) => {
  const token     = process.env.META_VERIFY_TOKEN;
  const modo      = req.query['hub.mode'];
  const enviado   = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!token) {
    console.warn('Verificacion de Meta rechazada: falta META_VERIFY_TOKEN');
    res.sendStatus(403);
    return;
  }

  if (modo === 'subscribe' && enviado === token) {
    console.log('Webhook verificado por Meta');
    res.status(200).send(String(challenge ?? ''));
    return;
  }

  console.warn('Verificacion de Meta rechazada: token incorrecto');
  res.sendStatus(403);
});

webhookRouter.post('/whatsapp', async (req: Request, res: Response) => {
  // Se responde 200 siempre: si devolvemos error, el proveedor reintenta el
  // mismo mensaje y terminaria cargandose dos veces.
  try {
    const mensajes = extraerMensajes(req.body);

    if (!mensajes.length) {
      // Meta manda tambien avisos de estado (entregado, leido); son ruido.
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
