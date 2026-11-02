# 大肥鱼 · 2D 互动动画库

**表情、日常小动作、拎起拖动、屏幕边缘探头。让大肥鱼住进你的屏幕。**

面向桌宠、网页角色、应用助手和嵌入式屏幕的动画素材与交互示例。资源和播放器与具体硬件、语音模型、后端服务解耦。

[在线试玩](https://zhoucode.github.io/dafeiyu-animation-kit/) · [下载 v0.1.0](https://github.com/zhouCode/dafeiyu-animation-kit/releases/tag/v0.1.0) · [动作接入说明](docs/integration.md) · [素材来源与版权](ASSET-NOTICE.md)

> **许可分开处理：工具代码 MIT；角色与动画素材沿用参考来源版权声明，授权状态未确认，不属于 MIT/CC 素材包。** 请先阅读 [LICENSE-SCOPE.md](LICENSE-SCOPE.md)。本项目非 DeepSeek 官方项目。

![31 段动作总览](docs/action-overview.webp)

## 有什么

- **31 段动作，3,638 帧，原生 24 fps**。透明 RGBA WebP 图集、帧边界、锚点、循环区间和 SHA-256 清单。
- 待机、倾听、思考、说话、打盹；开心、害羞、惊讶、生气、难过、好奇；挥手、伸懒腰、跳舞、玩尾巴、贴玻璃、追小鱼。
- 摸头、直立拎起、拎腰弯垂、落地恢复；左右走动、坐下；左右探头与快速缩回。
- 网页示例：逐帧查看、搜索分类、透明背景检查、拖拽、左右出屏后探头、缩回或跳回。鼠标、触摸和键盘均可操作。
- PNG 导出工具、WSP2 打包/解码工具。紧凑资源包可用于小屏幕，也可自行实现其他播放器。

**拖动、下落、走出屏幕和跳回是运行时组合动作，并非额外六段生成视频。** 已停用的底部探头、缩回与跳回不在本版中。素材并非所有循环都达到无缝衔接；AI 生成的手指、头发、服装细节仍可能有轻微变化。

## 三分钟开始

```bash
git clone https://github.com/zhouCode/dafeiyu-animation-kit.git
cd dafeiyu-animation-kit
python -m http.server 8080 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8080>。网页没有 npm 依赖，不需要 API key、GPU、模型下载或后台生成服务。请通过 HTTP 打开，直接双击 HTML 的 `file://` 模式无法正常读取清单。

操作：按住角色拖动，松手落地；双击摸头；选择直立或拎腰模式；用左右探头按钮体验完整衔接。聚焦画布后，空格拎起/松手、方向键移动、Esc 恢复。系统设置了减少动态效果时，首次打开默认暂停。

## 资源与下载

| 内容 | 位置 / 用途 |
| --- | --- |
| RGBA WebP 图集 | `assets/atlases/`，31 个文件，约 61.2 MiB；网页直接加载 |
| 动作清单 | `assets/manifest.json`；不含本机路径或运行配置 |
| 完整图集包 | Release `dafeiyu-atlases-v0.1.0.zip` |
| 透明 PNG 序列 | Release `dafeiyu-png-frames-v0.1.0.zip`，每个动作附时序/锚点清单 |
| 紧凑 WSP2 动画 | Release `dafeiyu-compact-wsp2-v0.1.0.zip`；独立精灵文件，**不是固件或可直接烧录的镜像** |
| SHA-256 | Release `SHA256SUMS.txt` |

常规图集瓦片以 160×160 为主，跳跃/走动/坐下使用 240×240，墙边场景使用 240×320。图集是已经处理过的精灵尺寸，不是原始 448×640 视频。跨平台使用时按元数据摆放，不要分别按每帧可见内容重新裁剪，否则角色会抖动或忽大忽小。

## 最小接入

```js
import { AtlasPlayer } from './src/atlas-player.js';

const response = await fetch('./assets/manifest.json');
const manifest = await response.json();
const player = new AtlasPlayer(manifest, './assets/');
await player.load('idle_calm');
const ctx = document.querySelector('canvas').getContext('2d');
const start = performance.now();
function draw(now) {
  ctx.clearRect(0, 0, 240, 320);
  player.draw(ctx, 'idle_calm', (now - start) / 1000, {x: 120, y: 286});
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
```

画布逻辑坐标为 240×320，示例使用 2 倍绘制分辨率。`AtlasPlayer` 按需加载并限制图集缓存；这个坐标系是参考布局，可按比例映射到任意窗口。详见 [接入与动作衔接](docs/integration.md) 和 [桌宠 / 小屏幕说明](examples/README.md)。

## 导出与验证

Python 3.10+，Node.js 20+（仅运行 JS 测试）：

```bash
python -m pip install -r requirements.txt
python tools/validate_assets.py
npm test
python tools/export_frames.py --output exports/frames
# 也可只导出一段
python tools/export_frames.py --clip happy --output exports/happy
# 将单个导出目录打包为独立 WSP2；调色板量化是有损的
python tools/pack_wsp.py exports/happy/happy exports/happy.wsp
```

为了避免误覆盖，导出工具要求新目录或空目录。没有读取凭据、连接设备或自动烧录的步骤。

## 制作与贡献

这些动作来自基于参考形象的 AI 关键姿势/视频生成及后处理，包含人工筛选、透明化、位置配准、拎腰比例和左右贴边调整。制作记录见 [provenance.md](docs/provenance.md)。模型权重、设备备份、完整固件、私人配置和语音数据不在仓库内。

欢迎提交播放器、格式工具和交互体验改进。新增角色素材时请同时说明作者、来源和明确许可；不要把参考站的代码许可证当作图片许可证。反馈动作问题请附动作 ID、帧号及复现步骤。

## English

Dafeiyu Animation Kit provides 31 transparent 2D clips (3,638 frames at 24 fps),
a dependency-free browser player, drag/drop and edge-peeking examples, and PNG /
WSP2 conversion tools. Suitable for web companions, desktop-pet integrations and
small displays; it is not a complete native desktop-pet application.

**Software is MIT licensed. Character artwork is excluded.** The reference
archive lists the original artist and authorization as unknown. Read
[ASSET-NOTICE.md](ASSET-NOTICE.md) before using or redistributing the artwork.
