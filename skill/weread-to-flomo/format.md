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
- [ ] `memo_create` 的 `content` 参数**直接来自一次性渲染产物**（临时文件、脚本返回值、`Read` 读出的字面字节），**没有从对话里之前打印的预览中回打**？（见 §8.1）

### 8.1 内容保真硬约束（不要回打）

`memo_create` 的 `content` 参数只能从下面其中一个来源传入：

1. **临时文件**：渲染后写入 `/tmp/<file>.txt` / `.json`，再用 `Read` 工具读出来（Read 返回的字节就是原字节，没有终端字体或 Markdown 渲染层介入）
2. **脚本直出**：在 Node/Python 脚本里渲染好 memo 字符串后，直接通过 `JSON.stringify` 写文件，下一步 `memo_create` 时引用文件内容
3. **同一脚本一次性批写**：脚本本身循环调用 MCP（不适用本 skill 当前架构，仅提及）

**禁止**：
- 把刚才在对话/工具结果里打印的样本预览**复制粘贴**到 `memo_create` 的参数里
- 在 agent 自己的 markdown 输出里看一眼 memo 内容、然后凭印象敲到工具调用里

理由：终端字体让多种字符**视觉上几乎一样**：
- `"` (U+0022 ASCII 直引号) 与 `"` `"` (U+201C/U+201D 中文弯引号)
- `'` (U+0027) 与 `'` `'` (U+2018/U+2019)
- `-` (U+002D) 与 `–` (U+2013) 与 `—` (U+2014)
- ` ` (U+0020 普通空格) 与 ` ` (U+00A0 不间断空格) 与零宽字符
- `…` (U+2026) 与 `...` (三个 ASCII 点)

这些字符在中文出版物里是有意义的标点。微信读书的 markText 几乎一定使用弯引号、长破折号、中文省略号；agent 回打时极容易静默替换成 ASCII 等价物，违反 SKILL.md 核心规则 5「不擅自变形」。skill 本身的 `format.md` / `workflow.md` 也无法在事后审计中察觉这种偏差（因为 `memo_search` 的 fuzzy 匹配照样能找到）。

正确流程示例：

```
1. 渲染脚本：node -e 'const m = render(...); fs.writeFileSync("/tmp/memo.txt", m)'
2. Read /tmp/memo.txt
3. memo_create content: <把 Read 工具结果里的字面字节填进来>
```

不要写成：

```
1. 渲染脚本，console.log(memo) 给用户看
2. memo_create content: <凭刚才 console 输出的印象重打>
```

#### 8.1.1 Read 工具输出的行号前缀（容易踩）

`Read` 工具返回的每一行格式是 `<行号><tab><内容>`，**行号和 tab 都不是 memo 的真实字节**。从 `Read` 输出取 content 时务必：

1. **逐行剥掉前缀**：去掉行首的数字 + 单个 `\t`
2. **多行用 `\n` 重接**：不要保留行号之间的视觉空白
3. **空行就是空行**：Read 输出里 `<n>\t` 后什么都没有的行，就是源文件里的空行，重接时不要丢

如果担心剥行号出错，**首选不用 Read 走构造**，改用下列任一更稳妥的途径：

**A. Bash heredoc 直出 stdin**：
```bash
# 把临时文件喂给 stdin，避开 Read+剥行号
content=$(cat /tmp/memo.txt)
# 然后在 agent 这边把 $content 当作 memo_create 的 content 参数
```
（实际 agent 不能这样真接 stdin 给 MCP 工具，所以这只是示意——用法见 B）

**B. 一次性脚本组装好 MCP 调用所需的 JSON args**：
```bash
node -e '
const fs = require("fs");
const content = fs.readFileSync("/tmp/memo.txt", "utf8");
console.log(JSON.stringify({ content }, null, 0));
' > /tmp/memo_args.json
```
然后 `Read /tmp/memo_args.json`，把读出来的 JSON 字符串里的 `content` 字段取出来——`JSON.stringify` 会把所有特殊字符 escape，行号剥不剥都不会动到正文字节。

