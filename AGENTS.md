# LAPPAS 作品集

## 项目与归属

- 陈澍航（Shuhang Chen / Lappas，GitHub `Lappass`）的游戏开发作品集网站，仓库 `Lappass/PortfolioWebsite`，`main` 为正式分支，计划部署在 Vercel。
- 基于 `LBEILC/RhineLabUI`（MIT，版权归 LBEILC）二次开发。保留 `LICENSE`、`PR15-ATTRIBUTION.md`、`public/model-credits.html` 与 README 中的致谢。LBEILC 的 GitHub 和 `lubeiluchen.cc` 域名不属于本作者，不要当作本作者的链接或域名使用。
- 不得引入《明日方舟》或其他 IP 的名称、标志、文案、音频或参考素材；借鉴主机开机等风格时只借用节奏与氛围。

## 技术

- TypeScript、Three.js、Vite，不使用前端框架。只维护网页版本。
- 模型通过 Blender 脚本生成并保留源文件：`art/game_case.py`、`art/console_setup.py`（导出后运行 `npm run compress:console`）。
- 内容：作品 `content/archives.json`（写法见 `content/README.md`），个人信息与开场文字 `content/profile.json`。修改后运行 `npm run check:content`。
- 声音为程序合成的原创配乐与音效，见 `public/audio/README.md`。
- 视觉与交互规范见 `DESIGN.md`。

## 工作方式

- 改动后运行 `npx tsc --noEmit` 与 `npm run build`；界面改动需在浏览器中实际走一遍开场、首页、打开作品、插盘、详情页与个人页。
- 提交聚焦当前任务；推送到远端前先征得用户确认。

## 桌面动效（2026-10-10）

- 用户试用后撤回「桌面常驻主页」：主页只保留游戏盒阵列，桌面仍只在插盘和个人页出现，不要再把桌面放进主页背景。显示器待机封面画面随之删除。
- 用户要求小人全程出现（个人页除外，那里已有粒子头像），并提供了 Meshy 绑骨导出的九个动作（`Rigged/`，每个动作一个 GLB，同一套 mixamorig 骨骼）。`art/figure_rig.py` 把它们合并成一个带全部动画的模型并修正手臂：原动作按细长体型制作，直接用在大头短臂的体型上手臂会缩进卫衣、手穿出裤子，脚本逐帧把下垂的上臂向外摆到离身体约 34°，抬起的手臂不改。`npm run compress:figure` 输出 `public/assets/figure.glb`（约 0.5 MB）。
- 小人按状态换位置（位置为用户指定）：主页坐在当前选中的盒子顶沿、腿搭在封面外，换作品时跳到新选中的盒子，座位取盒子的实际姿态以免穿模；开场和打开盒子后跳到盒子脚边、光盘右下方并抬头看光盘；换位置的路线先升后移、最后下落，从盒顶上方越过。主页阵列为此下移，使小人不被站点标题遮挡。
- 插盘由小人完成（用户提出，先后否定了「飞过去」的原版和「在后面推」的版本，选定背着走）：光盘先升到小人头顶以上并移到桌面前沿外侧，转成侧立，再竖直落到小人背后像一面盾；小人弓身、双手后伸扶着盘沿，沿手柄垫与桌边之间的通道跑到主机前（run），光盘升到槽口高度，小人转身踮脚把它送进光驱槽，随后跳到主机旁看屏幕。各阶段进度由 `src/game-case.ts` 的 `discCarry` 统一给出，光盘与小人共用。顺序是为避免穿模定的：先升后转、小人始终在盘面前方、光盘绕开手柄。插盘时间轴在背盘和前后跳跃阶段放慢（用户要求整体慢一些），全程约 8.5 秒，弹出仍为快速倒放。个人页没有插盘时小人站在显示器左前方。
- 动作：坐用 sit、站用 idle、换位置按进度播放 jump、开场挥手（wave）、站立时偶尔张望（look）、秘技「上上下下左右左右 B A」欢呼（cheer）并触发一次阵列波浪。头部骨骼单独跟随指针或光盘；待机轮播时低头打瞌睡。动作自带的位移在加载时去掉，位置全部由场景控制。实现见 `src/figure.ts` 与 `src/scene.ts` 的 `placeFigure`；收藏为空时显示平面图 `figure.webp`。`Rigged/` 原始文件只留在本机，不进仓库。
- 手柄为用户自有设计（`art/controller-design.svg`）经 Meshy 生成，`art/console_setup.py` 把摇杆、方向键、ABXY 与 Home 键拆成独立部件。方向键倾斜左摇杆和十字键，Enter／Esc 按下 A／B；实体手柄（Gamepad API）可翻作品、A 进入、B 返回，逻辑在 `src/pad-input.ts`。
- 屏幕平均色驱动一盏点光照亮桌面；滑动阵列时游戏盒按速度后仰再回正；读盘期间镜头继续推近到屏幕接近占满。
- 验证使用无头 Edge 逐帧截图；实体手柄未做实机测试，动效流畅度待用户确认。
