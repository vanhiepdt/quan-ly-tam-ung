import {
  Canvas, createCanvas, loadImage, DOMMatrix, Path2D,
  ImageData as NapiImageData, type SKRSContext2D,
} from '@napi-rs/canvas'
import jsQR from 'jsqr'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { DuLieuDocTuHoaDon } from './giao-dien'
import type { ChuHoaDon } from './ocr-hoa-don'
import { docQrHoaDon } from './qr-hoa-don'

export type AnhHoaDon = {
  png: Buffer
  width: number
  height: number
  pixels: Uint8ClampedArray
  chu?: ChuHoaDon[]
}

const CHIEU_RONG_QR = 2000
const CHIEU_RONG_AI = 1280
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
    destroy(doi: { canvas?: Canvas; context?: SKRSContext2D }) {
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
    // Next không tải được worker qua file://. Gắn sẵn handler để pdfjs chạy fake worker trên luồng chính.
    ;(globalThis as Record<string, unknown>).pdfjsWorker = worker
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'
    return pdfjs
  })()
  return napPdfjsPromise
}

function layPixel(canvas: Canvas): AnhHoaDon {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  return {
    png: canvas.toBuffer('image/png'),
    width, height,
    pixels: ctx.getImageData(0, 0, width, height).data,
  }
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

type PdfTextItem = { str?: string; transform?: number[] }

function chuTuTrang(tc: { items: unknown[] }): ChuHoaDon[] {
  const chu: ChuHoaDon[] = []
  for (const raw of tc.items) {
    const item = raw as PdfTextItem
    const str = item.str
    const t = item.transform
    if (!str?.trim() || !t || t.length < 6) continue
    chu.push({ x: t[4], y: t[5], chu: str })
  }
  return chu
}

async function vePdf(bytes: Uint8Array, chieuRong: number): Promise<AnhHoaDon> {
  const pdfjs = await napPdfjs()
  const doc = await pdfjs.getDocument(tuyChonPdf(bytes)).promise
  try {
    const trang = await doc.getPage(1)
    const coSo = trang.getViewport({ scale: 1 })
    const scale = Math.min(chieuRong / coSo.width, 3)
    const viewport = trang.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    await trang.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise
    let chu: ChuHoaDon[] = []
    try {
      chu = chuTuTrang(await trang.getTextContent())
    } catch {
      chu = []
    }
    return { ...layPixel(canvas), chu }
  } finally {
    await doc.cleanup()
  }
}

export async function docChuPdf(bytes: Uint8Array): Promise<ChuHoaDon[]> {
  const pdfjs = await napPdfjs()
  const doc = await pdfjs.getDocument(tuyChonPdf(bytes)).promise
  try {
    const trang = await doc.getPage(1)
    return chuTuTrang(await trang.getTextContent())
  } finally {
    await doc.cleanup()
  }
}

async function veAnh(bytes: Uint8Array, chieuRong: number): Promise<AnhHoaDon> {
  const img = await loadImage(Buffer.from(bytes))
  const scale = img.width > chieuRong ? chieuRong / img.width : 1
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = createCanvas(width, height)
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  return layPixel(canvas)
}

export async function veTrangHoaDon(bytes: Uint8Array, mime: string, chieuRong = CHIEU_RONG_QR): Promise<AnhHoaDon> {
  return mime === 'application/pdf' ? vePdf(bytes, chieuRong) : veAnh(bytes, chieuRong)
}

export function quetQr(anh: AnhHoaDon): DuLieuDocTuHoaDon | null {
  const ma = jsQR(anh.pixels, anh.width, anh.height, { inversionAttempts: 'attemptBoth' })
  return ma ? docQrHoaDon(ma.data) : null
}

export async function docQrTuTep(bytes: Uint8Array, mime: string): Promise<{
  qr: DuLieuDocTuHoaDon | null
  anh: AnhHoaDon
  chu: ChuHoaDon[]
}> {
  const anh = await veTrangHoaDon(bytes, mime)
  return { qr: quetQr(anh), anh, chu: anh.chu ?? [] }
}

export async function veTrangChoAi(bytes: Uint8Array, mime: string): Promise<AnhHoaDon> {
  return veTrangHoaDon(bytes, mime, CHIEU_RONG_AI)
}

export async function thuNhoPng(png: Buffer, chieuRong: number): Promise<Buffer> {
  const img = await loadImage(png)
  if (img.width <= chieuRong) return png
  const scale = chieuRong / img.width
  const canvas = createCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toBuffer('image/png')
}
