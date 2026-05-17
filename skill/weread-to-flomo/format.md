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

flomo 标签名**不能**包含若干字符，遇到这些字符标签会被**截断**（实测：`""''` 之后的部分丢失），所以必须先清洗。

### 4.1 已实证会截断标签的字符

以下字符在 flomo 标签里都会触发截断或解析异常（基于 2026-05 实测，不是穷举）：

| Unicode | 字符 | 来源 |
|---------|------|------|
| U+0020 | 空格 | flomo 文档明示 |
| U+0023 | `#` | 标签起始符 |
| U+003C / U+003E | `<` `>` | flomo 文档明示 |
| U+201C / U+201D | `"` `"` 中文双引号 | 实测截断（《被讨厌的勇气："自我启发之父"阿德勒的哲学课》） |
| U+2018 / U+2019 | `'` `'` 中文单引号 | 同类，按对称推测 |
| U+00A0 / U+3000 | 不间断空格 / 全角空格 | 类空格行为 |
| U+0009 | Tab | 类空格行为 |

中文出版物的副标题极常用 `""` 包裹术语（"互联网+"、《"自我启发之父"》等），这条规则必须严格执行——一个截断的标签等于一条 memo 在 flomo 的 tag tree 里**永远找不到**。

### 4.2 清洗步骤

按以下顺序处理 `{清洗后书名}`：

1. 去首尾空白
2. **删除字符** `<` `>` `#` `"` `"` `'` `'`
3. 全角冒号 `：` / 半角冒号 `:` / 长破折号 `—` / 短破折号 `–` / 半角连字符 `-` 替换为下划线 `_`
4. `/` 替换为 `-`（避免误生成多级标签）
5. **任意空白替换为下划线**：包括 ASCII 空格 ` `、Tab `	`、不间断空格 ` `、全角空格 `　`
6. 连续多个下划线压缩为一个
7. 去掉首尾下划线
8. 清洗后为空 → 退回到 `book_<bookId>`

JS 实现参考：
```js
function cleanTag(rawTitle, bookId) {
  let t = rawTitle.trim()
    .replace(/[<>#""''""]/g, '')           // 删除 U+003C/3E/23/201C/201D/2018/2019
    .replace(/[：:—–-]/g, '_')               // 副标题分隔
    .replace(/\//g, '-')                     // 防多级标签
    .replace(/[\s 　]/g, '_')       // 各种空白
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return t || `book_${bookId}`;
}
```

⚠️ 这里规则 2 删除的字符 **不替换为下划线** —— 因为弯引号在书名里通常包裹连续术语，删除后两侧都是有意义的文字，多插一个 `_` 反而让标签变形（`被讨厌的勇气_自我启发_之父_阿德勒` 不如 `被讨厌的勇气_自我启发之父阿德勒` 自然）。规则 3 / 5 替换的字符两侧通常本身就是分词点，所以替换为 `_` 合适。

### 4.3 举例

| 原书名 | 清洗后 |
|-------|--------|
| `三体` | `三体` |
| `三体：黑暗森林` | `三体_黑暗森林` |
| `Sapiens A Brief History` | `Sapiens_A_Brief_History` |
| `他乡/故乡` | `他乡-故乡` |
| `<lang>` | `lang` |
| `被讨厌的勇气："自我启发之父"阿德勒的哲学课` | `被讨厌的勇气_自我启发之父阿德勒的哲学课` |
| `工作、消费主义和新穷人` | `工作、消费主义和新穷人`（顿号 `、` 不在清洗列表，flomo 接受） |
| `   ` | `book_<bookId>`（fallback） |

注：顿号 `、` (U+3001)、句号 `。` (U+3002)、破折号 `——` (U+2014×2 已映射到 `_`) 等，目前实测不会截断标签；不在清洗列表里。如果将来发现新的截断字符，按 §4.1 表格补充并 bump skill 版本。

清洗仅用于**标签**。memo 正文里的 `**《{书名}》**` 用**原始书名**，不要清洗——正文允许任意 Unicode 字符。

### 4.4 中文排版（仅适用于本 skill 自己生成的样板文字）

