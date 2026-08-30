/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(__dirname, 'certs', 'key.pem');
const certPath = path.resolve(__dirname, 'certs', 'cert.pem');

// 存在本地自签证书时启用 https（手机同 WiFi 访问需安全上下文才能用麦克风）
const https = existsSync(keyPath) && existsSync(certPath)
  ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // 同源 /ws 代理：前端（https）通过 wss://<host>/ws 连接，开发期由 vite 转发到本地信令，
    // 避免 https 页面连 ws:// 被混合内容策略拦截。生产环境用 VITE_SIGNALING_URL 直连公网信令。
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
    ...(https ? { https } : {}),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
