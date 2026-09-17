import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { loaiTepThat, phanMoRong } from '@/lib/tep/kiem-tra'
const GOC = process.env.UPLOAD_DIR ?? '/var/lib/tam-ung/tep'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const phien=await batBuocVaiTro('admin','nhap_lieu'), form=await request.formData(), tep=form.get('tep'), loai=String(form.get('loai'))
    if (!(tep instanceof File) || !['hoa_don','chuyen_khoan'].includes(loai)) return NextResponse.json({loi:'Dữ liệu tải lên không hợp lệ.'},{status:400})
    if (tep.size===0 || tep.size>10*1024*1024) return NextResponse.json({loi:'Tệp phải lớn hơn 0 và không quá 10 MB.'},{status:400})
    const mime=await loaiTepThat(tep), ext=mime&&phanMoRong(mime)
    if(!mime||!ext) return NextResponse.json({loi:'Loại tệp không được chấp nhận.'},{status:400})
    const gd=(await params).id, ten=`${randomUUID()}.${ext}`, tuongDoi=path.join(gd,ten), dich=path.resolve(GOC,tuongDoi), prefix=path.resolve(GOC)+path.sep
    if(!dich.startsWith(prefix)) return NextResponse.json({loi:'Đường dẫn không hợp lệ.'},{status:400})
    await mkdir(path.dirname(dich),{recursive:true}); await writeFile(dich,Buffer.from(await tep.arrayBuffer()),{flag:'wx'})
    await trongTransaction(phien.id,async client=>{const ok=await client.query('select 1 from giao_dich where id=$1 and not da_xoa',[gd]);if(!ok.rowCount) throw new Error('Giao dịch không tồn tại.'); await client.query('insert into tep_dinh_kem(giao_dich_id,loai,duong_dan,ten_goc,kich_thuoc,mime,nguoi_tai_len) values($1,$2,$3,$4,$5,$6,$7)',[gd,loai,tuongDoi,tep.name.slice(0,255),tep.size,mime,phien.id])})
    return NextResponse.json({ok:true})
  } catch(error) { return NextResponse.json({loi:error instanceof Error?error.message:'Không tải được tệp.'},{status:500}) }
}
