/**
 * Scale an image down in the browser so its longest side is at most `maxDimension`.
 * Returns the original blob when it is already small enough or can't be decoded.
 */
export async function downscaleImage(blob: Blob, maxDimension: number, quality = 0.88): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  const longestSide = Math.max(bitmap.width, bitmap.height);
  if (longestSide <= maxDimension) {
    bitmap.close();
    return blob;
  }

  const scale = maxDimension / longestSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return blob;
  }

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result ?? blob), 'image/jpeg', quality);
  });
}

/** Upload size limits per use. */
export const IMAGE_MAX_DIMENSIONS = {
  avatar: 1024,
  background: 2400,
} as const;
