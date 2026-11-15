import sharp from 'sharp';
import { HttpError } from './security.mjs';
export async function sanitizeImage(file,max) {
  if(!(file instanceof File)||file.size<1||file.size>max) throw new HttpError(400,'Imagen vacía o demasiado grande.');
  const allowed={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp','image/gif':'gif'};
  const format=allowed[file.type];if(!format)throw new HttpError(400,'Formato de imagen no permitido.');
  try {
    const bytes=Buffer.from(await file.arrayBuffer());
    const magic=(format==='png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (format==='jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) ||
      (format==='gif' && ['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString())) ||
      (format==='webp' && bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP');
    if(!magic)throw new Error('signature mismatch');
    const input=sharp(bytes,{animated:true,limitInputPixels:25000000,failOn:'warning'});
    const meta=await input.metadata();
    if(meta.format!==format || (meta.pages||1)>100 || !meta.width || !meta.height || meta.width*meta.height>25000000)throw new Error('image limit');
    // Re-encode pixels; EXIF, GPS, comments and appended payloads are not retained.
    const result=await input.rotate().toFormat(format).timeout({seconds:10}).toBuffer();
    if(result.length>max)throw new Error('output limit');
    return new File([result],`image.${format==='jpeg'?'jpg':format}`,{type:file.type});
  } catch {throw new HttpError(400,'La imagen no es válida o supera los límites de resolución.');}
}

