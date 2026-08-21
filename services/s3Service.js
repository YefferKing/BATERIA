require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');

// Configuración de AWS S3 desde variables de entorno
const s3Region = process.env.AWS_REGION || 'us-east-1';
const s3Bucket = process.env.AWS_S3_BUCKET_NAME || '';
const s3AccessKey = process.env.AWS_ACCESS_KEY_ID || '';
const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
const s3Endpoint = process.env.AWS_S3_ENDPOINT || undefined; // Para MinIO, Cloudflare R2 o Wasabi

let s3Client = null;

if (s3Bucket && s3AccessKey && s3SecretKey) {
  try {
    const s3Config = {
      region: s3Region,
      credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey
      }
    };
    if (s3Endpoint) {
      s3Config.endpoint = s3Endpoint;
      s3Config.forcePathStyle = true;
    }
    s3Client = new S3Client(s3Config);
    console.log(`✓ AWS S3 inicializado correctamente (Bucket: ${s3Bucket}, Región: ${s3Region})`);
  } catch (err) {
    console.error('⚠️ Error al configurar cliente AWS S3:', err.message);
  }
} else {
  console.log('ℹ️ AWS S3 no configurado en .env. Se usará almacenamiento local en /uploads para evidencias.');
}

/**
 * Decodifica una cadena Base64 y extrae el buffer binario y el MIME type
 */
function parseBase64Image(dataString) {
  const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    // Si no tiene prefijo data:image, intentar tratarlo como base64 puro
    return {
      type: 'image/jpeg',
      extension: 'jpg',
      buffer: Buffer.from(dataString, 'base64')
    };
  }

  const mimeType = matches[1];
  let extension = 'jpg';
  if (mimeType.includes('png')) extension = 'png';
  else if (mimeType.includes('webp')) extension = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';

  return {
    type: mimeType,
    extension,
    buffer: Buffer.from(matches[2], 'base64')
  };
}

/**
 * Limpia y normaliza un texto para usarlo de forma segura como nombre de carpeta en S3
 */
function sanitizeFolderName(str) {
  if (!str) return 'SIN_DATO';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes/acentos
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Reemplazar espacios y caracteres especiales por _
    .replace(/_+/g, '_')             // Evitar múltiples guiones bajos
    .replace(/^_|_$/g, '')           // Eliminar guiones al inicio o fin
    .toUpperCase();
}

/**
 * Genera una marca de fecha y hora legible: YYYYMMDD_HHMMSS
 */
function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Sube una imagen en base64 a AWS S3 (o al almacenamiento local de respaldo)
 * @param {string} base64String Cadena Base64 de la imagen
 * @param {object|number|string} benData Datos del beneficiario (objeto con municipio, vereda, documento, nombre)
 * @param {number} photoIndex Índice de la foto en la visita (1, 2, 3...)
 * @returns {Promise<string>} URL accesible de la foto
 */
async function uploadInspectionPhoto(base64String, benData = {}, photoIndex = 1) {
  if (!base64String || typeof base64String !== 'string') {
    return null;
  }

  // Si ya es una URL HTTP(S), retornarla tal como está
  if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
    return base64String;
  }

  const parsed = parseBase64Image(base64String);
  const dateTimeStr = getFormattedDateTime();
  const randomSuffix = Math.random().toString(36).substring(2, 6);

  // Extraer metadatos si vienen como objeto o usar id simple
  let municipioFolder = 'GENERAL';
  let veredaFolder = 'GENERAL';
  let benFolder = `BENEFICIARIO_${typeof benData === 'object' ? benData.id || '0' : benData}`;

  if (typeof benData === 'object' && benData !== null) {
    if (benData.municipio) municipioFolder = sanitizeFolderName(benData.municipio);
    if (benData.vereda) veredaFolder = sanitizeFolderName(benData.vereda);
    
    const idStr = benData.id ? `ID_${benData.id}` : 'ID_0';
    const docStr = benData.documento ? `CC_${sanitizeFolderName(benData.documento)}` : 'CC_0';
    const nomStr = benData.nombre ? `${sanitizeFolderName(benData.nombre).substring(0, 35)}` : 'BENEFICIARIO';
    benFolder = `${idStr}_${docStr}_${nomStr}`;
  }

  // Nombre de archivo profesional: visita_20260820_143000_foto1_a1b2.webp
  const fileName = `visita_${dateTimeStr}_foto${photoIndex}_${randomSuffix}.${parsed.extension}`;
  
  // Ruta jerárquica en AWS S3: inspecciones/MUNICIPIO/VEREDA/ID_X_CC_DOCUMENTO_NOMBRE/archivo.webp
  const s3Key = `inspecciones/${municipioFolder}/${veredaFolder}/${benFolder}/${fileName}`;

  // 1. Si AWS S3 está configurado, subir al bucket
  if (s3Client && s3Bucket) {
    try {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: parsed.buffer,
        ContentType: parsed.type
      });

      await s3Client.send(command);

      // Construir URL pública estándar de S3
      const publicUrl = s3Endpoint 
        ? `${s3Endpoint}/${s3Bucket}/${s3Key}` 
        : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${s3Key}`;

      return publicUrl;
    } catch (s3Error) {
      console.error(`Error al subir a AWS S3 (${s3Key}):`, s3Error.message);
      // Si falla S3, continuar al fallback local
    }
  }

  // 2. Modo Fallback Local (guarda en la carpeta /uploads del servidor con la misma estructura)
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads', municipioFolder, veredaFolder, benFolder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, parsed.buffer);

    // Retorna la ruta relativa servida estáticamente
    return `/uploads/${municipioFolder}/${veredaFolder}/${benFolder}/${fileName}`;
  } catch (localErr) {
    console.error('Error al guardar foto en disco local:', localErr.message);
    return base64String;
  }
}

/**
 * Procesa un arreglo de fotos en Base64 y retorna un arreglo de URLs subidas
 * @param {Array<string>} photosArray Arreglo de strings (Base64 o URLs)
 * @param {object|number|string} benData Metadatos del beneficiario
 * @returns {Promise<Array<string>>} Arreglo de URLs
 */
async function processInspectionPhotos(photosArray, benData) {
  if (!Array.isArray(photosArray) || photosArray.length === 0) {
    return [];
  }

  const uploadPromises = photosArray.map((photo, index) => 
    uploadInspectionPhoto(photo, benData, index + 1)
  );
  const results = await Promise.all(uploadPromises);
  return results.filter(Boolean);
}

module.exports = {
  uploadInspectionPhoto,
  processInspectionPhotos
};
