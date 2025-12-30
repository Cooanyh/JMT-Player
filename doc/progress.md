# JMT Player 开发进展文档

## 项目信息
- **项目名称**: 济民堂播放器 (JMT Player)
- **当前版本**: 1.1.0
- **仓库**: https://github.com/Cooanyh/JMT-Player

## v1.1.0 更新 (2025-12-30)

### 更新内容
1. ✅ 快捷图标名称改为中文：**济民堂播放器**
2. ✅ Logo 更新为新图标 `jmt.webp`
3. ✅ 修复系统音量控制功能（使用 Windows Core Audio API）
4. ✅ 添加 MIT License
5. ✅ 重新构建 exe 文件
6. ✅ 代码已推送到 GitHub

### 构建产物
位于 `dist/` 目录：
- `济民堂播放器 1.1.0.exe` - 便携版（无需安装）
- `济民堂播放器 Setup 1.1.0.exe` - 安装程序

---

## v1.0.0 初始版本 (2025-12-30)

### 功能特性
- 内嵌 player.coren.xin 网页播放器
- 悬浮设置按钮（右下角）
- 开机自启动（默认开启）
- 启动时自动调整系统音量
- 启动后自动播放
- 关闭窗口隐藏到系统托盘
- 托盘右键菜单控制播放/暂停

---

## 发布 Release 指南

1. 访问 https://github.com/Cooanyh/JMT-Player/releases/new
2. **Tag**: `v1.1.0`
3. **Title**: `济民堂播放器 v1.1.0`
4. **Description**:
   ```
   ## 更新内容
   - 🎨 快捷图标和名称改为中文
   - 🖼️ 更新应用 Logo
   - 🔊 修复系统音量调节功能
   - 📜 添加 MIT License

   ## 下载
   - `济民堂播放器 1.1.0.exe` - 便携版
   - `济民堂播放器 Setup 1.1.0.exe` - 安装程序
   ```
5. 上传 `dist` 目录下的两个 exe 文件
6. 发布

---
*更新时间: 2025-12-30*
