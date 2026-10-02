import {
  Canvas, createCanvas, DOMMatrix, Path2D,
  ImageData as NapiImageData,
} from '@napi-rs/canvas'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

export type AnhHoaDon = {
  png: Buffer
  width: number
  height: number
}

const CHIEU_RONG_AI = 1600
const require = createRequire(import.meta.url)

type PdfjsApi = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let napPdfjsPromise: Promise<PdfjsApi> | null = null

function napDaHinhDom() {
  const g = globalThis as Record<string, unknown>
  g.DOMMatrix ??= DOMMatrix
  g.Path2D ??= Path2D
  g.ImageData ??= NapiImageData
}

function nhaMayCanvas() {
  return class {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height))
      return { canvas, context: canvas.getContext('2d') }
    }
    reset(doi: { canvas: Canvas }, width: number, height: number) {
      doi.canvas.width = Math.ceil(width)
      doi.canvas.height = Math.ceil(height)
    }
    destroy(doi: { canvas?: Canvas; context?: unknown }) {
      doi.canvas = undefined
      doi.context = undefined
    }
  }
}

function thuMucPdfjs(): string | null {
  try {
    return dirname(require.resolve('pdfjs-dist/package.json'))
  } catch {
    const thu = join(process.cwd(), 'node_modules', 'pdfjs-dist')
    return existsSync(join(thu, 'package.json')) ? thu : null
  }
}

function nhaMayDuLieuNhiPhan(goc: string) {
  const cmap = join(goc, 'cmaps')
  const font = join(goc, 'standard_fonts')
  const wasm = join(goc, 'wasm')
  return class {
    async fetch({ kind, filename }: { kind?: string; filename: string }) {
      const ten = String(filename ?? '').replace(/\\/g, '/').split('/').pop() ?? ''
      if (!ten || ten.includes('..')) throw new Error('Tài nguyên PDF không hợp lệ.')
      const k = String(kind ?? '').toLowerCase()
      const thu = k.includes('wasm') ? wasm : (k.includes('cmap') ? cmap : font)
      try {
        return new Uint8Array(await readFile(join(thu, ten)))
      } catch {
        throw new Error('Thiếu font hoặc bản đồ ký tự để dựng PDF.')
      }
    }
  }
}

async function napPdfjs(): Promise<PdfjsApi> {
  if (napPdfjsPromise) return napPdfjsPromise
  napPdfjsPromise = (async () => {
    napDaHinhDom()
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ])
    ;(globalThis as Record<string, unknown>).pdfjsWorker = worker
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'
    return pdfjs
  })()
  return napPdfjsPromise
}

function tuyChonPdf(bytes: Uint8Array) {
  const goc = thuMucPdfjs()
  return {
    data: Uint8Array.from(bytes),
    CanvasFactory: nhaMayCanvas(),
    ...(goc ? { BinaryDataFactory: nhaMayDuLieuNhiPhan(goc) } : {}),
    isOffscreenCanvasSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  }
}

type PdfDocument = Awaited<ReturnType<PdfjsApi['getDocument']>['promise']>

async function vePdfTrang(doc: PdfDocument, soTrang: number): Promise<AnhHoaDon> {
  const trang = await doc.getPage(soTrang)
  try {
    const coSo = trang.getViewport({ scale: 1 })
    const scale = Math.min(CHIEU_RONG_AI / coSo.width, 3)
    const viewport = trang.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    await trang.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise
    return { png: canvas.toBuffer('image/png'), width: canvas.width, height: canvas.height }
  } finally {
    trang.cleanup()
  }
}

async function vePdf(bytes: Uint8Array): Promise<AnhHoaDon> {
  const pdfjs = await napPdfjs()
  const doc = await pdfjs.getDocument(tuyChonPdf(bytes)).promise
  try {
    if (!doc.numPages) throw new Error('PDF không có trang.')
    return vePdfTrang(doc, 1)
  } finally {
    await doc.cleanup()
  }
}

export async function veTrangHoaDon(bytes: Uint8Array, mime: string): Promise<AnhHoaDon> {
  if (mime !== 'application/pdf') throw new Error('Chỉ có thể dựng hình từ PDF.')
  return vePdf(bytes)
}

export async function veTrangChoAi(bytes: Uint8Array, mime: string): Promise<AnhHoaDon> {
  return veTrangHoaDon(bytes, mime)
}

export async function thuNhoPng(png: Buffer, chieuRong: number): Promise<Buffer> {
  const { loadImage } = await import('@napi-rs/canvas')
  const img = await loadImage(png)
  if (img.width <= chieuRong) return png
  const scale = chieuRong / img.width
  const canvas = createCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toBuffer('image/png')
}
