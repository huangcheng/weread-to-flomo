---
name: weread-to-flomo
description: 把微信读书的划线与想法导出到 flomo。当用户说「导出微信读书笔记」「同步划线到 flomo」「weread 笔记 → 浮墨」「全量导出」「把书架里的笔记搬到浮墨」「单条导出这条划线/想法」时调用；也支持先「浏览」笔记本（列书 → 看划线/想法）再决定要不要导出。依赖已安装的 weread-skills 与已配置的 flomo MCP。
version: 0.1.0
---

# weread-to-flomo — 微信读书 → flomo

把微信读书账号下的**划线**与**想法/点评**导出为 flomo 笔记。每条划线 / 每条想法独立成一条 memo，便于 flomo「每日回顾」抽取重温。重复执行只会追加新增内容，不会重复写入。同时支持读 only 的「浏览」模式：先列书、查看某本书的笔记内容，再决定是否导出。

## 调用条件

用户出现以下任一意图时调用本 Skill：

- 全量导出：「把所有书的笔记同步到 flomo」「全量导出 weread 笔记」「书架里有笔记的都导一份」
- 单本导出：「把《XX》的笔记导出到 flomo」「同步《YY》的划线和想法到浮墨」
- 单条导出：「把刚才那条划线 / 想法导出到 flomo」
- 浏览：「我有哪些书有笔记」「列一下有笔记的书」「先看看再决定导不导」「展开某本书的划线」

## 前置依赖

1. **weread-skills**：必须已安装在同一 Claude 实例。本 Skill 不直接访问微信读书 API，而是通过该 skill 文档中的统一入口 `POST https://i.weread.qq.com/api/agent/gateway` 调用。安装/配置失败时按下面「启动流程」给出对应中文提示，并指向 README 第 1 步。
2. **`WEREAD_API_KEY` 环境变量**：格式 `wrk-xxxx`。未设置或失效时按下面「启动流程」给出对应中文提示，并指向 README 第 1 步。
3. **flomo MCP**：在 Claude Code 配置中启用 `https://flomoapp.com/mcp`（streamable-http，Bearer Token）。本 Skill 调用 `memo_search`、`memo_create`、`get_format_guide`。配置缺失或鉴权失败时按「启动流程」提示，并指向 README 第 2 步。

## 能力一览

| 能力 | 说明 |
|------|------|
| 单本导出 | 用户给书名或 bookId，导出该书的所有划线 + 想法 |
| 全量导出 | 遍历 `/user/notebooks` 后逐本导出（必须用户显式确认，不静默跑） |
| 单条导出 | 用户指认具体一条划线 / 想法，单独写入一条 memo |
| 浏览（read-only） | 列出有笔记的书 → 选一本 → 按章节展示笔记内容；过程中不调 `memo_create` |
| 增量去重 | 写入前用 `memo_search` 探测稳定标记，已存在则跳过 |
| 格式适配 | 自动产出 flomo 支持的有限 Markdown（仅加粗、列表、内联标签、裸 URL） |
| 标签 | 三个固定标签：`#微信读书`、`#微信读书/划线` 或 `#微信读书/想法`、`#微信读书/{清洗后书名}` |

## 子文档索引

按用户意图先读相应子文档再执行：

| 子文档 | 何时读 |
|--------|--------|
| `workflow.md` | 任何导出或浏览请求 — 步骤、weread API 调用细节、批量行为 |
| `format.md` | 构造 memo 内容前 — 划线/想法 memo 模板、标签清洗规则、flomo 格式约束 |
| `dedup.md` | 写入 flomo 前 — 去重标记格式、`memo_search` 调用方式、批量优化 |

## 启动流程（每次调用必做）

按顺序探测两侧依赖；**遇到第一个失败立即停止并按对应中文提示告知用户，不要把多个错误并发抛出**。

