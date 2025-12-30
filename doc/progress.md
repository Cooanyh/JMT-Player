# JMT Player 开发进展文档

## 项目信息
- **项目名称**: JMT Player (济民堂广告播放器)
- **版本**: 1.0.0
- **仓库**: https://github.com/Cooanyh/JMT-Player

## 完成状态

### ✅ 已完成功能

1. **基础框架**
   - [x] Electron 项目初始化
   - [x] 主进程 (main.js) 实现
   - [x] 预加载脚本 (preload.js) 实现

2. **核心功能**
   - [x] 加载 https://player.coren.xin/ 网页
   - [x] 悬浮设置按钮（右下角，紫色渐变设计）
   - [x] 设置界面（模态框形式）

3. **设置选项**
   - [x] 开机自启动（默认开启）
   - [x] 启动后自动播放
   - [x] 自动调整系统音量（0-100%可调）
   - [x] 设置持久化存储

4. **系统托盘**
   - [x] 托盘图标和菜单
   - [x] 点击关闭隐藏到托盘
   - [x] 双击托盘图标显示窗口
   - [x] 右键菜单：播放/暂停、打开主窗口、设置、退出

5. **播放控制**
   - [x] 与网页播放按钮联动
   - [x] 托盘菜单播放/暂停控制
   - [x] 自动播放功能

6. **资源优化**
   - [x] 后台不降速 (backgroundThrottling: false)
   - [x] 单实例锁
   - [x] 隐藏启动参数支持 (--hidden)

7. **打包发布**
   - [x] 便携版 exe (JMT Player 1.0.0.exe)
   - [x] 安装包 (JMT Player Setup 1.0.0.exe)
   - [x] 代码推送到 GitHub

## 构建产物

位于 `dist/` 目录：
- `JMT Player 1.0.0.exe` - 便携版本（可直接运行）
- `JMT Player Setup 1.0.0.exe` - 安装程序

## 技术栈

- **框架**: Electron 28.1.0
- **存储**: electron-store 8.1.0
- **打包**: electron-builder 24.9.1

## 待办事项

- [ ] 发布 GitHub Release（需手动上传 dist 目录下的 exe 文件）

## 使用说明

### 开发调试
```bash
npm install
npm start
```

### 构建发布
```bash
npm run build
```

### 发布 Release

1. 访问 https://github.com/Cooanyh/JMT-Player/releases
2. 点击 "Draft a new release"
3. 创建标签 `v1.0.0`
4. 标题: `JMT Player v1.0.0`
5. 上传以下文件:
   - `dist/JMT Player 1.0.0.exe` (便携版)
   - `dist/JMT Player Setup 1.0.0.exe` (安装包)
6. 发布

---
*更新时间: 2025-12-30*
