import express from 'express';
import dotenv from 'dotenv';
import { webhookRouter } from './routes/webhook';

dotenv.config();

async function loadRailwayVars(): Promise<void> {
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY_B64) return;

  const token = process.env.RAILWAY_API_TOKEN;
  const serviceId = process.env.RAILWAY_SERVICE_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;

  if (!token || !serviceId || !environmentId) return;

  console.log('[Railway] Runtime V2 workaround: fetching vars via API...');

  const query = `query { variables(serviceId: "${serviceId}", environmentId: "${environmentId}") }`;

  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const json = await res.json() as any;
  const vars = json?.data?.variables;

  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      process.env[k] = v as string;
    }
    console.log(`[Railway] Cargadas ${Object.keys(vars).length} variables via API`);
  } else {
    console.error('[Railway] Respuesta inesperada de API:', JSON.stringify(json));
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

(async () => {
  await loadRailwayVars();

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    console.log(`[ENV] GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET'}`);
    console.log(`[ENV] GOOGLE_PRIVATE_KEY_B64: ${process.env.GOOGLE_PRIVATE_KEY_B64 ? 'SET (len=' + process.env.GOOGLE_PRIVATE_KEY_B64.length + ')' : 'NOT SET'}`);
  });
})();
