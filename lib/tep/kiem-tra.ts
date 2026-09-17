const CHU_KY: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25,0x50,0x44,0x46] },
  { mime: 'image/jpeg', bytes: [0xff,0xd8,0xff] },
  { mime: 'image/png', bytes: [0x89,0x50,0x4e,0x47] },
  { mime: 'image/webp', bytes: [0x52,0x49,0x46,0x46] },
]
export async function loaiTepThat(file: File): Promise<string | null> {
  const dau = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  for (const item of CHU_KY) if (item.bytes.every((byte, i) => dau[i] === byte)) {
    if (item.mime !== 'image/webp' || new TextDecoder().decode(dau.slice(8,12)) === 'WEBP') return item.mime
  }
  const text = new TextDecoder().decode(dau).trimStart()
  return text.startsWith('<?xml') || text.startsWith('<') ? 'application/xml' : null
}
export function phanMoRong(mime: string) { return ({ 'application/pdf':'pdf','application/xml':'xml','image/jpeg':'jpg','image/png':'png','image/webp':'webp' } as Record<string,string>)[mime] }
