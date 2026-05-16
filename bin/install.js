#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolveTarget } from '../lib/resolve-target.js';
import { copyDir } from '../lib/copy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SKILL_SOURCE = path.join(PACKAGE_ROOT, 'skill', 'weread-to-flomo');

const USAGE = `用法：npx weread-to-flomo [选项]

把 weread-to-flomo Skill 安装到 Claude 的 Skills 目录。

选项：
  --user         安装到用户级目录 ~/.claude/skills/weread-to-flomo/
  --project      安装到当前项目 ./.claude/skills/weread-to-flomo/
  --force        若目标已存在则覆盖
  -h, --help     显示本帮助并退出

不带选项时会进入交互式选择。
`;

function parseArgs(argv) {
  const opts = { scope: null, force: false, help: false };
  for (const a of argv) {
    if (a === '--user') opts.scope = 'user';
    else if (a === '--project') opts.scope = 'project';
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`未识别的参数：${a}`);
  }
  return opts;
}

async function promptScope() {
  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const ans = (await rl.question(
        '请选择安装位置：\n  1) 用户级（~/.claude/skills/，所有项目可用，推荐）\n  2) 项目级（当前目录的 .claude/skills/）\n输入 1 或 2，回车确认：'
      )).trim();
      if (ans === '1') return 'user';
      if (ans === '2') return 'project';
      console.log('请输入 1 或 2。');
    }
  } finally {
    rl.close();
  }
}

async function promptOverwrite(targetDir) {
  const rl = readline.createInterface({ input, output });
  try {
    const ans = (await rl.question(
      `目标目录已存在：${targetDir}\n是否覆盖？(y/N) `
    )).trim().toLowerCase();
    return ans === 'y' || ans === 'yes';
  } finally {
    rl.close();
  }
}

function printNextSteps(targetDir) {
  console.log(`
✓ Skill 已安装到：${targetDir}

接下来你还需要：

1. 安装并配置 weread-skills（用于读取微信读书数据）
   下载：https://cdn.weread.qq.com/skills/weread-skills.zip
   解压到 ~/.claude/skills/weread-skills/
   然后设置环境变量：
     export WEREAD_API_KEY=wrk-你的apikey

2. 配置 flomo MCP 服务
   把以下片段加到 Claude Code 的 MCP 配置（settings.json 或 ~/.claude.json）：

     "mcpServers": {
       "flomo": {
         "type": "streamable-http",
         "url": "https://flomoapp.com/mcp",
         "headers": {
           "Authorization": "Bearer <你的 flomo MCP Token>"
         }
       }
     }

   到 flomo 设置页生成 MCP Token：https://flomoapp.com/

3. 重启 Claude Code，然后用自然语言触发，例如：
   「把我在《三体》里的微信读书笔记导出到 flomo」
`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    process.exit(1);
  }

  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const scope = opts.scope ?? (await promptScope());
  const targetDir = resolveTarget({ scope, home: os.homedir(), cwd: process.cwd() });

  let result = await copyDir(SKILL_SOURCE, targetDir, { force: opts.force });

  if (result.existed && !opts.force) {
    const ok = await promptOverwrite(targetDir);
    if (!ok) {
      console.log('已取消，未做任何改动。');
      process.exit(0);
    }
    result = await copyDir(SKILL_SOURCE, targetDir, { force: true });
  }

  console.log(`已复制 ${result.copied} 个文件。`);
  printNextSteps(targetDir);
}

main().catch((err) => {
  console.error('安装失败：', err.message);
  process.exit(2);
});
