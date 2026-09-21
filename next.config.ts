import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Tải hóa đơn PDF/ảnh ~10 MB; multipart còn thêm vài KB phần đầu.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
}

export default nextConfig
