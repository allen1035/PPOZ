# PPOZ 零成本部署指南（异地语音）

本指南让你**不花一分钱**把 PPOZ 部署到公网，这样你和异地朋友（包括手机）就能真实通话。
音频始终是浏览器间 P2P 直连、不经服务器；这里只把「信令服务」和「前端页面」放到免费平台。

> 只差两步需要你本人操作：**注册免费账号** 和 **git push**（涉及你的账号与仓库凭证，我无法替你登录或推送）。其余配置我都已写好。

---

## 架构

```
手机/电脑浏览器 ──HTTPS──> GitHub Pages(前端) ──wss──> Render(信令) ──wss──> 朋友浏览器
                              │                              │
                         VITE_SIGNALING_URL           房间状态在内存
                         (构建时注入)                  (转发进/退/静音/踢人)
音频：两端浏览器经 STUN 直连，服务器不碰语音
```

---

## 第 0 步：准备（一次性）

1. 注册 GitHub 账号：https://github.com （免费）
2. 注册 Render 账号：https://render.com （免费，可用 GitHub 登录）
3. 把本项目推到你的 GitHub 仓库（仓库名随意，如 `ppoz`）。若还没建远程仓库：
   ```bash
   git remote add origin https://github.com/<你的用户名>/ppoz.git
   git push -u origin master
   ```

---

## 第 1 步：部署信令服务到 Render（免费）

1. 打开 https://dashboard.render.com → **New** → **Web Service**
2. 选择「**Build and deploy from a Git repository**」→ 连接你的 GitHub → 选 `ppoz` 仓库
3. 在「*Instance Type*」选 **Free**
4. 找到「*Render.yaml*」相关选项，**保持默认**（仓库里的 `render.yaml` 会自动被读取，含 `startCommand: npm start`、健康检查 `/`）
   - 若想手动填：*Build Command* = `npm install`，*Start Command* = `npm start`，*Health Check Path* = `/`
5. 点 **Create Web Service**
6. 等 1~2 分钟构建完成，记下它的地址，形如：
   ```
   https://ppoz-signaling.onrender.com
   ```
   （`.onrender.com` 自带 TLS，信令实际是 `wss://ppoz-signaling.onrender.com`）

> 免费版 15 分钟无连接会休眠，第一个人进房时约几秒冷启动，正常。

---

## 第 2 步：把信令地址填进前端构建变量

1. 打开你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **Variables** 标签页
2. 点 **New repository variable**
   - Name：`VITE_SIGNALING_URL`
   - Value：`wss://ppoz-signaling.onrender.com` （把第 1 步的地址 `https` 改成 `wss` 前缀）
3. 保存

---

## 第 3 步：开启 GitHub Pages 并触发部署

1. 仓库 → **Settings** → **Pages** → *Build and deployment* 的 **Source** 选 **GitHub Actions**
2. 回到仓库，确保已 push 最新代码（含本指南与 `deploy.yml`）：
   ```bash
   git add -A && git commit -m "add deploy config" && git push
   ```
3. 自动到 **Actions** 标签页看 `Deploy PPOZ frontend` 跑完（约 1 分钟），结束会给出一个 `*.github.io` 的网址，形如：
   ```
   https://<你的用户名>.github.io/ppoz/
   ```

---

## 第 4 步：异地实测

1. 你（电脑）：打开 `https://<用户名>.github.io/ppoz/` → 填昵称 → **创建房间**，记下 6 位口令
2. 朋友（手机/异地电脑）：打开同一个网址 → 填昵称 → 输口令 → **加入房间**
3. 双方授权麦克风，即可通话。音频走 P2P 直连。

> 若朋友连不上（极少，多见于手机 4G/5G 的对称型 NAT）：用 **ZeroTier / Tailscale 免费组网**让双方像在同一局域网即可绕过；这是唯一可能需要花钱（TURN）的边界，免费组网可避免。

---

## 本地同 WiFi 用手机测试（无需任何部署）

不想注册账号时，也可让手机连同一 WiFi 直接测：

```bash
npm run dev:mobile
```

脚本会生成自签 HTTPS 证书、起 https 前端 + 本地信令。手机浏览器访问
`https://<电脑局域网IP>:5173`（电脑 IP 见脚本输出，如 `https://192.168.1.101:5173`）。
首次打开手机会提示「不安全」，请点继续/信任（iOS 需在「设置 › 通用 › 关于本机 › 证书信任设置」开启完全信任）。
此后手机作为成员即可加入房间，验证麦克风、说话高亮、听到电脑端。

> 注意：本地模式只能同 WiFi 使用；真正的**跨网络**异地，必须走上面第 1~3 步的公网部署。

---

## 变量速查

| 变量 | 在哪设 | 作用 |
|------|--------|------|
| `VITE_SIGNALING_URL` | GitHub repo Variables | 前端构建时写入信令公网地址（如 `wss://ppoz-signaling.onrender.com`）|
| `PORT` | 由 Render 自动注入 | 信令服务监听端口（代码已读取 `process.env.PORT`）|
