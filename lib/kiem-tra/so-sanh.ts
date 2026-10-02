export function chuanHoaMst(value: string): string {
  return value.replace(/[\s.\-]/g, '')
}

export function hienThiMst(value: string): string {
  const so = chuanHoaMst(value)
  if (/^\d{13}$/.test(so)) return `${so.slice(0, 10)}-${so.slice(10)}`
  return so
}

export function chuanHoaNgay(value: string): string | undefined {
  const gon = value.trim()
  const iso = gon.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const ymd = gon.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const dmy = gon.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
}

export function giongChuoi(a?: string, b?: string): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

export function giongMst(a?: string, b?: string): boolean {
  const x = chuanHoaMst(a ?? ''), y = chuanHoaMst(b ?? '')
  return Boolean(x) && x === y
}

export function giongTien(a?: number, b?: number): boolean {
  return a !== undefined && b !== undefined && a === b
}
