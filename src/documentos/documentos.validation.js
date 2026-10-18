import { z } from 'zod';

const texto = z.string().trim().min(1).max(500).refine((s) => s.isWellFormed() && !/[\u0000-\u001f]/u.test(s));
export const logoValido = (logo) => {
  if (logo === null) return true;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
  if (!match || match[2].length > 1398104) return false;
  const b = Buffer.from(match[2], 'base64');
  if (b.toString('base64') !== match[2] || b.length > 1048576) return false;
  const dimensiones = (w, h) => w > 0 && h > 0 && w <= 4096 && h <= 4096;
  if (match[1] === 'png') {
    if (b.length < 45 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;
    let pos = 8, cabecera = false, datos = false;
    while (pos + 12 <= b.length) {
      const n = b.readUInt32BE(pos), tipo = b.toString('ascii', pos + 4, pos + 8);
      if (pos + n + 12 > b.length) return false;
      if (!cabecera) {
        if (tipo !== 'IHDR' || n !== 13 || !dimensiones(b.readUInt32BE(pos + 8), b.readUInt32BE(pos + 12))) return false;
        cabecera = true;
      }
      if (tipo === 'IDAT') datos = true;
      if (tipo === 'IEND') return n === 0 && datos && pos + 12 === b.length;
      pos += n + 12;
    }
    return false;
  }
  if (b.length < 12 || b[0] !== 255 || b[1] !== 216 || b.at(-2) !== 255 || b.at(-1) !== 217) return false;
  let pos = 2, dimensionesValidas = false;
  while (pos + 4 < b.length) {
    if (b[pos++] !== 255) return false;
    while (b[pos] === 255) pos++;
    const marcador = b[pos++];
    if (marcador === 218) return dimensionesValidas; // Inicio del contenido comprimido.
    const n = b.readUInt16BE(pos);
    if (n < 2 || pos + n > b.length) return false;
    if ([192, 193, 194].includes(marcador)) {
      if (n < 8) return false;
      dimensionesValidas = dimensiones(b.readUInt16BE(pos + 5), b.readUInt16BE(pos + 3));
    }
    pos += n;
  }
  return false;
};
export const configuracionSchema = z.object({
  nombre_presidente: texto.nullable(),
  logo_personalizado: z.string().max(1398200).nullable().refine(logoValido),
  datos_emisor: z.object({ denominacion: texto, cif: texto, direccion: texto, contacto: texto.nullable().optional() }).strict(),
}).strict();
