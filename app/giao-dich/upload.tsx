'use client'
import { useState } from 'react'
export function TaiTep({ giaoDichId }: { giaoDichId:string }) {
  const [message,setMessage]=useState('')
  return <form onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);const r=await fetch(`/api/giao-dich/${giaoDichId}/tep`,{method:'POST',body:data});setMessage(r.ok?'Đã tải tệp lên.':(await r.json()).loi??'Tải tệp thất bại.')}}><input name="tep" type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,.webp" required/><select name="loai"><option value="hoa_don">Hóa đơn</option><option value="chuyen_khoan">Ảnh chuyển khoản</option></select><button>Tải lên</button>{message&&<span>{message}</span>}</form>
}
