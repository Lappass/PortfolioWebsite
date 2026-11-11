# 修改档案内容

[`archives.json`](archives.json) 是页面与 TXT 下载共用的档案数据。修改内容无需编辑 TypeScript；`src/data.ts` 只保留类型和阵列位置映射。

## 文件结构

- `categories`：检索筛选器的分类，按显示顺序排列；只列有作品的分类。“全部档案”由界面添加，无需填写。
- `featured`：首页四个主项目的编号，数组顺序就是展示顺序。例如 `["X-001", "X-002", "X-003", "X-004"]`。必须是四个不同且存在的编号。
- `records`：全部作品，按稳定编号排列。未出现在 `featured` 中的项目自动进入实验合集，按日期倒序展示；合集筛选、独立详情与链接继续可用。

| 字段                        | 内容                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `id`                        | 稳定编号，用于收藏、定位和下载文件名                        |
| `title`、`en`               | 标题、一句话说明（正常大小写，10 个词以内）                   |
| `department`、`category`    | 角色与团队（如 "Solo project"）、所属分类；分类须与上面的名称完全一致 |
| `date`、`lead`、`status`    | 年份、引擎与技术；`status` 可选，进行中的作品写 "In development" |
| `abstract`                  | 50 到 80 个词，用一个具体场景说清这是什么游戏               |
| `findings`                  | 至少一条，每条一句话，字符串数组                            |
| `source`                    | 设定参考的完整 HTTP 或 HTTPS 链接                           |

以下字段可选，用于独立项目页（网址形如 `#/work/x-001`）。媒体放在 `public/works/<编号>/` 下并写相对路径，也可以写 HTTPS 链接：

| 字段      | 内容                                                                       |
| --------- | -------------------------------------------------------------------------- |
| `tags`    | 技术标签数组，显示在选中卡片和项目页；缺省时按 `lead` 拆分                 |
| `cover`   | 封面图，例如 `works/x-001/cover.jpg`（建议 16:9）                          |
| `hero`    | 插入光盘后首页铺满全屏的主视觉（16:9，宽至少 1920）；缺省时用 `cover`，再缺省时用生成的封面图案 |
| `gallery` | 画廊数组，每项 `{ "src": "...", "caption": "可选标题", "note": "可选旁注正文" }`；有 `note` 时可点击编号标题展开说明 |
| `video`   | `.mp4` / `.webm` 文件路径，或 B 站、YouTube 等嵌入播放器的 HTTPS 地址      |
| `unity`   | Unity WebGL 构建的 `index.html` 路径，例如 `works/x-002/unity/index.html`；页面先显示封面，点击后才加载 |
| `links`   | 链接数组，每项 `{ "label": "GitHub", "url": "https://..." }`               |
| `menu`    | 游戏页的封面造型：`lastmile`、`trail`、`lockdown` 或 `sniff`。设置后页面第一屏是这款游戏自己的造型（齿轮、山路、公寓、证物墙），造型里的部件对应 `study` 的各节；素材在 `public/works/<编号>/menu/`（由 `art/` 下的海报脚本生成）。缺省时第一屏是主视觉 |
| `trailer` | 预告片，写法同 `video`；缺省时用 `video` |
| `playthrough` | 完整流程视频 `{ "src": "...", "chapters": [{ "at": "3:20", "label": "第二天" }] }`，章节可省略。`src` 写法同 `video`，YouTube 的 `youtu.be` 或 `watch?v=` 链接直接贴即可，页面会换成嵌入播放器。设了 `menu` 的游戏直接在封面上放一个视频（缩略图加播放键，点了才载入播放器；手机上排在文字下方）；其余游戏在预告片之后加一块「Full playthrough」，封面多一个同名按钮。章节显示在视频下方，点击跳到对应时间 |
| `download` | 下载 `{ "url": "https://...", "label": "可选说明", "size": "可选大小" }` |
| `study`   | 这款游戏的页面正文，写法见下。缺省时页面用 `abstract` 与 `findings` |

`study` 的结构：

```json
{
  "pitch": "一段话：这是什么游戏，玩家做什么",
  "facts": [{ "label": "Role", "value": "Solo developer" }, { "label": "Engine", "value": "Unity 6" }],
  "sections": [
    {
      "heading": "一节的标题",
      "summary": "页面上显示的一段话，25 到 90 个词，数字写在句子里",
      "body": ["第一段", "第二段"],
      "points": ["可选的要点"],
      "media": [{ "src": "works/x-002/study/01.jpg", "caption": "可选图注" }]
    }
  ]
}
```

插盘后打开的是一整页往下滚的页面。第一屏是封面：有 `menu` 的游戏用它自己的造型，否则用主视觉；封面上有标题、`en` 一句、`pitch`、`facts` 连成的一行，以及 Play（`unity`）、Trailer（`trailer`，缺省用 `video`）、Download（`download`）三个按钮，没有的灰显为 not yet。往下依次是试玩、预告片、`sections` 每节一块（标题、`summary`，第一张 `media` 大图、第二张小图）、截图（`gallery`）和链接。封面造型里的部件（营地、订单条、窗格、名牌）各对应一节，点击跳过去，滚动时点亮当前一节；右侧圆点可以跳到任何一块，↑↓ 与 PageUp/PageDown 逐块移动。没有 `summary` 时取 `body` 的第一句。配图放在 `public/works/<编号>/study/`。TXT 下载会附上各节正文。

一节也可以照着打印版作品集的那一页来排：加上 `spread`，这一节就显示 `body` 的全部段落（不再用 `summary`），图片按对应版式摆放。Trail Adventure 用的就是这种写法，对应它的 PDF 作品集。

