'use client'
import { useState, useActionState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { cotMacDinh, cotNhatKy, thuTuCot, type CotId, type TuyChonCot, rongMin, rongMax } from '../giao-dich/cot-nhat-ky'
import { luuTuyChonCot } from '../giao-dich/tuy-chon-actions'

const initial = { ok: false, thongBao: '' }

export function TuyChonCot({ banDau, loiBanDau }: { banDau: TuyChonCot | null; loiBanDau: string | null }) {
  const [tuyChon, setTuyChon] = useState<TuyChonCot>(banDau ?? cotMacDinh())
  const [state, action, pending] = useActionState(async (_prev: typeof initial, formData: FormData) => {
    try {
      const json = formData.get('tuy_chon')
      const parsed = json ? JSON.parse(String(json)) : null
      return await luuTuyChonCot(parsed)
    } catch (error) {
      unstable_rethrow(error)
      return { ok: false, thongBao: 'Không kết nối được máy chủ. Tùy chọn chưa được lưu; vui lòng thử lại.' }
    }
  }, initial)

  const toggleAn = (id: CotId) => {
    const anMoi = tuyChon.an.includes(id) ? tuyChon.an.filter(c => c !== id) : [...tuyChon.an, id]
    setTuyChon({ ...tuyChon, an: anMoi })
  }

  const capNhatRong = (id: CotId, rong: number) => {
    setTuyChon({ ...tuyChon, rong: { ...tuyChon.rong, [id]: rong } })
  }

  const datLaiMacDinh = () => {
    setTuyChon(cotMacDinh())
  }
  const dichChuyenCot = (id: CotId, huong: -1 | 1) => {
    const thuTu = thuTuCot(tuyChon)
    const index = thuTu.indexOf(id)
    const dich = index + huong
    if (dich < 0 || dich >= thuTu.length) return
    const thuTuMoi = [...thuTu]
    ;[thuTuMoi[index], thuTuMoi[dich]] = [thuTuMoi[dich], thuTuMoi[index]]
    setTuyChon({ ...tuyChon, thuTu: thuTuMoi })
  }

  return <div>
    {loiBanDau && <p className="notice error" role="alert">{loiBanDau}</p>}
    {!state.ok && state.thongBao && <p className="notice error" role="alert">{state.thongBao}</p>}
    {state.ok && state.thongBao && <p className="notice success" role="status">{state.thongBao}</p>}

    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {thuTuCot(tuyChon).map((id, index) => {
        const cot = cotNhatKy.find(item => item.id === id)!
        const daAn = tuyChon.an.includes(cot.id)
        const rongHienTai = tuyChon.rong[cot.id] ?? cot.rong

        return <div key={cot.id} className={`card p-4 ${daAn ? "opacity-60" : ""}`}>
          <div className="mb-3 flex items-center gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              disabled={pending}
              checked={!daAn}
              onChange={() => toggleAn(cot.id)}
              className="size-4 shrink-0 accent-indigo-600"
            />
              <strong>{cot.ten}</strong>
            </label>
            <div aria-label={`Đổi vị trí cột ${cot.ten}`} className="flex gap-1">
              <button type="button" className="btn btn-secondary min-h-8 px-2 py-1" onClick={() => dichChuyenCot(cot.id, -1)} disabled={index === 0 || pending} aria-label={`Đưa cột ${cot.ten} sang trái`}>←</button>
              <button type="button" className="btn btn-secondary min-h-8 px-2 py-1" onClick={() => dichChuyenCot(cot.id, 1)} disabled={index === cotNhatKy.length - 1 || pending} aria-label={`Đưa cột ${cot.ten} sang phải`}>→</button>
            </div>
          </div>

          {!daAn && <div>
            <label className="mb-2 block text-xs text-slate-500">
              Độ rộng: {rongHienTai}px
            </label>
            <input
              aria-label={`Chiều rộng cột ${cot.ten}`}
              disabled={pending}
              type="range"
              min={rongMin}
              max={rongMax}
              value={rongHienTai}
              onChange={(e) => capNhatRong(cot.id, Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>{rongMin}px</span>
              <span>{rongMax}px</span>
            </div>
          </div>}
        </div>
      })}
    </div>

    <form action={action}>
      <input type="hidden" name="tuy_chon" value={JSON.stringify(tuyChon)} />
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={datLaiMacDinh} className="btn btn-secondary" disabled={pending}>
          Đặt lại mặc định
        </button>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'Đang lưu...' : 'Lưu tùy chọn'}
        </button>
      </div>
    </form>
  </div>
}
