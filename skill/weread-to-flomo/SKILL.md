---
name: weread-to-flomo
description: 把微信读书的划线与想法导出到 flomo。当用户说「导出微信读书笔记」「同步划线到 flomo」「weread 笔记 → 浮墨」「全量导出」「把书架里的笔记搬到浮墨」「单条导出这条划线/想法」「把第 X 章导出到 flomo」「这一章的笔记搬到浮墨」「chapter export」时调用；也支持先「浏览」笔记本（列书 → 看划线/想法）再决定要不要导出。依赖已安装的 weread-skills 与已配置的 flomo MCP。
version: 0.1.1
---

# weread-to-flomo — 微信读书 → flomo

把微信读书账号下的**划线**与**想法/点评**导出为 flomo 笔记。每条划线 / 每条想法独立成一条 memo，便于 flomo「每日回顾」抽取重温。重复执行只会追加新增内容，不会重复写入。同时支持读 only 的「浏览」模式：先列书、查看某本书的笔记内容，再决定是否导出。

## 调用条件

用户出现以下任一意图时调用本 Skill：

- 全量导出：「把所有书的笔记同步到 flomo」「全量导出 weread 笔记」「书架里有笔记的都导一份」
- 单本导出：「把《XX》的笔记导出到 flomo」「同步《YY》的划线和想法到浮墨」
- 章节导出：「把《XX》第 N 章导出到 flomo」「这一章的笔记搬到浮墨」「chapter export」
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

## 四种导出范围（用户意图路由）

| 范围 | 用户表达示例 | 行为 |
|------|--------------|------|
| 单条 | 「把这条划线导出到 flomo」「这条想法搬到 flomo」 | 用上下文里的 `bookmarkId` / `reviewId` 定位；找不到就让用户贴片段，再用 `/book/bookmarklist` 文本匹配。`memo_search` 去重 → 创建一条 memo |
| 章节 | 「把《XX》第 N 章导出到 flomo」「这一章的笔记搬到浮墨」 | 见 `workflow.md` §3.5：识别书 → 取该书 bookmarklist + reviews → 按 `chapterUid` 过滤 → 去重 → 让用户确认（或小批量 fast-path）→ 批量写入 |
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

## 写错时的修正流程

flomo MCP **不暴露删除接口**，所以一旦 `memo_create` 写入了内容有偏差的 memo（视觉相近字符替换、章节标题错、标签写错、误把段内换行变成两段等），agent **不能**自行清理。修正路径如下：

1. **立刻告诉用户问题**：写完后第一时间在对话里指出偏差，不要等用户察觉。包含：
   - memo 的 `id`（来自 `memo_create` 返回值，如 `MjM3MDQ3MDU5`）
   - 偏差是什么（例：「弯引号 `“”` 被写成 ASCII `"`」）
   - 根因（例：「上一次构造 content 时从对话预览回打，违反 format.md §8.1」）
2. **请用户手动删**：MCP 没有 delete RPC，只能让用户去 https://flomoapp.com/mine 用搜索 `wr:hl:<bookmarkId>` 或 `wr:tk:<reviewId>` 定位后删除。同时附上去重标记字符串（如 `wr:hl:41598972_7_1931-2138`）方便复制
3. **等用户回复「删了」/「OK」/「ok 了」**再进入下一步；不要假定用户动作完成
4. **重新写入**：按 `format.md` §8.1 的硬约束重做（**必经路径**：渲染到临时文件 → `Read` 工具读出字面字节 → `memo_create`），不要再从对话预览回打。重写前可以再调一次 `memo_search` 确认无残留（可选）
5. **汇报新 id**：写入后告诉用户新 memo 的 id，方便用户校核

**禁止**：
- 用「这个等会儿一起改」的语气把修正延后，让用户记账
- 在用户没确认删除前就 `memo_create` 写新版（会双写）
- 把多条偏差合并到一次回复里——每条都要单独的 id + 删除指引，否则用户搜不到

预防胜于修正：写入前严格执行 `format.md` §8 自检清单（特别是 §8.1 内容保真硬约束），可以避免 90% 的偏差。**写入后**立即按 `format.md` §8.1.2 跑 byte-exact audit（`memo_batch_get` + 脚本对比关键码位），可以在偏差扩散到下一条之前抓住它。**两层缺一不可**——预防失败时 audit 是最后一道闸。

## 安装位置（与 agent 工具无关）

本 Skill 可通过 `npx skills add huangcheng/weread-to-flomo`（目前唯一可用方式）安装；默认位置 `~/.agents/skills/weread-to-flomo/` 与具体 agent 工具解耦。其他工具（Claude Code、Codex、OpenCode、Gemini CLI、Qoder 等）可通过自身配置或符号链接把 `~/.agents/skills/` 纳入加载路径；如果你想直接装到某工具的目录，请到仓库下载 zip 并手动解压（v0.1.0 发布到 npm 后会启用 `npx weread-to-flomo --target=<路径>` 的方式）。

Skill 文件本身遵循「YAML frontmatter + Markdown」约定，文件层面与工具无关；但调用方需要支持 weread-skills 与 flomo MCP（前置依赖一致）。

## 与 weread-skills 的协作（上下文复用）

如果用户已经在用 `weread-skills` 浏览过书，对话上下文里通常已经有 `bookId`、`bookmarklist.updated[]`、`reviews[]`、`chapters[]` 等数据。本 skill 在以下场景应**复用上下文**而非重新拉接口：

- 用户刚展示过《XX》的笔记（同一会话内）→ 直接用上下文里的 `bookmarklist`，不要重新调 `/book/bookmarklist`
- 用户刚通过 weread-skills 看过书架 → 跳过 `workflow.md` §2.1 的 `/user/notebooks` 调用
- 上下文里已有 `chapters[]` → 章节导出（§3.5）的章节定位直接走本地匹配

复用判断：
- 上下文中是否存在该 `bookId` 的 `updated[]` 数组？
- 是同一 session、未跨大 turn（>30 次工具调用 / 长时间停顿）？
- 数据完整（不是中途截断的部分结果）？

不确定时宁可重新拉，不要拿过期数据。无论是否复用，**启动流程探活仍必做**（见上方「启动流程」）—— flomo MCP 的可用性不能靠上下文推断。
