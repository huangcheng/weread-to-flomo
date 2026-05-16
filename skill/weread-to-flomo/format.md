# Memo 格式规范

写入 flomo 前的所有内容都按本文档的模板与清洗规则。任何与本文档冲突的写法都以本文档为准。

---

## 1. flomo 支持的 Markdown（硬约束）

flomo 仅渲染：

- **加粗**：`**文字**`
- **有序列表**：`1. 项目`，多级嵌套缩进 2 个空格
- **无序列表**：`- 项目`，多级嵌套缩进 2 个空格
- **内联标签**：`#标签` 或 `#父标签/子标签`，遇到空格即结束
- **裸 URL**：自动识别为可点击链接

段落之间用空行分隔。

**禁止**（以下语法在 flomo 不会渲染，必须先转换或删除）：

- `#` 标题（`# 标题` / `## 标题` 都不渲染）
- `>` 引用块
- 单反引号 `` ` `` 与三反引号 ` ``` ` 代码块
- 表格 `| ... | ... |`
- 图片 `![alt](url)`
- 链接 `[文字](url)` —— 裸 URL 可以
- HTML 标签

如果要在 memo 里复述一段「划线原文」，**不要**用 `>` 引用块；改成第 2 节模板里的「中文引号 + 加粗」方案。

---

## 2. 划线 memo 模板

```
「{markText}」

**《{书名}》** · {章节标题}

- 划线时间：{YYYY-MM-DD}
- 阅读位置：{weread://bestbookmark?...}

#微信读书 #微信读书/划线 #微信读书/{清洗后书名}

[wr:hl:{bookmarkId}]
```

### 2.1 字段映射

| 模板占位 | 来源 |
|---------|------|
| `{markText}` | `/book/bookmarklist` 的 `updated[].markText`，去首尾空白；内部换行原样保留 |
| `{书名}` | `/book/bookmarklist` 的 `book.title` |
| `{章节标题}` | 用 `updated[].chapterUid` 在同次返回的 `chapters[]` 里查 `title`；找不到写「未知章节」 |
| `{YYYY-MM-DD}` | `updated[].createTime`（Unix 时间戳，秒）转本地日期 |
| `{weread://bestbookmark?...}` | 见 §2.2 |
| `{清洗后书名}` | 原书名经 §4 清洗 |
| `{bookmarkId}` | 原值，不变动 |

### 2.2 阅读位置 URL 拼接

```
weread://bestbookmark?bookId={bookId}&chapterUid={chapterUid}&rangeStart={start}&rangeEnd={end}
```

⚠️ **`range` 字段有两套坐标，仅使用顶层 `updated[].range` / `review.range`**：

| 来源 | 例子 | 用途 |
|------|------|------|
| 顶层 `bookmark.range` / `review.range` | `"3447-3462"` | ✅ 用于 weread URL 的 `rangeStart`/`rangeEnd` |
| `bookmarkId` 末段切片 | `"674073_40_2826-2841"` 中的 `2826-2841` | ❌ 是另一套坐标系，**禁止**用来构造 URL |

正确做法：拼接 URL 之前先判断 `data.range` 是否存在；按 `-` 拆分填入 `rangeStart`/`rangeEnd`；`userVid` 可省。

**错误做法**（会导致 URL 跳到错误位置）：从 `bookmarkId` 字符串里 split('_') 取末段再 split('-')。`bookmarkId` 只用作去重标记，不要解析其内部结构。

如果 `range` 缺失（极少见），把整行「阅读位置：…」删掉（包括前面的 `-` 与项目符号）。**不要**输出半行。

---

## 3. 想法 memo 模板

```
{content}

划线：「{abstract}」

**《{书名}》** · {章节标题}

- 想法时间：{YYYY-MM-DD}
- 阅读位置：{weread://bestbookmark?...}

#微信读书 #微信读书/想法 #微信读书/{清洗后书名}

[wr:tk:{reviewId}]
```

### 3.1 字段映射

| 模板占位 | 来源 |
|---------|------|
| `{content}` | `/review/list/mine` 的 `reviews[].review.content`，去首尾空白；内部换行原样保留 |
| `{abstract}` | `reviews[].review.abstract`，仅当非空时输出 |
| `{书名}` | 同上 |
| `{章节标题}` | 用 `review.chapterUid` 在 `/book/bookmarklist` 同次返回的 `chapters[]` 里查 `title`；整本书评（`isFinish=1` 且无 `chapterUid`）写「全书」；其他找不到写「未知章节」 |
| `{YYYY-MM-DD}` | `review.createTime` 转本地日期 |
| `{weread://bestbookmark?...}` | 仅当 `review.chapterUid` 与 `review.range` 都有值时输出；否则连同 `-` 项目符号整行删掉 |
| `{reviewId}` | 原值 |

### 3.2 可选段落规则

