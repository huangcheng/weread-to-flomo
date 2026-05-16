# weread-to-flomo

> **🧩 这是一个 Agent Skill 项目** — 不是普通 CLI 工具。它会被装到你的 agent 工具的 skill 目录里，由 Claude / Codex / OpenCode / Gemini CLI / Qoder 等 agent 在你自然语言对话中调用。技能本体见 [`skill/weread-to-flomo/`](./skill/weread-to-flomo/)。

把微信读书的**划线**与**想法/点评**导出为独立 flomo memo 的 Agent Skill。重复运行只追加新增内容、不会重复写。也支持先「浏览」笔记本再决定是否导出。

## 工作机制

- 通过已安装的 [weread-skills](https://cdn.weread.qq.com/skills/weread-skills.zip) 读取你的微信读书数据
- 通过 [flomo MCP](https://help.flomoapp.com/advance/mcp.html) 把每条划线/想法写为一条独立 flomo memo
- 每条 memo 末尾内嵌稳定标记 `[wr:hl:{bookmarkId}]` / `[wr:tk:{reviewId}]`，下次运行自动跳过已存在的条目

## 安装

> **🚧 npm 包还在内测验证中，暂未发布到 npm registry。** 现在请用「方式 A」走 GitHub 直接安装。「方式 B」`npx weread-to-flomo` 会在 v0.1.0 正式发布到 npm 后启用。

### 方式 A：通过 `npx skills`（推荐，目前唯一可用）

如果你已经在用 [`skills` CLI](https://www.npmjs.com/package/skills)，一行就装好：

```bash
npx skills huangcheng/weread-to-flomo
```

`skills` 会从本仓库直接拉取 skill 文件并放到 `~/.agents/skills/weread-to-flomo/`，所有支持 skill 的 agent 工具（Claude Code、Codex、OpenCode、Gemini CLI、Qoder 等）共用。

### 方式 B：通过 `npx weread-to-flomo`（**待 v0.1.0 发布后启用**）

> ⚠️ 该方式当前不可用 —— 包还没上 npm。下面写法是发布之后的目标使用方式，先记录在这里；运行会得到 npm 404。

如果你没有 `skills` CLI，可以用本包附带的安装器：

```bash
npx weread-to-flomo
```

会交互式询问安装位置，三选一：

- **全局（推荐）**：`~/.agents/skills/weread-to-flomo/` —— 与具体 agent 工具解耦的 skill 目录，所有支持 skill 加载的 agent 工具共用
- **项目级**：`<当前目录>/.agents/skills/weread-to-flomo/`，仅在本项目内可见
- **自定义路径**：直接指定绝对路径（用于把 skill 装到某个特定 agent 工具的目录里，例如 `~/.claude/skills/`）

非交互式：

```bash
npx weread-to-flomo --global              # 装到 ~/.agents/skills/
npx weread-to-flomo --project             # 装到 ./.agents/skills/
npx weread-to-flomo --target=~/.claude/skills    # 装到指定绝对路径下
npx weread-to-flomo --global --force      # 覆盖已存在的安装
npx weread-to-flomo --help                # 查看帮助
```

`--target=<路径>` 支持 `~` 展开。例：`--target=~/.codex/skills` 会展开为 `~/.codex/skills/weread-to-flomo/`。

### 不同 agent 工具的常见 skill 目录

如果你的 agent 工具不直接支持 `~/.agents/skills/`，用 `--target=<对应路径>` 就行。常见参考（请以各工具最新文档为准）：

| 工具 | 常见 skill/agent 目录 |
|------|-----------------------|
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` 或 `~/.codex/agents/` |
| OpenCode | `~/.config/opencode/skills/` |
| Gemini CLI | `~/.gemini/extensions/` |
| Qoder | `~/.qoder/skills/` |

## 前置配置

### 1. 安装 weread-skills

下载并解压到你的 agent 工具的 skills 目录（与本 skill 同一位置即可）：

```bash
curl -L https://cdn.weread.qq.com/skills/weread-skills.zip -o weread-skills.zip
mkdir -p ~/.agents/skills && unzip weread-skills.zip -d ~/.agents/skills/
```

然后让 weread-skills 能读到你的 apikey（环境变量 `WEREAD_API_KEY`）。下面按从「最安全」到「最简单」三档列出做法 —— 三大平台都给了。**任选一种**即可。

> apikey 申请方式见 weread-skills 自带的 SKILL.md。下面 `wrk-你的apikey` 是占位符。

#### 推荐：用密码管理器存，shell 启动时取

不在任何配置文件里留明文 token，shell 启动时从密码管理器即时取出。配置文件即使误传到 GitHub 也不泄露。

**1Password CLI（macOS / Linux / Windows 都可用）**

先把 token 存到 1Password 一个条目里（例如 vault 名 `Personal`、条目 `WeRead`、字段 `api-key`），然后：

```bash
# macOS / Linux：~/.zshrc 或 ~/.bashrc
export WEREAD_API_KEY="$(op read 'op://Personal/WeRead/api-key')"
```

```powershell
# Windows：$PROFILE
$env:WEREAD_API_KEY = (op read 'op://Personal/WeRead/api-key')
```

Bitwarden CLI 同理：`bw get password weread-api-key`（先 `bw unlock` 拿到 session）。

#### 折中：操作系统自带的密钥库

如果不想装第三方 CLI，可以用系统自带：

**macOS（Keychain）**

```bash
# 存（一次）
security add-generic-password -a "$USER" -s weread-api-key -w 'wrk-你的apikey'

# ~/.zshrc 里读
export WEREAD_API_KEY="$(security find-generic-password -a "$USER" -s weread-api-key -w)"
```

**Linux（libsecret，需要 GNOME Keyring / KWallet / 其他兼容 backend）**

```bash
# 存（一次，会弹出 GUI 提示输入 token）
secret-tool store --label='WeRead API key' service weread-api-key

# ~/.bashrc 或 ~/.zshrc
export WEREAD_API_KEY="$(secret-tool lookup service weread-api-key)"
```

无图形会话的 Linux（服务器、WSL 等）请直接用 1Password/Bitwarden CLI 或 `pass`。

**Windows（Credential Manager + PowerShell `CredentialManager` 模块）**

```powershell
# 装一次
Install-Module CredentialManager -Scope CurrentUser

# 存（一次；密码框里粘贴 wrk-xxxx，用户名随便填）
$cred = Get-Credential -UserName 'weread' -Message '粘贴 WeRead apikey'
New-StoredCredential -Target 'weread-api-key' -Credentials $cred -Persist LocalMachine

# $PROFILE 里读
$env:WEREAD_API_KEY = (Get-StoredCredential -Target 'weread-api-key').GetNetworkCredential().Password
```

#### 最简单（也最不安全）：直接写在 shell 配置里

只建议本机自用、且 shell 配置**绝不**进版本控制时使用。

**macOS / Linux** — 加到 `~/.zshrc` / `~/.bashrc`：

```bash
export WEREAD_API_KEY='wrk-你的apikey'
```

**Windows PowerShell** — 临时（当前会话）：

```powershell
$env:WEREAD_API_KEY = 'wrk-你的apikey'
```

或者持久（写入用户级环境变量，**会以明文存在注册表里**）：

```powershell
[Environment]::SetEnvironmentVariable('WEREAD_API_KEY', 'wrk-你的apikey', 'User')
```

#### 验证

任意 shell 重启后，执行：

```bash
# macOS / Linux
echo $WEREAD_API_KEY | head -c 4    # 应该输出 wrk-
```

```powershell
# Windows
$env:WEREAD_API_KEY.Substring(0, 4)  # 应该输出 wrk-
```

输出 `wrk-` 说明已经拿到。然后重启你的 agent CLI / IDE 让它继承这个变量。

> 关于 flomo MCP token：它由你的 agent 工具持久化（Claude Code 是 `~/.claude.json`，其他工具按自身约定），首次配置后 agent 会记住，不需要你每次重设。本 skill 不接触 flomo token —— 它直接由 MCP 服务端验证。

### 2. 配置 flomo MCP

把以下片段加到你 agent 工具的 MCP 配置里（Claude Code 是 `~/.claude.json`，其他工具按各自文档调整路径与字段名）：

```json
{
  "mcpServers": {
    "flomo": {
      "type": "streamable-http",
      "url": "https://flomoapp.com/mcp",
      "headers": {
        "Authorization": "Bearer <你的 flomo MCP Token>"
      }
    }
  }
}
```

Token 到 [flomo 设置页](https://flomoapp.com/) 生成。**Token 等同账号的读写权限，不要分享给任何人、不要提交到 git。** 怀疑泄露请立刻到 flomo 设置页重新生成。

### 3. 重启你的 agent CLI / IDE

让 MCP 服务被加载、新的 skill 被发现。

## 使用

随便说一句即可触发：

- 「列一下我有笔记的书」
- 「把《XX》里的微信读书笔记导出到 flomo」
- 「同步 weread 笔记到浮墨」
- 「全量导出，所有书的笔记都导」
- 「先看看《YY》的划线，再决定要不要导」

Skill 行为：

1. **启动探测**：先确认 weread-skills + WEREAD_API_KEY 可用，再确认 flomo MCP 可用；任一失败给出针对性提示
2. **意图路由**：单条 / 单本 / 全部 / 浏览四种范围；意图模糊时先列书让你选
3. **预览清单**：把待导出条数、跳过条数、即将打的标签都展示给你
4. **等你确认**：回「确认 / 导出 / OK」之后才写
5. **逐条写入**：每条划线/想法独立一条 memo
6. **结果汇报**：新增 / 跳过 / 失败的明细

浏览模式（`列一下…`）只读，过程中不会写入 flomo。

## flomo 里的样子

每条划线/想法是独立 memo，标签结构：

- `#微信读书`
- `#微信读书/划线` 或 `#微信读书/想法`
- `#微信读书/{书名}`

可用 flomo 的「每日回顾」按 `#微信读书` 标签做随机回顾。

## 已知限制

- **不导书签内容**：weread 当前 API 只返回书签数量，不返回书签具体内容
- **不更新已导出 memo**：weread 里改了划线，flomo 不会跟着改；本版本只追加新条目
- **不主动删除**：weread 里删了划线，flomo 里那条 memo 不会被本 Skill 删
- **不导他人内容**：只导出你自己的私人笔记，不导热门划线 / 公开点评
- **不输出 AI 解读**：原文按字写入，不替你做总结/改写

## 隐私与安全

- `WEREAD_API_KEY` 与 flomo MCP Token 都不会被写到任何 skill 文件里。请确保你的 shell 配置（`.bashrc` / `.zshrc` / PowerShell profile）和 MCP 配置文件本身不被纳入版本控制
- 安装包附带的 `.gitignore` 默认会忽略 `.env` `.env.*` `*.local`

## 卸载

```bash
rm -rf ~/.agents/skills/weread-to-flomo/
# 或删掉你 --target= 指定过的对应目录
```

并把 flomo MCP 配置中的 `flomo` 节点删除（如果不再使用 flomo MCP）。

## 开发

```bash
git clone https://github.com/huangcheng/weread-to-flomo.git
cd weread-to-flomo
npm test            # 跑 lib/ 的单元测试
node bin/install.js --help
```

skill 内容（Markdown）：`skill/weread-to-flomo/`
- `SKILL.md` — 入口，调用条件 + 启动流程 + 核心规则
- `workflow.md` — 浏览 / 单条 / 单本 / 全部 四类操作的步骤
- `format.md` — memo 模板与标签清洗规则
- `dedup.md` — 去重标记格式与 `memo_search` 调用方式

## 许可

MIT
