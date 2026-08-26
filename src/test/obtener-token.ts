/**
 * Script local para obtener el refresh token de OAuth.
 *
 * Uso:
 *   1. Poné GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET en el .env local
 *   2. npm run token
 *   3. Abrí el link que imprime, autorizá, y copiá el refresh token resultante
 *
 * No se usa en producción — solo corre en tu máquina, una sola vez.
 */
import http from 'http';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const PUERTO = 5555;
const REDIRECT_URI = `http://localhost:${PUERTO}`;
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\nFaltan GOOGLE_OAUTH_CLIENT_ID y/o GOOGLE_OAUTH_CLIENT_SECRET en el .env\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',   // pide refresh token
  prompt:      'consent',   // fuerza que lo devuelva aunque ya hayas autorizado antes
  scope:       SCOPES,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT_URI);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Falta el parámetro code.');
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Listo. Volvé a la terminal.</h2>');

    if (!tokens.refresh_token) {
      console.error('\nGoogle no devolvió refresh token.');
      console.error('Entrá a https://myaccount.google.com/permissions, quitá el acceso de la app y volvé a correr el script.\n');
    } else {
      console.log('\n' + '='.repeat(70));
      console.log('REFRESH TOKEN — cargalo en Railway como GOOGLE_OAUTH_REFRESH_TOKEN:');
      console.log('='.repeat(70));
      console.log(tokens.refresh_token);
      console.log('='.repeat(70) + '\n');
    }
  } catch (e: any) {
    console.error('\nError al canjear el código:', e?.message ?? e, '\n');
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error al canjear el código. Mirá la terminal.');
  } finally {
    server.close();
  }
});

server.listen(PUERTO, () => {
  console.log('\nAbrí este link en el navegador y autorizá el acceso:\n');
  console.log(authUrl + '\n');
  console.log(`(Esperando la respuesta en ${REDIRECT_URI} ...)\n`);
});