1. **探测 weread-skills**
   - **未安装**：当前 Claude 实例的可用 skills 列表中找不到 `weread-skills`，或对 `/_list` 的探测请求出现网络/404 错误。提示：
     > 未检测到 `weread-skills` skill。请按 README 第 1 步下载并解压到 `~/.claude/skills/weread-skills/`，然后重启 Claude Code。下载：https://cdn.weread.qq.com/skills/weread-skills.zip
   - **未设置 token**：`WEREAD_API_KEY` 未设置，或试探请求（如 `/user/notebooks` `count=1`）返回 weread-skills 提示的 401。提示：
     > `WEREAD_API_KEY` 未设置。请到微信读书获取 apikey（格式 `wrk-xxxx`），然后在 shell 中执行 `export WEREAD_API_KEY=wrk-你的key`，再重启 Claude Code 让其生效
   - **token 无效**：试探请求返回鉴权失败 / `errcode != 0` 且文案与鉴权相关。提示：
     > `WEREAD_API_KEY` 似乎无效或已过期（接口返回鉴权失败）。请确认 key 仍在有效期内，或重新生成后更新环境变量

2. **探测 flomo MCP**（仅在 weread 全部通过后才进行）
   - **MCP 未配置**：当前 Claude 会话看不到 `memo_create` / `memo_search` / `get_format_guide` 任一工具。提示：
     > 未检测到 flomo MCP 服务。请按 README 第 2 步把 streamable-http 配置加到 `~/.claude.json` 的 `mcpServers.flomo`，到 https://flomoapp.com/ 生成 MCP Token 填入 Authorization 头，然后重启 Claude Code
   - **token 无效**：调 `get_format_guide`（无副作用，可探活）返回鉴权错误 / 401。提示：
     > flomo MCP 鉴权失败。请检查 `~/.claude.json` 里 `mcpServers.flomo.headers.Authorization` 的 Bearer Token 是否正确、是否过期。重新生成后重启 Claude Code
   - **健康**：`get_format_guide` 正常返回格式指南内容 → 进入下一步

只有两侧都通过才进入用户意图分流。

## 三种导出范围（用户意图路由）

| 范围 | 用户表达示例 | 行为 |
|------|--------------|------|
| 单条 | 「把这条划线导出到 flomo」「这条想法搬到 flomo」 | 用上下文里的 `bookmarkId` / `reviewId` 定位；找不到就让用户贴片段，再用 `/book/bookmarklist` 文本匹配。`memo_search` 去重 → 创建一条 memo |
| 单本 | 「把《XX》的笔记导出到 flomo」「同步《YY》的划线和想法到浮墨」 | 见 `workflow.md` 单本流程：识别书 → `/book/bookmarklist` + `/review/list/mine` → 去重 → 让用户确认 → 批量写入 |
| 全部 | 「把所有书的笔记都同步到 flomo」「全量导出」「把书架里有笔记的都导一份」 | 翻页拉 `/user/notebooks` 直到 `hasMore=0`，展示按本汇总（划线 / 想法 / 去重后待新增数）的表格，**必须用户显式确认**后再逐本处理；每完成一本立即汇报；从不静默跑 |

**意图模糊时（用户只说「导出笔记到 flomo」「同步到 flomo」而没指定范围）**：必须先按「能力一览」展示笔记本概览（按笔记数降序前 ~20 本），然后给出 3 选 1 提示：

> 你想：
> 1. 导出**某本书**的全部笔记 — 回复书名或序号
> 2. 导出**某一条**特定划线/想法 — 回复 "划线: 内容片段" 或 "想法: 内容片段"
> 3. **全部导出**（所有 N 本有笔记的书） — 回复 "全部"

**不要**自行选默认；让用户挑。单条和全部都有非零代价（单条 = 精确查找；全部 = 大量 MCP 调用），都需要确认。

## 浏览模式（read-only）

用户说「先看看笔记，再决定导不导」「我有哪些书有笔记」时进入浏览。详细规则见 `workflow.md`，要点：

