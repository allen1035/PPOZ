// demo 结构与脚本验证（node demo/tests/check.js）
// 检查项：
// 1. HTML 关键元素/ID 齐全
// 2. 内联 <script> 可被解析（语法检查）
// 3. CSS 关键类存在
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
  "members-grid", "btn-mic", "btn-ptt", "btn-sound", "btn-leave",
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
  "$(\"btn-ptt\")",
  "$(\"btn-leave\").onclick",
  "$(\"btn-lock\").onclick",
  "$(\"btn-copy\").onclick",
  "$(\"btn-sound\").onclick"
];
for (const bind of requiredBinds) {
  check("事件绑定存在: " + bind, html.includes(bind));
}

if (failed > 0) {
  console.error("\n" + failed + " 项检查未通过");
  process.exit(1);
} else {
  console.log("\n全部检查通过");
}
