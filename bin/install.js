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

把 weread-to-flomo Skill 安装到与工具无关的 skills 目录。

选项：
  --global              安装到 ~/.agents/skills/weread-to-flomo/（默认，所有支持 skill 的 agent 工具共用）
  --project             安装到当前目录的 ./.agents/skills/weread-to-flomo/
  --target=<绝对路径>   安装到指定绝对路径下的 weread-to-flomo/（用于 Claude Code、Codex、OpenCode 等的工具自有目录）
  --force               若目标已存在则覆盖
  -h, --help            显示本帮助并退出

不带选项时会进入交互式选择。
`;

function parseArgs(argv) {
  const opts = { scope: null, target: null, force: false, help: false };
  for (const a of argv) {
    if (a === '--global') opts.scope = 'global';
    else if (a === '--project') opts.scope = 'project';
    else if (a.startsWith('--target=')) {
      opts.scope = 'custom';
      opts.target = a.slice('--target='.length);
    }
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
        '请选择安装位置：\n  1) 全局（~/.agents/skills/，所有支持 skill 的 agent 工具共用，推荐）\n  2) 项目级（当前目录的 .agents/skills/）\n  3) 自定义路径（输入绝对路径）\n输入 1 / 2 / 3，回车确认：'
      )).trim();
      if (ans === '1') return { scope: 'global', target: null };
      if (ans === '2') return { scope: 'project', target: null };
      if (ans === '3') {
        const t = (await rl.question('请输入绝对路径（例如 ~/.claude/skills、~/.codex/skills 等）：')).trim();
        const expanded = expandTilde(t);
        if (!expanded || !path.isAbsolute(expanded)) {
          console.log('路径必须是绝对路径，请重试。');
          continue;
        }
        return { scope: 'custom', target: expanded };
      }
      console.log('请输入 1、2 或 3。');
    }
  } finally {
    rl.close();
  }
}

function expandTilde(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
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
   解压到你的 agent 工具的 skills 目录（例如 ~/.agents/skills/weread-skills/）
   然后设置环境变量：
     export WEREAD_API_KEY=wrk-你的apikey

2. 配置 flomo MCP 服务（按你使用的 agent 工具的 MCP 配置方式添加）
   把以下片段加到 MCP 配置中（Claude Code 是 ~/.claude.json，其他工具请按各自文档调整）：

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

3. 重启你的 agent CLI / IDE，然后用自然语言触发，例如：
   「把我在《XX》里的微信读书笔记导出到 flomo」
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

  let { scope, target } = opts;
  if (!scope) {
    ({ scope, target } = await promptScope());
  }

  const targetDir = resolveTarget({
    scope,
    home: os.homedir(),
    cwd: process.cwd(),
    target,
  });

  let result = await copyDir(SKILL_SOURCE, targetDir, { force: opts.force });

  if (result.existed && !opts.force) {
    const ok = await promptOverwrite(targetDir);
    if (!ok) {
      console.log('已取消，未做任何改动。');
      return;
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
