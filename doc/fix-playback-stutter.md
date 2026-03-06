# 修复播放器长时间播放卡顿问题 - 进展文档

**日期**: 2026-03-06  
**版本**: v1.7.0 → v1.7.1 → v1.7.2

## v1.7.2 — 真正的根因修复

### 问题根因（由用户截图确认）
网页 `syncPlayerState` 每 500ms 运行，检测到 **myhk 在播放但网页 `isPlaying==false`** 时强制暂停 myhk。我们的 PlaybackGuard 用 `media.play()` 恢复，但**不会更新网页 `isPlaying`**，导致 500ms 后再次被暂停——形成**播放-暂停死循环**。

### 修复方案
- **核心修复**：新增 `resumePlaybackViaUI()` 函数，所有恢复操作改为**点击网页播放按钮**
- 点击按钮触发 `handlePlayback()` → 正确设置 `isPlaying=true` → 消除状态冲突
- 增加切歌过渡期保护 (`songTransitioning`) 和并发恢复保护 (`isRecovering`)
- 意外暂停后 800ms 内通过 UI 快速恢复

## v1.7.1 — 初步优化（已包含在 v1.7.2 中）
- 修复 blobMap 内存泄漏
- 心跳检测阈值 60s → 120s
- 音频保活每 10 分钟确保未静音
- 降低播放状态轮询频率 1s → 3s

## 验证
- ✅ 语法检查通过
- ✅ Git push 成功
- ✅ 打包完成：`dist/济民堂播放器 1.7.2.exe` + `dist/济民堂播放器 Setup 1.7.2.exe`
- ⏳ 需用户长时间播放测试验证
