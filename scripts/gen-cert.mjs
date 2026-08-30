// 生成本地自签 HTTPS 证书，供手机在同一 WiFi 下访问开发服务器（手机浏览器
// 仅允许在安全上下文 https 下使用麦克风）。证书包含 localhost 与当前局域网 IPv4，
// 手机用 https://<电脑IP>:5173 即可加入房间。证书仅本地使用，不提交仓库。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, '..', 'certs');
if (!existsSync(certDir)) mkdirSync(certDir, { recursive: true });

const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

// 收集本机 IPv4（排除回环与链路本地）
const ips = [];
for (const list of Object.values(os.networkInterfaces())) {
  for (const ni of list ?? []) {
    if (ni.family === 'IPv4' && !ni.internal && !ni.address.startsWith('169.254.')) {
      ips.push(ni.address);
    }
  }
}
const sanEntries = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)];
const san = sanEntries.join(',');

// 用数组传参（spawnSync），避免 -subj 中的空格被 shell 误拆
const args = [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', keyPath, '-out', certPath, '-days', '365',
  '-subj', '/CN=PPOZ Local Dev',
  '-addext', `subjectAltName=${san}`,
];

try {
  const r = spawnSync('openssl', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`openssl exited with code ${r.status}`);
  console.log(`\n[ppoz] 证书已生成 -> ${certDir}`);
  console.log('[ppoz] 手机请访问以下 https 地址（任选其一）：');
  for (const ip of ips) console.log(`        https://${ip}:5173`);
  console.log('[ppoz] 首次打开手机会提示「不安全」，请选择继续/信任（iOS 需在「设置>通用>关于本机>证书信任设置」开启完全信任）。');
} catch (e) {
  console.error('[ppoz] 生成证书失败：', e.message);
  process.exit(1);
}
