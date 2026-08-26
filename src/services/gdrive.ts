import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '18uruBWGJEx52A8wulNG8QgPVB6Ex8-VT';
const FILE_NAME = 'relevamientos.xlsx';

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const keyB64      = process.env.GOOGLE_PRIVATE_KEY_B64;

  console.log(`[gdrive] CLIENT_EMAIL: ${clientEmail ? 'OK' : 'FALTA'}`);
  console.log(`[gdrive] PRIVATE_KEY_B64: ${keyB64 ? 'OK (len=' + keyB64.length + ')' : 'FALTA'}`);

  if (!clientEmail) throw new Error('Falta variable GOOGLE_CLIENT_EMAIL');
  if (!keyB64)      throw new Error('Falta variable GOOGLE_PRIVATE_KEY_B64');

  const privateKey = Buffer.from(keyB64, 'base64').toString('utf8');

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key:  privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

/**
 * Diagnóstico: qué ve realmente la service account.
 * Endpoint temporal — quitar una vez resuelto el acceso a Drive.
 */
export async function diagnosticarAcceso() {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const resultado: Record<string, unknown> = {
    serviceAccount: process.env.GOOGLE_CLIENT_EMAIL,
    folderIdBuscado: FOLDER_ID,
  };

  // ¿Puede acceder a la carpeta configurada?
  try {
    const f = await drive.files.get({
      fileId: FOLDER_ID,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    resultado.carpetaConfigurada = { ok: true, ...f.data };
  } catch (e: any) {
    resultado.carpetaConfigurada = { ok: false, error: e?.message ?? String(e) };
  }

  // ¿Qué carpetas ve en total?
  try {
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    resultado.carpetasVisibles = res.data.files ?? [];
  } catch (e: any) {
    resultado.carpetasVisibles = { error: e?.message ?? String(e) };
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
