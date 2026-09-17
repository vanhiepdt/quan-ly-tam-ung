import type { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'Quản lý tạm ứng & hóa đơn',
  description: 'Theo dõi tạm ứng, tiếp khách và hoàn ứng hóa đơn',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>
}
