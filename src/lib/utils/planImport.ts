/**
 * Importing a house design (PDF sheet or picture) as a tracing underlay.
 *
 * A PDF page knows its paper size in points (1/72 inch), so a drawing made at a
 * known scale such as 1:100 can be placed at its real size without calibration.
 * A picture has no physical size, so it is calibrated afterwards by two points.
 */

/** Resolution used to rasterise a PDF sheet; enough to trace 5 cm details at 1:100. */
export const PDF_RENDER_DPI = 200;
/** Browsers (iOS Safari in particular) refuse canvases above ~16.7 megapixels. */
export const PLAN_PIXEL_LIMIT = 16_000_000;
export const PLAN_SIDE_LIMIT = 8192;
/** Common Polish architectural drawing scales (1:N). */
export const DRAWING_SCALES = [50, 100, 200] as const;
export const PLAN_FILE_LIMIT = 50 * 1024 * 1024;

const CM_PER_POINT = 2.54 / 72;

/** Pixels per PDF point for a sheet of the given size, bounded by the pixel limits. */
export function pdfRenderScale(widthPt: number, heightPt: number, dpi = PDF_RENDER_DPI): number {
  if (!(widthPt > 0) || !(heightPt > 0)) throw new Error('Invalid page size');
  return Math.min(
    dpi / 72,
    Math.sqrt(PLAN_PIXEL_LIMIT / (widthPt * heightPt)),
    PLAN_SIDE_LIMIT / widthPt,
    PLAN_SIDE_LIMIT / heightPt,
  );
}

/** Real-world centimetres per rendered pixel for a sheet drawn at 1:`ratio`. */
export function cmPerPixelForDrawing(ratio: number, renderScale: number): number {
  if (!(ratio > 0) || !(renderScale > 0)) throw new Error('Invalid drawing scale');
  return CM_PER_POINT * ratio / renderScale;
}

/** Validates a typed drawing scale such as "100" or "1:100"; returns N or null. */
export function parseDrawingScale(value: string): number | null {
  const match = value.trim().replace(/\s+/g, '').match(/^(?:1:)?(\d{1,4}(?:[.,]\d+)?)$/);
  if (!match) return null;
  const ratio = Number(match[1].replace(',', '.'));
  return ratio >= 1 && ratio <= 5000 ? ratio : null;
}

export function isPdfFile(file: { name: string; type: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
}

export interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
  /** Pixels per PDF point used for this render. */
  renderScale: number;
  widthPt: number;
  heightPt: number;
}

export interface PdfPlan {
  pageCount: number;
  render(pageNumber: number): Promise<RenderedPage>;
  thumbnail(pageNumber: number, maxSide?: number): Promise<string>;
  destroy(): Promise<void>;
}

/** Chooses the smaller of a lossless PNG and a high-quality JPEG; line drawings usually stay PNG. */
export function smallerEncoding(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL('image/png');
  const jpeg = canvas.toDataURL('image/jpeg', 0.88);
  const valid = [png, jpeg].filter(url => /^data:image\/(?:png|jpeg);base64,/.test(url));
  if (!valid.length) throw new Error('This browser could not encode the page.');
  return valid.sort((a, b) => a.length - b.length)[0];
}

async function drawPage(page: import('pdfjs-dist').PDFPageProxy, scale: number) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

/** Opens a PDF with pdf.js, loaded only when a PDF is actually chosen. */
export async function openPdfPlan(bytes: Uint8Array): Promise<PdfPlan> {
  if (!isPdfBytes(bytes)) throw new Error('This file is not a PDF.');
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, enableXfa: false });
  const document = await task.promise;
  const page = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > document.numPages) throw new Error('No such page.');
    return document.getPage(n);
  };
  return {
    pageCount: document.numPages,
    async render(pageNumber) {
      const pdfPage = await page(pageNumber);
      const base = pdfPage.getViewport({ scale: 1 });
      const renderScale = pdfRenderScale(base.width, base.height);
      const canvas = await drawPage(pdfPage, renderScale);
      const dataUrl = smallerEncoding(canvas);
      canvas.width = canvas.height = 0;
      return { dataUrl, width: Math.floor(base.width * renderScale), height: Math.floor(base.height * renderScale), renderScale, widthPt: base.width, heightPt: base.height };
    },
    async thumbnail(pageNumber, maxSide = 320) {
      const pdfPage = await page(pageNumber);
      const base = pdfPage.getViewport({ scale: 1 });
      const canvas = await drawPage(pdfPage, maxSide / Math.max(base.width, base.height));
      const url = canvas.toDataURL('image/jpeg', 0.8);
      canvas.width = canvas.height = 0;
      return url;
    },
    destroy: () => task.destroy(),
  };
}