**C. 单条写入时，让脚本直接把 memo 文本读到 stdout**，agent 用 Bash 拿到字符串后传给 `memo_create`：
```bash
cat /tmp/memo.txt   # 输出的是纯字节，没有行号前缀
```
但 Bash 工具结果同样会被终端字体渲染，agent 仍要警惕复制时的字符替换。

实际本 skill 推荐的最小可靠路径：**B**（脚本写 JSON args 文件 → Read JSON → 提取 content 字段）；如果 memo 数 ≤ 5 也可以走 A 等价的「Read 文本文件 + 仔细剥行号」路径，但要在写完后用 `memo_batch_get` 取回新 memo 的 content，逐字符 audit U+201C/2014/2026 等关键码位，确认与本地源文件一致。

如果 agent 必须在工具调用之间手动构造 content（极少情况），**逐字符核对**所有引号、破折号、省略号的 Unicode 码位，并在 user-facing 文本里声明已核对。

#### 8.1.2 写入后必做：byte-exact audit（闭环）

`memo_create` 之后**每条**立即跑一次保真审计，构成完整闭环。**不要省**——视觉相似的字符替换在事中察觉成本最低，等到用户在 flomo 里翻到那条才发现，已经只剩「请用户手动删 + 重写」的修正路径。

**步骤**：

1. **取回写入结果**：
   ```
   memo_batch_get id: <刚 memo_create 返回的 id>
   ```
2. **去 escape**：flomo 回包 `content` 自动给 `[`, `]`, `_` 加反斜杠，按 `dedup.md` §3 的规则做 `.replace(/\\/g, "")`
3. **关键码位 audit**（脚本里跑，不要靠肉眼）：
   ```bash
   node -e '
   const fs = require("fs");
   const flomo = "<unescaped content from memo_batch_get>";
   const local = fs.readFileSync("/tmp/memo.txt", "utf8");
   const audit = (label, s) => {
     const codes = ["“","”","‘","’","—","–","…", " ", "　"];
     console.log(label, codes.map(c => `${c}=${(s.match(new RegExp(c, "g"))||[]).length}`).join(" "));
   };
   audit("local", local);
   audit("flomo", flomo);
   console.log("byte-exact:", local === flomo ? "YES" : "NO");
   '
   ```
4. **不一致时**：立即按 `SKILL.md` 的「写错时的修正流程」处理（告诉用户 + 给 id + 等用户手动删 + 重写）。**不要**当作「下一条不会再错就行」忽略

**何时可以省略 audit**（成本权衡）：

- 单条导出（§3）：**必做**。1 次 batch_get 不痛
- 章节 / 单本 / 全部（≤ ~50 条）：**必做**。逐条 batch_get 仍可接受
- 全量导出 几百条：可以**抽样 10%**（每 10 条 audit 1 条），但**写完后必须再做一次全量 audit**——`memo_search keywords:"wr:" tag:"微信读书/{清洗后书名}" limit:200` 取回这本书全部 memo，本地脚本对比每条对应的 local 源；任何不一致按上述修正流程处理

**禁止的偷懒模式**：

- ❌ 「这一批我用了 path B，应该没问题」就跳过 audit。**path B 不是免审通行证**，它降低概率不消除概率
- ❌ 「肉眼对比 markdown 预览看着一样」。终端字体让 `"` vs `"` 几乎不可分；audit 必须是脚本里跑 `===` 或 charCodeAt 比较
- ❌ 「写完整个章节再统一 audit」。第一条出错，后面 10 条都用同款错误模板，修正成本指数放大。**每条写完立即 audit**

理由：本 skill 的核心承诺是「不擅自变形」，这是 SKILL.md 核心规则 5。Path B 把概率降到很低但没归零；写后 audit 才是真正的保真闭环。两层缺一不可。

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
