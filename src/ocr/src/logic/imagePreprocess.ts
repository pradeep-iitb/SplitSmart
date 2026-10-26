/**
 * Canvas preprocessing: EXIF-aware decode, rotate, rescale, grayscale + contrast stretch,
 * and an optional adaptive binarisation for faded thermal paper.
 */
export type Rotation = 0 | 90 | 180 | 270;
export type PreprocessMode = 'gray' | 'binarized';
export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TARGET_LONG_SIDE = 2000; // Tesseract is happiest around 300 DPI-equivalent text height
const MIN_LONG_SIDE = 1200;    // upscale small screenshots / low-res photos (max 2x)

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); }
  catch { return await createImageBitmap(file); } // older Safari rejects the options bag
}

function makeCanvas(w: number, h: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function preprocessToCanvas(
  bmp: ImageBitmap,
  { rotation = 0, mode = 'gray' }: { rotation?: Rotation; mode?: PreprocessMode } = {},
): CanvasLike {
  const long = Math.max(bmp.width, bmp.height);
  const scale = long > TARGET_LONG_SIDE ? TARGET_LONG_SIDE / long : long < MIN_LONG_SIDE ? Math.min(2, MIN_LONG_SIDE / long) : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const swap = rotation === 90 || rotation === 270;
  const canvas = makeCanvas(swap ? h : w, swap ? w : h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = grayStretch(img.data, canvas.width * canvas.height);
  if (mode === 'binarized') binarize(gray, canvas.width, canvas.height);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = gray[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Luma + stretch the 2nd..98th percentile to 0..255 (rescues washed-out photos). */
function grayStretch(rgba: Uint8ClampedArray, n: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) | 0;
    gray[i] = v; hist[v]++;
  }
  const pct = (p: number) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  const lo = pct(0.02), hi = pct(0.98);
  if (hi - lo < 20) return gray;
  const k = 255 / (hi - lo);
  for (let i = 0; i < n; i++) gray[i] = (gray[i] - lo) * k;
  return gray;
}

/** Bradley-Roth adaptive threshold using an integral image (O(n), fine for 2000px). */
function binarize(gray: Uint8ClampedArray, w: number, h: number): void {
  const half = (Math.max(15, Math.round(Math.min(w, h) / 16)) | 1) >> 1;
  const W1 = w + 1;
  const integral = new Uint32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * W1 + x + 1] = integral[y * W1 + x + 1] + row;
    }
  }
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * W1 + x1 + 1] - integral[y0 * W1 + x1 + 1] - integral[(y1 + 1) * W1 + x0] + integral[y0 * W1 + x0];
      out[y * w + x] = gray[y * w + x] * area < sum * 0.88 ? 0 : 255;
    }
  }
  gray.set(out);
}
