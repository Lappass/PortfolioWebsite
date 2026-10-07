# 游戏主机外观重制

2026-10-07。用户明确允许本轮直接使用本机 Blender 脚本制作，作为本轮 Blender MCP 要求的例外。

`art/console_setup.py` 生成横放式光驱主机：带收边的上下外壳、内缩黑色机架、橡胶脚垫、开放式光驱入口、导入口唇边、侧面散热鳍片、顶部格栅、前置 USB-C / USB-A、电源按钮和背部接口。使用现有冷白外壳与石墨机架方向，保留显示器与台面。

运行（Blender 5.1.1）：

```powershell
& 'D:/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python art/console_setup.py
```

输出：`art/console-setup.blend` 保存独立可编辑零件；`public/assets/console-setup.glb` 在导出前按材质合并主机静态零件；`art/console-setup-studio.png` 为全景，`art/console-detail.png` 为近景。

## 验证

- Blender Cycles 全景与近景渲染完成并检查。
- GLB 共 12 个网格、22,271 个三角面、1,470,580 字节（约 1.40 MiB）。未使用外部贴图。
- `Console_Slot` 保留原 glTF 坐标 `(-0.25, 0.475, 1.3)`；`Slot_Light`、`Monitor_Screen` 和屏幕 UV 保留。现有 Three.js 载入与插盘代码无需修改。
- `npm run build` 通过，包括 TypeScript、Vite 与 PWA 打包；仍有既有大体积 JS chunk 提示。
- 本机无头 Edge，1600×900：打开详情，点击查看详细信息，光盘进入主机，镜头转向屏幕并进入 `#/work/x-001`；Esc 返回完成。无页面脚本错误。截图见 `verification/console-web-insert.png`。
- 未进行手机实机性能测试。外观为本轮制作结果，仍可根据用户反馈调整。
