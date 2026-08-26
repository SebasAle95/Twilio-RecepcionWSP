import express from 'express';
import dotenv from 'dotenv';
import { webhookRouter } from './routes/webhook';
import { diagnosticarAcceso } from './services/gdrive';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Diagnóstico temporal de permisos de Drive — quitar una vez resuelto.
app.get('/debug/drive', async (_req, res) => {
  try {
    res.json(await diagnosticarAcceso());
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`[ENV] GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET'}`);
  console.log(`[ENV] GOOGLE_PRIVATE_KEY_B64: ${process.env.GOOGLE_PRIVATE_KEY_B64 ? 'SET (len=' + process.env.GOOGLE_PRIVATE_KEY_B64.length + ')' : 'NOT SET'}`);
});
