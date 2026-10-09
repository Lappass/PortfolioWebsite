# 待机乐园 / Menu Garden

网站当前唯一 BGM 为第二版原创主机菜单配乐，96 BPM、16 小节、40 秒循环。温暖和弦转位、带停顿的旋律问答、柔和 FM 键音、低音木琴伴奏与轻节拍；无外部录音或现有游戏旋律。

三轨 atmosphere.ogg、motif.ogg、pulse.ogg 共用时钟，由现有场景混音器控制。设置仅提供音乐开关与音量，不提供选曲；旧版曲目偏好不再读取。

源谱、合成音色及循环反射：scripts/render-menu-audio.mjs。复现：node scripts/render-menu-audio.mjs <ffmpeg路径>。指标见 score.json，试听为 menu-preview.mp3。随项目采用仓库 LICENSE。原配乐生成脚本 scripts/render-audio.mjs 仅保留为历史源谱，不用于当前发行资源。

## 逐字输入短音

开场逐字输入使用 src/audio.ts 中程序合成的三个 38ms 按键声（确定性噪声与短促高音），不含任何外部采样。