memo 模板里**本 skill 自己写的样板文字**（如 `「{markText}」` 外层 corner brackets、`**《{书名}》**`、`- 划线时间：` 等）遵循 [chinese-copywriting-guidelines](https://github.com/sparanoid/chinese-copywriting-guidelines)：

- 中文用全角标点 `，。：「」《》`
- 中英文混排时英文两侧加空格（`weread://` URL 行例外，URL 不能塞空格）
- 数字与单位之间加空格

**但 markText / review.content 原文一律不动**——SKILL.md 核心规则 5「不擅自变形」无例外。原文里就算混了直角双引号 `""` 或半角破折号 `--`，照写。这是用户的笔记，不是我们的文案。

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
- [ ] 已跑 §8.1.4 的**码位计数预检**？特别是 `U+FF1A` 全角冒号 `：` 的数量是否与 source 严格相等？（agent 连续写多条时最易把它错敲成 ASCII `:`）

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
3. **归一化已知的 flomo 平台变换**（见 §8.1.3）：把 `\n+` 折叠成单个 `\n` 后再比较。这一步在 local 和 flomo 两侧**都做**，确保比的是「内容信息」而不是「换行渲染」
4. **关键码位 audit**（脚本里跑，不要靠肉眼）：
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
   const norm = (s) => s.replace(/\n+/g, "\n");
   console.log("normalized-match:", norm(local) === norm(flomo) ? "YES" : "NO");
   '
   ```
5. **不一致时**：立即按 `SKILL.md` 的「写错时的修正流程」处理（告诉用户 + 给 id + 等用户手动删 + 重写）。**不要**当作「下一条不会再错就行」忽略

**何时可以省略 audit**（成本权衡）：

- 单条导出（§3）：**必做**。1 次 batch_get 不痛
- 章节 / 单本 / 全部（≤ ~50 条）：**必做**。逐条 batch_get 仍可接受
- 全量导出 几百条：可以**抽样 10%**（每 10 条 audit 1 条），但**写完后必须再做一次全量 audit**——`memo_search keywords:"wr:" tag:"微信读书/{清洗后书名}" limit:200` 取回这本书全部 memo，本地脚本对比每条对应的 local 源；任何不一致按上述修正流程处理

**禁止的偷懒模式**：

- ❌ 「这一批我用了 path B，应该没问题」就跳过 audit。**path B 不是免审通行证**，它降低概率不消除概率
- ❌ 「肉眼对比 markdown 预览看着一样」。终端字体让 `"` vs `"` 几乎不可分；audit 必须是脚本里跑 `===` 或 charCodeAt 比较
- ❌ 「写完整个章节再统一 audit」。第一条出错，后面 10 条都用同款错误模板，修正成本指数放大。**每条写完立即 audit**

理由：本 skill 的核心承诺是「不擅自变形」，这是 SKILL.md 核心规则 5。Path B 把概率降到很低但没归零；写后 audit 才是真正的保真闭环。两层缺一不可。

#### 8.1.3 flomo 平台的已知确定性变换（audit 时归一化掉）

`memo_create` 写入的 `content` **不会**在 flomo 服务端完整以字节存储，平台会做一些**确定性**的渲染层规整。**这些变换不是我们的错**，但 byte-exact 比较会把它们当 false-positive，必须在 audit 前归一化掉。

| 变换 | 实证 | 归一化方式 |
|------|------|------------|
| 段内单 `\n` → 段间双 `\n\n` | HL 含两段、源 markText 中间用单 `\n` 分隔，写入后 flomo 存储变成 `\n\n`（markdown 段落规范） | 两侧都做 `s.replace(/\n+/g, "\n")` 后再比 |
| `[` `]` `_` 自动加反斜杠 escape | flomo 回包的 content 里这三个字符前都有 `\` | 见 `dedup.md` §3：`s.replace(/\\/g, "")` 去 escape |
| 行末空格被 trim | 单行末尾的尾随空格在写入后消失（不影响内容信息） | 行尾空格非必要 → 渲染时不要写 |

**注意范围**：

- 这些归一化**只**在 audit 比对时做，**不**在我们生成的 content 里做（即：我们写入时不要主动把 `\n` 变 `\n\n`，flomo 自己会做；不要主动给 `[` 加反斜杠，flomo 自己会做）
- 归一化是为了让「fidelity audit」聚焦在**我们能控制的字符层面**——弯引号、破折号、引文内容、ID、tag schema——而不是被平台行为干扰
- 如果将来发现 flomo 引入新的渲染层变换（如全角空格折叠、Markdown 列表标记规范化），按这里的表格补一行 + 加归一化步骤；同时 bump skill 版本

**禁止**：

- ❌ 因为 audit 不通过就盲目调整 content（如「flomo 把 `\n` 变 `\n\n`，那我就先在 content 里写 `\n\n` 凑齐」）。**应该改 audit 的归一化，不是改 content**
- ❌ 把归一化扩大成「所有字符差异都忽略」。归一化只能针对**实证过的、确定性的、单向的**平台变换；其他差异（弯引号变直引号、`—` 变 `-`）必须仍触发不通过

#### 8.1.4 调用 `memo_create` 之前的预检（pre-call sanity check）

`memo_create` 调用一旦发出，agent 写错的 memo 就要靠用户手动删——成本远高于多做一次预检。**每次** `memo_create` 前必跑下面的 cheap audit，跑完才发起调用：

**步骤**：

1. **拿到 content 的字面字节**：从临时文件 / `Read` 工具结果 / 脚本 stdout 取一次完整的待发字节流。**不能**从对话内的预览或之前的 `memo_create` 工具结果回打——这就是 §8.1 的核心禁令
2. **跑「码位计数」预检脚本**：对 content 数 5 类高风险字符的数量，与本地源文件的同字符数量**严格相等**：
   ```bash
   node -e '
   const fs = require("fs");
   const content = require("fs").readFileSync("/tmp/<this_memo>.txt", "utf8");
   const source  = require("fs").readFileSync("/tmp/<this_memo>_render.txt", "utf8");
   // 实际上 content === source（都来自同一渲染产物），这一步是确认 agent 没回打
   const codes = {
     "U+FF1A 全角冒号": /：/g, "U+003A ASCII 冒号": /:/g,
     "U+201C 左弯引号": /“/g, "U+201D 右弯引号": /”/g, "U+0022 直引号": /"/g,
     "U+2014 长破折号": /—/g, "U+002D 半角连字符": /-/g,
     "U+2026 省略号": /…/g, "U+FF0C 全角逗号": /，/g,
   };
   for (const [name, re] of Object.entries(codes)) {
     const a = (content.match(re)||[]).length;
     const b = (source.match(re)||[]).length;
     if (a !== b) { console.log("❌ 预检失败:", name, "content="+a, "source="+b); process.exit(1); }
   }
   console.log("✓ pre-call audit passed");
   '
   ```
3. **预检不通过** → **不要发** `memo_create`。回到 §8.1 path B 重新走渲染流程；如果连第二次也错，把 content 直接从 Bash `cat /tmp/<file>.txt` 输出复制，不要凭印象敲

**为什么这一步必要（基于本会话实证）**：

41 条 memo 的真实 case study：
- HL#12 ch.168 → ASCII `:` 写成全角 `：`（实测 1 次）
- HL#7 + HL#12 ch.170 → 同款错误（实测 2 次）

**3/41 = 7% 错误率**，全是 `:` ↔ `：` 这一种替换；全都发生在 agent 连续写 5-10 条 memo 后的注意力低谷期；全都被 §8.1.2 写后 audit 抓到，但每条都要走完整的「告诉用户 + 用户删 + 重写」流程（人工成本 = 1-2 个对话来回）。

**码位计数预检的成本**：1 个 node -e 调用，毫秒级。**收益**：把 7% 的事后修正变成 0% 的事前拦截。

**特别强调全角冒号 `：` (U+FF1A)**：本 skill 模板里有 4 处出现，分别是「书名:副标题」「划线时间：」「想法时间：」「阅读位置：」。**任何一个被替换成 ASCII `:` 都构成偏差**。预检脚本的 `U+FF1A` count 是最重要的单一指标，建议永远做。

**何时可以省略预检**（成本权衡）：

- 单条 memo：不省略
- 批量 ≤ 50：不省略（每条 1 次 node 调用，比每条 batch_get audit 还便宜）
- 批量大量：可以**每 10 条预检 1 次抽样**，但写后 §8.1.2 audit 仍必做

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