- 「划线：「{abstract}」」：仅当 `review.abstract` 非空时输出（含前后空行）。整本书评、章节点评通常没有 abstract，要把这一段连同它前后的空行一起删除
- 「阅读位置：…」：仅当能拼出有效 URL 时输出；否则整行删掉

---

## 4. 标签清洗规则

flomo 标签名**不能**包含 `空格`、`<`、`#`、`>`，并以 `/` 分层。书名经常含空格、副标题分隔符（「：」「—」「–」「-」）、英文标点等，需清洗。

按以下顺序处理 `{清洗后书名}`：

1. 去首尾空白
2. 删除字符 `<` `>` `#`
3. 全角冒号 `：` / 半角冒号 `:` / 长破折号 `—` / 短破折号 `–` / 半角连字符 `-` 替换为下划线 `_`
4. `/` 替换为 `-`（避免误生成多级标签）
5. 任意空白（空格、Tab）替换为下划线 `_`
6. 连续多个下划线压缩为一个
7. 去掉首尾下划线
8. 清洗后为空 → 退回到 `book_<bookId>`

举例：

| 原书名 | 清洗后 |
|-------|--------|
| `三体` | `三体` |
| `三体：黑暗森林` | `三体_黑暗森林` |
| `Sapiens A Brief History` | `Sapiens_A_Brief_History` |
| `他乡/故乡` | `他乡-故乡` |
| `<lang>` | `lang` |
| `   ` | `book_<bookId>`（fallback） |

清洗仅用于**标签**。memo 正文里的 `**《{书名}》**` 用**原始书名**，不要清洗。

---

## 5. 标签 schema（已锁定，不要增减）

每条**划线/想法** memo 末尾段必须有且仅有这三个同行标签，按下面顺序：

```
#微信读书 #微信读书/{类型} #微信读书/{清洗后书名}
```

- `{类型}` 是字面量：划线 memo 写 `划线`，想法 memo 写 `想法`
- 三个标签同一行，单空格分隔，顺序：根 → 类型 → 书名
- **禁止**：增加 `#作者/X`、`#章节/X`、`#在读`、`#读完`、`#flomo` 等任何额外标签；**禁止**插入 `/书/` 中间层

**例外**：失败回执 memo（§10）使用 `#微信读书/导出失败` 作为第二级类型标签，是这一类 memo 的**专属**标签，不适用于划线/想法 memo。

---

## 6. 输出顺序（重要）

每条 memo 必须严格按以下顺序，段落之间用空行分隔：

1. 主体内容（划线原文 / 想法正文）
2. （想法 memo 才有）「划线：「{abstract}」」段，仅当 abstract 非空
3. `**《{书名}》** · {章节标题}` —— 同一行，加粗书名
4. 元数据无序列表（划线/想法时间、阅读位置 URL）
5. 标签段（3 个 `#` 标签同一行，空格分隔）
6. 去重标记（独立一行，**整条 memo 的最后一行**）

去重标记前后**只能各有一个换行**。多余空行会让 `memo_search` 仍然命中，但会让正文显得脏。

---

## 7. 完整示例

### 7.1 划线 memo（带阅读位置）

```
「人类的赞歌是勇气的赞歌，人类的伟大就是勇气的伟大。」

**《XX》** · 第三章「黑暗森林」

- 划线时间：2025-08-12
- 阅读位置：weread://bestbookmark?bookId=12345&chapterUid=42&rangeStart=900&rangeEnd=2004

#微信读书 #微信读书/划线 #微信读书/XX

[wr:hl:abc123def456]
```

### 7.2 想法 memo（带 abstract、带阅读位置）

```
这一段把人物的内心矛盾写得很细，让我想到自己面对类似处境时的犹豫。

划线：「他停在门口，久久没有推开那扇门。」

**《YY》** · 第七章「转身」

- 想法时间：2025-08-15
- 阅读位置：weread://bestbookmark?bookId=67890&chapterUid=88&rangeStart=120&rangeEnd=145

#微信读书 #微信读书/想法 #微信读书/YY

[wr:tk:xyz789uvw012]
```

### 7.3 想法 memo（整本书评，无 abstract、无阅读位置）

```
读完整本，最大的感受是结构远比情节重要。作者把后半段的伏笔铺得很克制，回头看会有惊喜。

**《ZZ》** · 全书

- 想法时间：2025-09-01

#微信读书 #微信读书/想法 #微信读书/ZZ

[wr:tk:uvw345def678]
```

注意：这个例子里没有「划线：…」段，也没有「阅读位置：…」行；都是按 §3.2 的规则整段删掉。

---

## 8. 自检清单（写入前）

每条 memo 在 `memo_create` 之前自查：

