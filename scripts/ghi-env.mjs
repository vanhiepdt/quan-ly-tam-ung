// Ghi file .env.local cho moi truong chay that, dung boi CAI-DAT-POSTGRESQL.bat.
// Ly do co file nay: mat khau va duong dan ket noi co the chua ky tu dac biet cua
// cmd (& | < > ^ "), nen neu ghi bang "echo >>" trong file .bat thi file cau hinh se
// hong. Truyen qua bien moi truong cho node thi du lieu duoc giu nguyen tung ky tu.
//
//   node scripts/ghi-env.mjs tao       -> tao moi .env.local, khong ghi de neu da co
//   node scripts/ghi-env.mjs bo-sung   -> chi them ADMIN_USERNAME/ADMIN_PASSWORD con thieu
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const file = path.join(process.cwd(), '.env.local')
const lay = (ten) => (process.env[ten] ?? '').replace(/[\r\n]/g, '').trim()
const coDong = (noiDung, ten) => noiDung.split(/\r?\n/).some((dong) => dong.startsWith(`${ten}=`))

function docTaiKhoanAdmin() {
  const ten = lay('ADMIN_USERNAME')
  const matKhau = lay('ADMIN_PASSWORD')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}$/.test(ten))
    throw new Error('Ten dang nhap admin phai co 3-50 ky tu: chu khong dau, so, dau . _ -; bat dau bang chu hoac so.')
  if (matKhau.length < 8 || matKhau.length > 256)
    throw new Error('Mat khau admin phai co tu 8 den 256 ky tu.')
  return { ten, matKhau }
}

async function taoMoi() {
  const duongDan = lay('DBURL')
  if (!/^postgres(ql)?:\/\/\S+$/.test(duongDan))
    throw new Error('DATABASE_URL phai co dang postgresql://nguoi_dung:mat_khau@may:cong/ten_database')
  const { ten, matKhau } = docTaiKhoanAdmin()
  const email = lay('ADMINMAIL')
  const noiDung = [
    `DATABASE_URL=${duongDan}`,
    'UPLOAD_DIR=uploads',
    `ADMIN_USERNAME=${ten}`,
    `ADMIN_PASSWORD=${matKhau}`,
    `ADMIN_NAME=${lay('ADMINNAME') || 'Quản trị viên'}`,
    ...(email ? [`ADMIN_EMAIL=${email}`] : []),
  ].join('\n')
  // flag 'wx': khong bao gio ghi de file cau hinh dang dung cua nguoi dung.
  await writeFile(file, `${noiDung}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log('Da tao .env.local. File nay da duoc .gitignore va se khong bi ghi de ve sau.')
}

async function boSung() {
  const { ten, matKhau } = docTaiKhoanAdmin()
  let noiDung
  try { noiDung = await readFile(file, 'utf8') } catch { throw new Error('Chua co .env.local. Hay chay lai va chon tao moi.') }
  const thieu = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'].filter((khoa) => !coDong(noiDung, khoa))
  if (thieu.length === 0) { console.log('Khong can bo sung: .env.local da co du cau hinh admin.'); return }
  if (!noiDung.endsWith('\n')) noiDung += '\n'
  if (thieu.includes('ADMIN_USERNAME')) noiDung += `ADMIN_USERNAME=${ten}\n`
  if (thieu.includes('ADMIN_PASSWORD')) noiDung += `ADMIN_PASSWORD=${matKhau}\n`
  await writeFile(file, noiDung, { encoding: 'utf8' })
  console.log(`Da bo sung ${thieu.join(' va ')} vao .env.local, phan con lai giu nguyen.`)
}

async function onlyoffice() {
  const existing = await readFile(file, 'utf8')
  const defaults = {
    ONLYOFFICE_JWT_SECRET: randomBytes(48).toString('hex'),
    ONLYOFFICE_PUBLIC_URL: 'http://localhost:8081',
    ONLYOFFICE_INTERNAL_URL: 'http://localhost:8081',
    ONLYOFFICE_APP_URL: 'http://host.docker.internal:3000',
  }
  const missing = Object.keys(defaults).filter(key => !coDong(existing, key))
  if (!missing.length) { console.log('OnlyOffice da co cau hinh. Khong ghi de.'); return }
  const added = missing.map(key => `${key}=${defaults[key]}`).join('\n')
  await writeFile(file, `${existing.replace(/\s*$/, '')}\n${added}\n`, 'utf8')
  console.log('Da bo sung cau hinh OnlyOffice. Kiem tra cong ung dung trong ONLYOFFICE_APP_URL; khong in khoa bi mat.')
}

try {
  const cachDung = process.argv[2]
  if (cachDung === 'tao') await taoMoi()
  else if (cachDung === 'bo-sung') await boSung()
  else if (cachDung === 'onlyoffice') await onlyoffice()
  else throw new Error('Cach dung: node scripts/ghi-env.mjs tao|bo-sung|onlyoffice')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
