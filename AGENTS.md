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