- [ ] 主体内容非空？
- [ ] flomo 不支持的语法都已剔除（无 `#` 标题、无 `>` 引用、无代码块、无表格、无 `[文字](url)` 链接）？
- [ ] 三个标签同一行，顺序正确，没多没少？
- [ ] 最后一行是 `[wr:hl:...]` 或 `[wr:tk:...]`，且 ID 未变形？
- [ ] 去重标记前后只有一个换行（前面是空行，后面没有内容）？
- [ ] 章节标题缺失时已经写「未知章节」或「全书」，没有出现 `chapterUid:undefined` 这种意外字符串？
- [ ] 时间戳已转 `YYYY-MM-DD`（按 §9 的 `Asia/Shanghai`），不是原始 Unix 数字？
- [ ] URL 里的 `chapterUid` 取自 `chapter.chapterUid` 而**不是** `chapterIdx` 或 bookmarkId 中段数字（见 `workflow.md` §2.2）？
- [ ] URL 里的 `rangeStart`/`rangeEnd` 取自顶层 `range` 字段而**不是** bookmarkId 末段（见 §2.2）？

---

## 9. 时区

所有 `createTime` / `updateTime` → `YYYY-MM-DD` 转换**统一使用 `Asia/Shanghai` (UTC+8)**，不论 agent 进程的本地时区。理由：

- 微信读书是中国大陆服务，划线时间记录使用 +08:00
- Agent 可能跑在 UTC 容器里 / 海外 VPS / 用户出差时区，**不能假定本地时区一致**
- 同一条划线在不同会话产生不同日期会让用户困惑

实现要点：

```js
// JavaScript
const date = new Date(ts * 1000).toLocaleDateString('en-CA', {
  timeZone: 'Asia/Shanghai',
});
// en-CA locale 输出 YYYY-MM-DD 格式（"2025-08-12"）
```

```python
# Python
from datetime import datetime
from zoneinfo import ZoneInfo
date = datetime.fromtimestamp(ts, ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d')
```

```bash
# Shell
TZ='Asia/Shanghai' date -r "$ts" '+%Y-%m-%d'        # macOS / BSD date
TZ='Asia/Shanghai' date -d "@$ts" '+%Y-%m-%d'       # GNU date / Linux
```

格式化失败（极端：Unix 时间戳为 `0` 或负数） → 整行「划线时间：…」删掉，不要输出 `1970-01-01`。

---

## 10. 失败回执 memo（连续 5 次失败时写入）

当一次批量导出（章节 / 单本 / 全部）因连续 5 次 `memo_create` 失败而中止，**在停止后追加一条「失败回执」memo**，以便下次再跑 skill 时识别失败清单并自动重试。

模板：

```
本次导出未完成。

失败条目（重新跑 skill 时会自动提示重试）：
- {hl|tk}:{bookmarkId 或 reviewId}：{错误摘要}
- {hl|tk}:{bookmarkId 或 reviewId}：{错误摘要}
- ...

**《{书名}》** · {范围描述}

- 中止时间：{YYYY-MM-DD HH:mm Asia/Shanghai}

#微信读书 #微信读书/导出失败 #微信读书/{清洗后书名}

[wr:fail:{ISO时间戳}]
```

字段说明：

| 占位 | 来源 |
|------|------|
| `{hl|tk}:` 前缀 | 失败的是划线写 `hl:`，想法写 `tk:` |
| `{书名}` | 当前导出书名；全量导出会话写「批量会话」 |
| `{范围描述}` | "全章导出"（章节）/ "整本导出"（单本）/ "全量导出（第 N 本）"（全部模式） |
| `{ISO时间戳}` | 中止时刻的 ISO 8601 字符串（如 `2026-05-16T17:25:00+08:00`），用于唯一标识本次回执 |

注意：

- **回执 memo 自身的 `memo_create` 失败不计入** 5 次终止，也不再重试。回执失败就告诉用户失败了，让他们记一下 ID
- 回执 memo 用的标签 `#微信读书/导出失败` 是这一类回执的**专属第二级标签**（**不影响**划线/想法 memo 锁死的标签 schema）
- 末行用 `[wr:fail:{ISO时间戳}]` 而非 `[wr:hl:...]` / `[wr:tk:...]`，**避免与正常去重标记混淆**
- 下次启动 skill 时，按 `workflow.md` §0 第 3 步主动检查回执
- **不写**「重试成功后修改 receipt」之类逻辑——本版本回执 memo 一旦写入永久存在，重试时由 agent 在对话里告诉用户「这些已成功，可以手动删了那条回执」

完整示例：

```
本次导出未完成。

失败条目（重新跑 skill 时会自动提示重试）：
- hl:674073_40_2826-2841：MCP 5xx 服务器错误（已重试 1 次仍失败）
- hl:674073_40_3388-3517：MCP 5xx 服务器错误
- tk:abc123_review：MCP 5xx 服务器错误
- hl:674073_40_3549-3719：MCP 5xx 服务器错误
- hl:674073_40_4890-4959：MCP 5xx 服务器错误

**《沧浪之水》** · 全章导出

- 中止时间：2026-05-16 17:25 Asia/Shanghai

#微信读书 #微信读书/导出失败 #微信读书/沧浪之水

[wr:fail:2026-05-16T17:25:00+08:00]
```
