'use client'

export type BoLocTheoDoi = {
  tuKhoa?: string
  tuNgay?: string
  denNgay?: string
  hinhThuc?: string
  trangThaiHd?: string
  trangThaiTtPhi?: string
  hoSo?: 'hoaDon' | 'chuyenKhoan'
  soKetQua?: number
}

export function BoLocTheoDoi({ boLoc, hinhThucOptions, onChange, onClear }: {
  boLoc: BoLocTheoDoi
  hinhThucOptions: readonly string[]
  onChange: (next: BoLocTheoDoi) => void
  onClear: () => void
}) {
  const set = (key: keyof BoLocTheoDoi, value: string) => onChange({ ...boLoc, [key]: value || undefined })
  const dangLoc = Object.values(boLoc).some(Boolean)
  return <section className="card mb-5 p-4 sm:p-5" aria-label="Bộ lọc giao dịch">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="field sm:col-span-2 lg:col-span-2">Tìm giao dịch
        <input className="input" value={boLoc.tuKhoa ?? ''} onChange={e => set('tuKhoa', e.target.value)} placeholder="Nội dung, đơn vị, số hóa đơn" />
      </label>
      <label className="field">Từ ngày
        <input className="input" type="date" value={boLoc.tuNgay ?? ''} onChange={e => set('tuNgay', e.target.value)} />
      </label>
      <label className="field">Đến ngày
        <input className="input" type="date" value={boLoc.denNgay ?? ''} onChange={e => set('denNgay', e.target.value)} />
      </label>
      <label className="field">Hình thức
        <select className="input" value={boLoc.hinhThuc ?? ''} onChange={e => set('hinhThuc', e.target.value)}>
          <option value="">Tất cả</option>{hinhThucOptions.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">Tình trạng hóa đơn
        <select className="input" value={boLoc.trangThaiHd ?? ''} onChange={e => set('trangThaiHd', e.target.value)}>
          <option value="">Tất cả</option><option>Hợp lệ</option><option>Chờ HĐ</option><option>Không hợp lệ</option><option>Không có</option>
        </select>
      </label>
      <label className="field">Phí lấy hóa đơn
        <select className="input" value={boLoc.trangThaiTtPhi ?? ''} onChange={e => set('trangThaiTtPhi', e.target.value)}>
          <option value="">Tất cả</option><option>Không phát sinh</option><option>Chưa thanh toán</option><option>Đã thanh toán</option><option>Đã hoàn trả</option>
        </select>
      </label>
      <label className="field">Hồ sơ
        <select className="input" value={boLoc.hoSo ?? ''} onChange={e => set('hoSo', e.target.value)}>
          <option value="">Tất cả</option><option value="hoaDon">Có tệp hóa đơn</option><option value="chuyenKhoan">Có tệp chuyển khoản</option>
        </select>
      </label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
      <span className="text-sm text-slate-600">Đang hiển thị <strong>{boLoc.soKetQua ?? '—'}</strong> giao dịch</span>
      <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" disabled={!dangLoc} onClick={onClear}>Xóa bộ lọc</button>
    </div>
  </section>
}
