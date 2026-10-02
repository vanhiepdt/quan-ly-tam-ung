import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Tải hóa đơn PDF/ảnh ~10 MB; multipart còn thêm vài KB phần đầu.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  // Worker pdfjs không tải file://; font/cmap phải có trong ảnh Docker standalone.
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/pdfjs-dist/cmaps/**',
      './node_modules/pdfjs-dist/standard_fonts/**',
      './node_modules/pdfjs-dist/wasm/**',
      './Mau/**',
    ],
  },
}

export default nextConfig