| `spread`    | 版式 |
| ----------- | ---- |
| `prints`    | 左边文字，右边是三张斜放的实拍照片（白边相纸） |
| `grid`      | 左边文字，右边两列编号截图；`note` 写在图下 |
| `bleed`     | 第一张图贴着页面左边缘铺满整节，第二张（通常是横条）插在最后一段之前 |
| `pair`      | 图配前几段文字，下一行是最后一段配第二张较小的图 |
| `herd`      | 顶部一排物种图标（`herd: [{ "src", "name" }]`），下面文字配一张图，最后一段放在图下 |
| `trio`      | 左边文字，右边一大两小 |
| `annotated` | 顶部一张宽图，`marks: [{ "x", "y" }]`（百分比）标编号；下面是文字、`points` 编号说明（“名称. 说明”）和第二张图 |
| `cards`     | 一段引言，下面一排卡片，每张图写 `title` 与 `note` |
| `card`      | 整幅图上压一张纸片，写 `controls`：每行 `[{ "keys": ["W", "A"], "say": "walk" }]`，鼠标键写 `mouse-left`、`mouse-right`、`mouse-wheel` |
| `rows`      | 左边文字，右边一列图，每张图旁边写 `title` 与 `note` |
| `float`     | 大图配文字，第二张小图浮在文字里，其余图排成一行，`note` 跟在这一行后面 |
| `banner`    | 一张或两张图横在上面，下面标题和各段并排 |
| `tall`      | 竖图在前排成一行，文字在右 |
| `faces`     | 一排人物头像（`herd`，每项可加 `sub` 小字），下面各段并排，最后一张图 |
| `flank`     | 文字左右各一张竖图 |
| `stack`     | 左边文字，右边几张图上下排列 |
| `beside`    | 左边文字，右边两张图并排（同一高度），第三张图（如一条横图）铺在整节下方 |
| `marked`    | 左边一张大图，`marks` 标编号；右边是标题、第一段、`points` 编号说明和其余段落 |
| `edge`      | 第一张图贴着页面左边缘铺满，中间文字（`note` 跟在文字后），右边一张竖图 |
| `corner`    | 前几张图横在左上，最后一张竖图占右边一整列，标题和各段在左下 |

`grid` 只有三张图时排成三列并保持原图比例（适合手机截图）。图注前的粗体：`grid` 默认是编号，图写了 `label`（如 `"Day 5"`）时改用它。LockDown 用了后面这几种，对应它的 PDF 作品集。Last Mile 又加了 `stack`、`beside`、`marked`、`edge`、`corner`。`cards` 的第一段在卡片上方，其余段落在卡片下方；`banner` 的第一段单独一栏，其余段落合为一栏。同一排的图（`banner`、`tall`、`beside`、`corner`）高度一致，宽度按各自比例。

`media` 每项还可以写 `focus`（裁切时保留的位置，CSS `object-position`，如 `"12% 50%"`）。`note` 用于 `prints`（文字下方）、`grid`（图下，灰色小字）和 `float`（那一排图后面）。手机上所有版式都改为单列。

文字一律用自己的口吻：短句，具体的人名、地名和数字写在句子里，讲意图用第一人称；标题是名词或平常的句子。校验会拒绝全大写的 `en` 和标题、含 " that " 的标题、COMING SOON / A GAME BY / SOLO DEVELOPER / MIN READ / RESTRICTED 这类套话，以及不在 25 到 90 个词之间的 `summary`。

封面区按 Unity、视频、封面图的顺序选择第一个可用项；有 Unity 时视频单独显示在下方。

有 `menu` 的作品不用这套版式：主菜单列出在线试玩（`unity`）、预告片、完整流程、下载、简介和截图（`gallery`），没有内容也不在 `soon` 里的项不显示。

上表之前的字段均必填，文本不能只包含空白。所有内容按纯文本显示，不支持 Markdown 或 HTML；引号按 JSON 规则写为 `\"`，换行写为 `\n`。页面会转义 HTML 特殊字符，TXT 下载保留原文。保留公开设定的来源，区分档案式改写与游戏原文。

## 修改与验证

1. 编辑 JSON 中对应档案的字段。修改分类名称时，同时更新 `categories` 和各档案的 `category`；通过 `featured` 调整四个主项目及顺序。
2. 执行 `npm run export:archives`，校验数据并更新 `public/archives/` 中的下载文件。校验失败时不会写入任何下载文件。
3. 执行 `npm run check:content` 检查校验规则与下载一致性，再运行 `npm run build` 验证构建。将 JSON 与更新后的 TXT 一起提交。
4. 在 `npm run dev` 中查看标题、详情、检索和下载结果，尤其检查长标题与较长正文的实际布局。

`npm run dev` 启动前和 `npm run build` 构建前都会自动校验并导出。开发服务器运行期间，JSON 修改会更新页面；下载文件需再次执行 `npm run export:archives` 或重启开发服务器。

首页阵列只排 `featured` 的四个作品，其余作品在实验合集里，数量不限。编号一经给出就不再改动：新作品用下一个未用过的编号，删除作品时留下空号，不要交换或重编号，以免已有收藏和链接指向不同内容。校验会检查编号格式、重复与先后顺序，无法判断改写后是否仍是原来那份档案。

内容分离的建议来自 [@Tomahawkd 的 PR #3](https://github.com/LBEILC/RhineLabUI/pull/3)。此实现仅拆分当前项目的档案数据、校验和导出。
