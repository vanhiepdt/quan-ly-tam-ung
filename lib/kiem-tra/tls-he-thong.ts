import tls from 'node:tls'

type TlsMoRong = typeof tls & {
  getCACertificates?: (type?: 'default' | 'system' | 'bundled' | 'extra') => string[]
  setDefaultCACertificates?: (certs: readonly string[]) => void
}

export type KetQuaNapCa = { nap: boolean; them: number; lyDo?: string }

let daThu = false
let ketQua: KetQuaNapCa = { nap: false, them: 0, lyDo: 'chưa nạp' }

/** Antivirus/proxy Windows chèn chứng chỉ tự ký vào chuỗi HTTPS. Node không dùng kho Windows
 *  trừ khi nạp CA hệ thống. Không tắt kiểm tra chứng chỉ. */
export function napChungChiHeThong(): KetQuaNapCa {
  if (daThu) return ketQua
  daThu = true
  const t = tls as TlsMoRong
  if (typeof t.getCACertificates !== 'function' || typeof t.setDefaultCACertificates !== 'function') {
    ketQua = { nap: false, them: 0, lyDo: 'Node không hỗ trợ nạp CA hệ thống' }
    return ketQua
  }
  try {
    const macDinh = t.getCACertificates('default') ?? []
    const heThong = t.getCACertificates('system') ?? []
    if (!heThong.length) {
      ketQua = { nap: false, them: 0, lyDo: 'Windows không trả CA hệ thống' }
      return ketQua
    }
    const seen = new Set(macDinh)
    const them: string[] = []
    for (const c of heThong) {
      if (!c || seen.has(c)) continue
      seen.add(c)
      them.push(c)
    }
    if (them.length) t.setDefaultCACertificates([...macDinh, ...them])
    ketQua = { nap: true, them: them.length }
    return ketQua
  } catch (error) {
    ketQua = { nap: false, them: 0, lyDo: error instanceof Error ? error.message : 'lỗi CA' }
    return ketQua
  }
}

export function laLoiChungChiTuKy(mang: string): boolean {
  return /SELF_SIGNED_CERT_IN_CHAIN|unable to verify the first certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|self-signed certificate/i.test(mang)
}

export function loiMangNguoiDung(mang: string): string {
  if (laLoiChungChiTuKy(mang)) {
    return 'HTTPS bị chặn bởi chứng chỉ tự ký (antivirus/proxy trên Windows). Máy chủ nạp CA hệ thống — khởi động lại dev (chay-dev.bat moi) rồi thử lại. Hoặc tắt HTTPS scan của antivirus đối với Node.'
  }
  return mang
}