1. **列书**：拉 `/user/notebooks` 翻页（用户说「前 N 本」就只取一页），按笔记数降序展示概览表格
2. **下钻**：用户按书名或序号选定后，并行调 `/book/bookmarklist` + `/review/list/mine`，**按章节分组**展示笔记内容（这里在对话中用 markdown `>` 引用块；这是聊天界面渲染，不是写入 flomo 的内容，flomo 不支持 `>`）
3. **下钻后选项**：展示完整内容后给用户菜单：「全部导出 / 只导划线 / 只导想法 / 单条（贴片段）/ 换一本 / 先不导」
4. **强约束**：浏览过程中绝不调用 `memo_create` 或 `memo_search`；只有用户在第 3 步明确选导出后才进入对应导出流程

## 核心规则

1. **每条独立**：1 条划线 = 1 条 memo；1 条想法 = 1 条 memo。不要把多条合并到一条 memo 里
2. **去重优先**：每次写入前必须按 `dedup.md` 调 `memo_search` 探测稳定标记；命中即跳过并记入「已跳过」清单
3. **格式守纪**：flomo 仅支持加粗、有序列表、无序列表、内联 `#标签`、裸 URL；**禁止**输出 `#` 标题、`>` 引用、` ``` ` 代码块、表格、图片语法、`[text](url)` 链接、HTML 标签。详见 `format.md`
4. **标签必带（schema 已锁定，不要增减）**：每条 memo 末尾段（在去重标记之前）必须有且仅有这三个同行标签：
   ```
   #微信读书 #微信读书/划线 #微信读书/{清洗后书名}
   ```
   想法 memo 把 `划线` 换成 `想法`。**不要**插入 `/书/` 这一级、不要加 `#作者/X` `#章节/X` `#在读` 等额外标签
5. **去重标记结尾**：每条 memo 的最后一行必须是 `[wr:hl:{bookmarkId}]`（划线）或 `[wr:tk:{reviewId}]`（想法）；不能省、不能改大小写、不能放正文中间
6. **不预写**：用户没说「确认/导出/OK」之前，不调 `memo_create`。先给清单（书名 + 待写入条数 + 已跳过条数）让用户确认
7. **浏览不写**：浏览模式中不调 `memo_create`；只有用户在下钻后选择导出才进入写入流程
8. **节流与重试**：连续 `memo_create` 之间不需要人为 sleep；遇到 MCP 错误做一次指数退避（等 2 秒）重试；仍失败计入 `failed[]` 继续下一条；连续 5 次全失败则停止整批并告知用户

## 不做的事

- **不导书签内容**：weread API 当前不返回书签具体内容，只返回数量
- **不导他人热门划线 / 公开点评**：`/book/bestbookmarks` `/review/list` 是公共内容，不属于个人笔记
- **不调 `memo_update`**：本版本只追加。weread 里改了划线，flomo 里那条不会跟着改
- **不主动删 flomo memo**：weread 里删了划线，flomo 里对应 memo 保留不动
- **不擅自变形**：不改划线/想法原文（除去首尾空白），不替用户编辑内容；不输出文案性的「总结」或 AI 解读

## 安装位置（与 agent 工具无关）

本 Skill 可通过 `npx skills add huangcheng/weread-to-flomo`（目前唯一可用方式）安装；默认位置 `~/.agents/skills/weread-to-flomo/` 与具体 agent 工具解耦。其他工具（Claude Code、Codex、OpenCode、Gemini CLI、Qoder 等）可通过自身配置或符号链接把 `~/.agents/skills/` 纳入加载路径；如果你想直接装到某工具的目录，请到仓库下载 zip 并手动解压（v0.1.0 发布到 npm 后会启用 `npx weread-to-flomo --target=<路径>` 的方式）。

Skill 文件本身遵循「YAML frontmatter + Markdown」约定，文件层面与工具无关；但调用方需要支持 weread-skills 与 flomo MCP（前置依赖一致）。
