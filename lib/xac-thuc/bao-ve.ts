import { layPhien, type Phien } from './phien'
export class LoiKhongDuQuyen extends Error {}
export async function batBuocVaiTro(...vaiTro: Phien['vai_tro'][]) {
  const phien = await layPhien()
  if (!phien || !vaiTro.includes(phien.vai_tro)) throw new LoiKhongDuQuyen('Bạn không có quyền thực hiện thao tác này.')
  return phien
}
