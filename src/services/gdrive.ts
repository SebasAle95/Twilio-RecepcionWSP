import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '18uruBWGJEx52A8wulNG8QgPVB6Ex8-VT';
const FILE_NAME = 'relevamientos.xlsx';

/**
 * Autenticación vía OAuth con una cuenta de Google real.
 *
 * No usamos service account: no tienen cuota de almacenamiento propia y no
 * pueden ser dueñas de archivos en un Drive personal (error 403
 * "Service Accounts do not have storage quota").
 */
function getAuth() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId)     throw new Error('Falta variable GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) throw new Error('Falta variable GOOGLE_OAUTH_CLIENT_SECRET');
  if (!refreshToken) throw new Error('Falta variable GOOGLE_OAUTH_REFRESH_TOKEN');

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/**
 * Diagnóstico de la conexión con Drive.
 * Endpoint temporal — quitar antes de entregar.
 */
export async function diagnosticarAcceso() {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const resultado: Record<string, unknown> = {
    modo: 'oauth (scope drive.file)',
    folderIdConfigurado: FOLDER_ID,
  };

  // ¿De quién es la cuenta autorizada?
  try {
    const about = await drive.about.get({ fields: 'user(emailAddress), storageQuota(limit, usage)' });
    resultado.cuenta = about.data;
  } catch (e: any) {
    resultado.cuenta = { error: e?.message ?? String(e) };
  }

  // ¿Ya existe el Excel? Con drive.file solo vemos los archivos de esta app,
  // así que la carpeta en sí no es inspeccionable — y no hace falta.
  try {
    const id = await buscarArchivoExistente(drive, FILE_NAME);
    resultado.excel = id
      ? { existe: true, id, url: `https://drive.google.com/file/d/${id}/view` }
      : { existe: false, nota: 'Todavía no se creó. Se crea con el primer mensaje.' };
  } catch (e: any) {
    resultado.excel = { error: e?.message ?? String(e) };
  }

  return resultado;
}

async function buscarArchivoExistente(drive: ReturnType<typeof google.drive>, nombre: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${nombre}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });
  return res.data.files?.[0]?.id ?? null;
}

/**
 * Baja el Excel desde Drive al disco local.
 *
 * Railway borra el disco en cada reinicio, así que Drive es la única copia
 * persistente. Sin esto, el primer mensaje después de un reinicio armaría un
 * Excel vacío y pisaría todo el historial al subirlo.
 *
 * @returns true si lo bajó, false si todavía no existe en Drive.
 */
export async function descargarDeGoogleDrive(destino: string): Promise<boolean> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const existingId = await buscarArchivoExistente(drive, FILE_NAME);
  if (!existingId) {
    console.log('Google Drive: no hay archivo previo, se empieza de cero');
    return false;
  }

  const res = await drive.files.get(
    { fileId: existingId, alt: 'media' },
    { responseType: 'stream' },
  );

  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(destino);
    (res.data as NodeJS.ReadableStream)
      .on('error', reject)
      .pipe(out)
      .on('finish', () => resolve())
      .on('error', reject);
  });

  console.log(`Google Drive: historial recuperado (id: ${existingId})`);
  return true;
}

export async function subirAGoogleDrive(excelPath: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const fileStream = fs.createReadStream(excelPath);
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const existingId = await buscarArchivoExistente(drive, FILE_NAME);

  let fileId: string;

  if (existingId) {
    // Actualizar el archivo existente
    const res = await drive.files.update({
      fileId: existingId,
      requestBody: { name: FILE_NAME },
      media: { mimeType, body: fileStream },
      fields: 'id',
    });
    fileId = res.data.id!;
    console.log(`Google Drive: archivo actualizado (id: ${fileId})`);
  } else {
    // Crear archivo nuevo
    const res = await drive.files.create({
      requestBody: { name: FILE_NAME, parents: [FOLDER_ID] },
      media: { mimeType, body: fileStream },
      fields: 'id',
    });
    fileId = res.data.id!;
    console.log(`Google Drive: archivo creado (id: ${fileId})`);
  }

  return `https://drive.google.com/file/d/${fileId}/view`;
}
