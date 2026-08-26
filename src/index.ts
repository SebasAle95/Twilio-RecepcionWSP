import express from 'express';
import dotenv from 'dotenv';
import { webhookRouter } from './routes/webhook';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
