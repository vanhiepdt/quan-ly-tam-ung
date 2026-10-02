const path = require('node:path');
const { Service } = require('node-windows');

const service = new Service({
  name: 'QuanLyTamUngInvoiceAgent',
  description: 'Theo dõi thư mục scan và gửi hóa đơn tới Quản lý tạm ứng.',
  script: path.join(__dirname, 'agent.cjs'),
  workingDirectory: path.resolve(__dirname, '..'),
  wait: 2,
  grow: 0.5,
  maxRestarts: 5,
  abortOnError: false,
});

service.on('install', () => {
  console.log('Đã cài Windows Service QuanLyTamUngInvoiceAgent.');
  service.start();
});
service.on('alreadyinstalled', () => console.log('Service đã tồn tại; dùng npm run uninstall-service trước nếu cần cài lại.'));
service.on('error', error => { console.error(error.message); process.exitCode = 1; });
service.install();
