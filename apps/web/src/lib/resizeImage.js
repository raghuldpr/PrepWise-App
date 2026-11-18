// Shrinks a picked image in the browser before upload: longest side 1024 px, re-encoded as JPEG under ~700 KB.
// Re-encoding also drops metadata (location, device) from photos. Returns { mimeType, dataBase64, previewUrl }.
const MAX_SIDE = 1024;
const MAX_BYTES = 700_000;

export async function resizeImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 15_000_000) throw new Error('That image is too large. Choose one under 15 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('That image could not be read.'); });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= MAX_BYTES) {
      const dataBase64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.onerror = () => rej(new Error('That image could not be read.'));
        r.readAsDataURL(blob);
      });
      return { mimeType: 'image/jpeg', dataBase64, previewUrl: URL.createObjectURL(blob) };
    }
  }
  throw new Error('That image is too detailed to shrink enough. Crop it to the part you need.');
}
