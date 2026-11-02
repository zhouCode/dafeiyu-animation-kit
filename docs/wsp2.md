# WSP2 独立动画格式

全部整数为 little endian。文件不是固件，不含设备配置。

| 区段 | 格式 |
| --- | --- |
| 头部（20字节） | `4s8H`：magic=`WSP2`，version=2，width，height，frameCount，paletteCount，fps，loopFlag，reserved |
| RGBA 调色板 | `paletteCount × 4` 字节，R/G/B/A；索引0通常透明 |
| 偏移表 | `frameCount+1` 个 uint32，文件绝对偏移；最后一个为文件长度 |
| 每帧头 | `BBH`：keyframe标志、reserved、durationMs |
| 每帧数据 | zlib 压缩的 `width×height` 个调色板索引；非关键帧为与上一帧索引数据的 XOR |

解码关键帧直接作为索引缓冲；解码增量帧与上一帧逐字节 XOR。随机跳帧应从前一个关键帧开始。`tools/wsp.py` 提供带边界检查的参考解码器，`tools/pack_wsp.py` 可从 PNG 序列构建一个独立文件。

WSP2 头部仅保存是否循环，精确循环区间与角色锚点属于外部 manifest。compact Release 的 metadata 来自现有小尺寸精灵：`pixelScale` 表示对 `nativeSize` 的采样缩放；`anchor` 是裁剪后的原始坐标，映射到压缩像素时乘 `pixelScale`。`displayScale` 为额外展示缩放。若希望与网页保持统一视觉尺寸，先按 nativeSize 恢复再应用 displayScale 和场景整体缩放。

`pack_wsp.py` 新导出的文件保持 PNG 原画布尺寸，不执行 compact Release 的历史裁剪流程；因此输出不会与已发布紧凑文件逐字节相同。量化减少颜色数是有损步骤，回解测试验证的是量化后的像素，不宣称与原 RGBA 完全相同。
