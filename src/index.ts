import express from 'express';
import dotenv from 'dotenv';
import { webhookRouter } from './routes/webhook';
import { panelRouter } from './routes/panel';
import { EXCEL_PATH } from './services/excel';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/webhook', webhookRouter);
app.use('/panel', panelRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`Excel: ${EXCEL_PATH}`);

  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH && process.env.NODE_ENV === 'production') {
    console.warn(
      'ATENCION: no hay volumen montado. El disco es efímero y los datos se ' +
      'pierden en cada reinicio. Montá un volumen en Railway.',
    );
  }
  if (!process.env.PANEL_CLAVE) {
    console.warn('ATENCION: falta PANEL_CLAVE. El panel web está deshabilitado.');
  }
});
