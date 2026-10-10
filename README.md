# LAPPAS · 作品集

陈澍航（Shuhang Chen / Lappas）的游戏开发作品集网站。作品像游戏盒一样陈列在一排三维货架上；打开一个作品，光盘会插进主机，在显示器上读盘加载，再进入作品详情页。

> 本项目基于 [LBEILC/RhineLabUI](https://github.com/LBEILC/RhineLabUI)（MIT）二次开发。三维阵列、玻璃材质、拖动惯性、性能优化等基础来自原项目，详见文末[致谢](#致谢)。原项目中的《明日方舟》相关内容（名称、标志、设定文案、原片音效与参考资料）均已移除。

## 体验流程

1. **开机**：按任意键开机。冷色星云聚拢，`> _` 标志左右两半扣合，星云炸开成暖色光尘，名字逐字浮现，第一件精选作品的游戏盒在顶光下显形。
2. **首页**：镜头从游戏盒特写拉远，其余精选作品从四周升起。方向键、拖动或滚轮浏览，Enter 打开。
3. **作品**：盒子抽出、盒盖打开、光盘滑出；点「查看详细信息」，光盘插入主机，镜头移到显示器读盘，详情页从屏幕中展开。
4. **其他**：「关于」进入个人页；EXPERIMENTS 打开实验作品合集；支持检索、收藏、深浅色与画质设置、音乐和音效开关。

## 快速运行

```bash
npm install
npm run dev        # 开发服务器 http://127.0.0.1:5173
npm run build      # 生产构建，输出到 dist/
npm run preview    # 预览生产构建
```

需要 Node.js 20 以上。

## 修改内容

| 文件 | 内容 |
| --- | --- |
| [content/archives.json](content/archives.json) | 作品列表：标题、分类、简介、要点、封面、主视觉、画廊、视频、Unity WebGL、链接；`featured` 决定首页陈列的作品。写法见 [content/README.md](content/README.md) |
| [content/profile.json](content/profile.json) | 个人信息与开场文字：名字、身份、简介、技能、经历、联系方式、简历 |
| `public/works/<编号>/` | 作品的图片、视频与 Unity 构建 |

修改作品后运行 `npm run check:content` 校验格式。

## 技术与资源

- **TypeScript + Three.js + Vite**，不使用前端框架，三维场景实时渲染。
- **模型**由 Blender 脚本生成，源文件一并保留：游戏盒 [art/game_case.py](art/game_case.py)，主机、显示器与桌台 [art/console_setup.py](art/console_setup.py)。导出后运行 `npm run compress:console` 压缩（meshopt + WebP）。
- **声音**全部为程序合成的原创配乐和音效，见 [public/audio/README.md](public/audio/README.md)。
- **PWA**：首次只缓存约 1.6 MB 核心文件，其余资源按需缓存，见 [docs/PWA.md](docs/PWA.md)。

## 部署

项目是纯静态网站，[vercel.json](vercel.json) 已配置构建命令、输出目录和缓存规则。在 Vercel 导入本仓库即可自动部署，`main` 分支为正式站。

## 致谢

- 原项目 [LBEILC/RhineLabUI](https://github.com/LBEILC/RhineLabUI)，MIT 协议，版权声明见 [LICENSE](LICENSE)。
- 原项目 PR #15 的渲染优化，贡献者 PacificSauryMan，见 [PR15-ATTRIBUTION.md](PR15-ATTRIBUTION.md)。
- 内容数据分离的建议来自 [@Tomahawkd](https://github.com/LBEILC/RhineLabUI/pull/3)。
- 手柄模型为自有设计（[art/controller-design.svg](art/controller-design.svg)），由 Meshy 生成，见 [public/model-credits.html](public/model-credits.html)。
- 字体 MiSans（小米），使用 `misans-webfont` 分包，许可见 `public/fonts`。
- 滚动数字 [@kitlangton/rolling-number](https://github.com/kitlangton/rolling-number)，许可见 [public/licenses/rolling-number.txt](public/licenses/rolling-number.txt)。
