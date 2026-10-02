const path = require('node:path');
const { Service } = require('node-windows');

const service = new Service({
  name: 'QuanLyTamUngInvoiceAgent',
  script: path.join(__dirname, 'agent.cjs'),
});
service.on('uninstall', () => console.log('Đã gỡ Windows Service QuanLyTamUngInvoiceAgent.'));
service.on('notinstalled', () => console.log('Service chưa được cài.'));
service.on('error', error => { console.error(error.message); process.exitCode = 1; });
service.uninstall();
