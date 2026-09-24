# 回程 / ReturnTrip

中文悬疑微恐文字 AVG，**0.11 开篇重写初稿**，共五章：《明天见》《等一会儿》《带上东西》《先下来》《照片里的位置》。约一万字，公交卡与身份线重新接回原作。建议从第一章开始；第五章试读包含前文剧透。

详见 docs/0.11开篇重写说明.md。保留低音量敲击、来信独立阅读步骤和说话人轻微配色；第四章加入连续警告造成的决策压力，没有强制倒计时或突然巨响。

## 运行和操作

可直接在浏览器打开 `app/index.html` 预览；Windows 独立版用下面的脚本打包后，打开发行目录里的 `回程.exe`。移动独立版时保留整个目录。

- 点击画面 / 空格 / Enter：补全文字，再次操作推进；关键演出期间暂缓推进。
- ← 上一句；H 回看（包括手机消息）；A 自动；S 保存；L 读取；Esc 设置；F11 全屏。
- 字号、逐字速度、音量、自动等待与演出停顿均可调。
- 存档保存在本机，支持三手动槽位和进度文件导入导出。0.11使用独立存储与桌面程序用户目录，不覆盖旧版；因正文重排，不兼容0.7—0.10进度。请从第一章重新阅读。

## 开发

其他设备或 agent 接手时，先读 [创作交接](docs/创作交接.md) 和根目录 `AGENTS.md`。当前创作意图、用户已确认的取舍、未决谜题与后续约束均保存在仓库中。

需要 Node.js 22 或更新版本。没有构建依赖，也不必先运行 npm install。

```powershell
node app/build.cjs
node --test app/test.cjs
node tools/export-reading.cjs
```

- `story/`：可编辑剧本。`@ { ... }` 行只包含演出参数，不显示给玩家。
- `app/story.js`：从剧本生成的完整阅读数据，已提交，可以直接试玩。
- `app/app.js`：阅读、声音、短时演出与存读档。
- `app/knock.js`：敲击合成，区分隔墙、室内、门板、远处和手机免提。
- `app/assets/`：背景、图标及尚未接入剧情的角色素材。
- `docs/`：测试记录和美术生成提示词。

阅读稿默认导出到 `work/reading`。给 `tools/export-reading.cjs` 传入目录参数可另存到指定位置。

程序不联网，不含统计或远程字体。

## Windows 打包

PowerShell 7 或 Windows PowerShell 5.1，运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools/package-win.ps1
```

脚本从 Electron 官方 GitHub release 下载固定的 **44.4.5 / win32-x64** 运行库，校验 SHA-256 后生成 `dist/ReturnTrip-0.11.0-win32-x64/回程.exe` 和 zip。也可用 `-RuntimeArchive 路径` 指定已下载的原始 Electron zip，仍会校验。为避免覆盖，目标发行目录已存在时脚本会停止，可用 `-OutputDirectory` 指定另一个目录。

仓库提交源码与美术，未将数百 MB 的 Electron 二进制提交进 Git。

## 验证

`node --test app/test.cjs` 检查全文路径、存档恢复、非法进度、场景素材、敲击波形和演出参数。实际 Electron 验证可运行：

```powershell
& 'dist/ReturnTrip-0.11.0-win32-x64/回程.exe' --qa-test
```

QA 使用临时独立存档，检查两种窗口大小、大字号、完整阅读、交互、音效触发与消息延时，截图和报告写入当前目录的 `work/qa-v11`。本轮执行结果见 `docs/验证记录.md`；程序检查不等于主观恐怖体验或后续全篇诡计已经定稿。

当前没有人物配音、背景音乐或第六章。背景采用 AI 辅助生成，音效为程序合成；系统幼圆字体不随游戏分发。故事与后续内容仍在制作。
