import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '18uruBWGJEx52A8wulNG8QgPVB6Ex8-VT';
const FILE_NAME = 'relevamientos.xlsx';

function getAuth() {
  const clientEmail  = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey       = process.env.GOOGLE_PRIVATE_KEY;
  const privateKey   = rawKey?.replace(/\\n/g, '\n');

  console.log(`[gdrive] CLIENT_EMAIL: ${clientEmail ? 'OK (' + clientEmail.slice(0, 20) + '...)' : 'FALTA'}`);
  console.log(`[gdrive] PRIVATE_KEY: ${rawKey ? 'OK (len=' + rawKey.length + ')' : 'FALTA'}`);

  if (!clientEmail) throw new Error('Falta variable GOOGLE_CLIENT_EMAIL');
  if (!privateKey)  throw new Error('Falta variable GOOGLE_PRIVATE_KEY');

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key:  privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

async function buscarArchivoExistente(drive: ReturnType<typeof google.drive>, nombre: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${nombre}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });
  return res.data.files?.[0]?.id ?? null;
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
