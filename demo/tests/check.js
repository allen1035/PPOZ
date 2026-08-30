// demo 结构与脚本验证（node demo/tests/check.js）
// 检查项：
// 1. HTML 关键元素/ID 齐全
// 2. 内联 <script> 可被解析（语法检查）
// 3. CSS 关键类存在
// 4. 核心交互绑定存在
// 5. 本轮改动约束：无 PTT 按钮、口令 6 位校验、踢人仅房主、说话状态局部更新
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log("PASS  " + name);
  } else {
    console.error("FAIL  " + name);
    failed++;
  }
}

// 1. 关键元素
const requiredIds = [
  "screen-lobby", "screen-room", "nickname-input", "btn-create",
  "code-input", "btn-join", "room-code", "btn-copy", "btn-lock",
  "members-grid", "btn-mic", "btn-sound", "btn-leave",
  "toast-container", "ping-value"
];
for (const id of requiredIds) {
  check('元素存在 id="' + id + '"', html.includes('id="' + id + '"'));
}

// 2. CSS 关键类
for (const cls of ["member-tile", "speaking", "ctrl-btn", "lobby-card", "toast"]) {
  check("CSS 类存在 ." + cls, html.includes("." + cls));
}

// 3. 内联脚本语法检查
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
check("包含内联 <script>", !!scriptMatch);
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]); // 仅解析，不执行
    console.log("PASS  内联脚本语法解析通过");
  } catch (e) {
    console.error("FAIL  内联脚本语法错误: " + e.message);
    failed++;
  }
}

// 4. 核心交互绑定
const requiredBinds = [
  "$(\"btn-create\").onclick",
  "$(\"btn-join\").onclick",
  "$(\"btn-mic\").onclick",
  "$(\"btn-leave\").onclick",
  "$(\"btn-lock\").onclick",
  "$(\"btn-copy\").onclick",
  "$(\"btn-sound\").onclick"
];
for (const bind of requiredBinds) {
  check("事件绑定存在: " + bind, html.includes(bind));
}

// 5. 本轮改动约束
check("PTT 按钮已移除", !html.includes("btn-ptt") && !html.includes("按住说话"));
check("副标题文案已移除", !html.includes("朋友开黑 · 点链接就开麦"));
check("口令输入框限制 6 位", html.includes('id="code-input" maxlength="6"'));
check("口令 6 位字母数字校验存在", html.includes("^[A-Z0-9]{6}$"));
check("口令输入有误提示存在", html.includes("口令输入有误"));
check("口令生成去除 PPOZ- 前缀", !html.includes("PPOZ-"));
check("踢人仅房主可见（selfHost 门控）", html.includes("if (state.selfHost)"));
check("踢人操作有房主权限保护", html.includes("if (!state.selfHost) return;"));
check("说话状态局部更新（updateTile）", html.includes("function updateTile(m)"));
check("口令字符集已定义", html.includes('CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"'));
check("口令长度为 6", html.includes("i < 6"));

if (failed > 0) {
  console.error("\n" + failed + " 项检查未通过");
  process.exit(1);
} else {
  console.log("\n全部检查通过");
}
