# Observatory / 观测室

三个 Ogg 文件为本项目原创程序编配的同步循环声部，MP3 是带首尾淡变的独立试听版。配乐无外部采样、无外部录音、无人声。

源谱及合成：`scripts/render-audio.mjs`；音效合成：`src/audio.ts`。
生成数据：`score.json`。随项目采用仓库 LICENSE。

## 逐字输入短音

开场逐字输入使用 `src/audio.ts` 中程序合成的三个 38ms 按键声（确定性噪声与短促高音），不含任何外部采样。
# 待机乐园 / Menu Garden

新增原创主机菜单配乐，96 BPM、C 大调、16 小节、40 秒循环。柔和 FM 键音、交替木琴伴奏、圆润低音与轻节拍；三轨为 `menu-atmosphere.ogg`、`menu-motif.ogg`、`menu-pulse.ogg`，由现有场景混音器控制。设置中的「音乐曲目」可切换并保存选择，原「观测室」继续保留。

源谱、合成音色及循环反射：`scripts/render-menu-audio.mjs`。复现：`node scripts/render-menu-audio.mjs <ffmpeg路径>`。指标见 `menu-score.json`，试听为 `menu-preview.mp3`。未使用外部录音或现有游戏音乐。
