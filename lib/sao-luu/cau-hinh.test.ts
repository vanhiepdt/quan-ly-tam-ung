import { describe, expect, it } from 'vitest'
import { cauHinhSaoLuuTuRow, lanChaySaoLuuTuRow, tachNgayGio } from './cau-hinh'

describe('cấu hình sao lưu', () => {
  it('đổi mốc UTC sang giờ Việt Nam để chạy đúng 17:00', () => {
    expect(tachNgayGio(new Date('2026-10-10T10:00:00.000Z'))).toEqual({ ngay: '2026-10-10', gio: '17:00' })
    expect(tachNgayGio(new Date('2026-10-10T16:59:00.000Z'))).toEqual({ ngay: '2026-10-10', gio: '23:59' })
  })

  it('chuẩn hóa cấu hình giờ và mặc định tắt khi chưa có dòng cấu hình', () => {
    expect(cauHinhSaoLuuTuRow()).toEqual({ batTuDong: false, gioChay: '17:00' })
    expect(cauHinhSaoLuuTuRow({ bat_tu_dong: true, gio_chay: '05:30' })).toEqual({ batTuDong: true, gioChay: '05:30' })
    expect(cauHinhSaoLuuTuRow({ bat_tu_dong: true, gio_chay: '25:00' })).toEqual({ batTuDong: true, gioChay: '17:00' })
  })

  it('đổi hàng đợi sao lưu sang dữ liệu an toàn cho giao diện', () => {
    expect(lanChaySaoLuuTuRow({
      id: 'run-1', loai: 'thu_cong', trang_thai: 'thanh_cong', ngay_lich: null,
      tao_luc: '2026-10-10T10:00:00.000Z', bat_dau_luc: new Date('2026-10-10T10:01:00.000Z'),
      ket_thuc_luc: null, drive_file_id: 'drive-1', loi: null,
    })).toMatchObject({
      id: 'run-1', loai: 'thu_cong', trangThai: 'thanh_cong', ngayLich: null,
      taoLuc: '2026-10-10T10:00:00.000Z', batDauLuc: '2026-10-10T10:01:00.000Z',
      driveFileId: 'drive-1', ketThucLuc: null,
    })
  })
})
