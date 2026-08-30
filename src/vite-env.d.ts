/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公网信令服务地址，例如 wss://ppoz-signaling.onrender.com ；本地开发留空即可 */
  readonly VITE_SIGNALING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
