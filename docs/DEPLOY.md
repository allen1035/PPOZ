# PPOZ 部署与异地验证指南

目标：**不花一分钱**，让电脑（房主）和手机（成员，任意网络）实现真·异地语音开黑。
音频走 WebRTC P2P 直连、不经服务器；本指南只解决两件部署必须的事——**信令公网可达** + **前端 HTTPS**（手机浏览器要求安全上下文才能用麦克风）。

---

## 架构回顾

| 部分 | 跑在哪 | 是否要部署 |
|------|--------|-----------|
| 音频媒体 | 朋友浏览器之间 P2P 直连 | 否（不经服务器） |
| 信令 | `server/signaling.ts` | **是，需公网可达** |
| 前端 | `dist/` 静态文件 | **是，需 HTTPS** |
| NAT 穿透 | 公共免费 STUN（Google） | 否（已内置） |

---

## 一、部署信令服务（Render 免费档，拿到 `wss://` 地址）

1. 注册 [render.com](https://render.com)（免费）。
2. 控制台 **New > Blueprint**，连接你的 GitHub 仓库，Render 会自动读取根目录的 `render.yaml` 并创建名为 `ppoz-signaling` 的 Web Service。
   - 不想用 Blueprint 也可：**New > Web Service**，Root Directory 留空，Branch 选 `main`，
     Build Command 填 `npm install`，Start Command 填 `npm start`，Plan 选 **Free**。
   - 不要手动设 `PORT`，Render 会自动注入。
3. 部署完成后在 Service 页拿到地址，形如 `https://ppoz-signaling.onrender.com`。
   - 对应的 **WebSocket 地址就是把 `https` 换成 `wss`**：`wss://ppoz-signaling.onrender.com`

> 备选信令平台：Railway / Fly.io 免费档，同样可行，启动命令都是 `npm start`。

---

## 二、部署前端（Vercel 免费档，自带 HTTPS）

1. 注册 [vercel.com](https://vercel.com)，**New Project** 导入本仓库。
   - Framework 会自动识别为 Vite，Build Command `npm run build`，Output Directory `dist`（根目录 `vercel.json` 已写死，更稳）。
2. **先设环境变量再部署**（它会在构建时编进前端）：
   - 进入 Project **Settings > Environment Variables**，添加：
     - `VITE_SIGNALING_URL` = `wss://ppoz-signaling.onrender.com`（第一步拿到的你自己的信令地址）
3. 点 **Deploy**。完成后拿到前端地址，形如 `https://ppoz.vercel.app`。

> 前端必须是 `https`、且信令必须填 `wss://`（混合内容会被浏览器拦截）。
> 备选前端平台：Cloudflare Pages / Netlify / GitHub Pages，全部免费 + HTTPS，构建命令 `npm run build`、产物 `dist`，同样设置 `VITE_SIGNALING_URL`。

---

## 三、手机异地验证（电脑建房 + 手机加入）

1. **电脑**浏览器打开前端地址 → 填昵称 → **创建房间** → 记下 6 位口令。
2. **手机**（任意网络：4G / 5G / WiFi 都行）浏览器打开同一前端地址。
3. 手机填昵称 → 输入 6 位口令 → **加入房间** → 授权麦克风。
4. 预期：两端都能看到对方成员磁贴、说话时绿框高亮；电脑能听到手机、手机能听到电脑。
5. 顺手验证控制：
   - 房主**锁房**后，手机再输正确口令应提示「该房间已上锁」；
   - 房主**踢人**，手机端应提示「你已被房主移出房间」并退回大厅。

---

## 四、故障排查

- **手机加入后一直转圈 / 连不上**：多半是 NAT 穿透失败（运营商对称型 NAT / CGNAT，尤其部分移动 4G/5G）。
  - 解决：手机和电脑都装 **ZeroTier** 或 **Tailscale**（均免费），加入同一网络，让双方像在同一局域网，即可绕过。
  - 或换电脑的有线网络 / 换不同运营商的手机热点重试。
- **提示混合内容错误**：确认 `VITE_SIGNALING_URL` 用的是 `wss://` 而非 `ws://`。
- **进房后听不到对方**：双方都需点「允许麦克风」；检查是否有一方被静音（`state` 已广播给对方）。
- **Render 免费实例首连慢**：免费档 15 分钟无流量会休眠，首次连接可能等 ~30s，属正常。

---

## 本地开发（不部署，仅同机/同局域网测）

```bash
npm install
npm run dev          # vite(5173) + 信令(8787) 同时启动
```
浏览器开 `http://localhost:5173`（同机多标签），或同 WiFi 下手机访问 `http://<电脑局域网IP>:5173`（注意：手机用 http 拿不到麦克风，仅用于验证界面/信令，真实语音需走上面 HTTPS 部署方案）。
