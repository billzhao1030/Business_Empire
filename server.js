#!/usr/bin/env node
// Business Empire 启动器 —— 先做环境自检，再加载游戏服务
// Launcher: verifies the runtime, then boots the game server.
const [maj, min] = process.versions.node.split('.').map(Number);
const okVersion = maj > 22 || (maj === 22 && min >= 5);

function die(lines) {
  console.error('\n' + lines.join('\n') + '\n');
  process.exit(1);
}

if (!okVersion) {
  die([
    '  ❌  Node.js 版本过低 / Node.js is too old',
    `      当前 / current: v${process.versions.node}`,
    '      需要 / required: v22.5 或更高（推荐 v24 LTS 及以上 / v24 LTS or newer recommended）',
    '',
    '  Windows:  winget install OpenJS.NodeJS.LTS      或访问 https://nodejs.org 下载 LTS 安装包',
    '  macOS:    brew install node                     或访问 https://nodejs.org',
    '  Linux:    参见 https://nodejs.org/en/download/package-manager',
  ]);
}

let sqliteOk = true;
try { await import('node:sqlite'); } catch { sqliteOk = false; }

if (!sqliteOk) {
  if (maj === 22 || maj === 23) {
    die([
      '  ❌  当前 Node.js 需要额外开关才能使用内置数据库',
      '      This Node.js build needs a flag to enable the built-in SQLite module.',
      '',
      '  请改用以下命令启动 / Start with:',
      '      node --experimental-sqlite server.js',
      '',
      '  或升级到 Node v24 LTS 及以上（推荐）/ Or upgrade to Node v24 LTS or newer (recommended).',
    ]);
  }
  die([
    '  ❌  未找到内置模块 node:sqlite / Built-in module node:sqlite is unavailable',
    `      当前 / current: v${process.versions.node}`,
    '      请安装 Node.js v24 LTS 或更高版本 / Please install Node.js v24 LTS or newer: https://nodejs.org',
  ]);
}

await import('./src/main.js');
