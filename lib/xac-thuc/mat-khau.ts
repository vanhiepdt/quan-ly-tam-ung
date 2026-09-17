import argon2 from 'argon2'

export async function bamMatKhau(matKhau: string) {
  return argon2.hash(matKhau, { type: argon2.argon2id })
}
export async function kiemTraMatKhau(matKhau: string, hash: string) {
  return argon2.verify(hash, matKhau)
}
