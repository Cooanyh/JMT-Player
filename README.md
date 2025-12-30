# JMT Player

济民堂广告播放控制桌面客户端 - 基于 Electron 开发的 Windows 桌面应用。

## 功能特性

- 🎵 内嵌 [player.coren.xin](https://player.coren.xin/) 网页播放器
- ⚙️ 悬浮设置按钮，便捷访问设置
- 🚀 开机自动启动
- 🔊 启动时自动调整系统音量
- ▶️ 启动后自动开始播放
- 📌 关闭窗口隐藏到系统托盘
- 🎛️ 托盘右键菜单控制播放/暂停

## 安装使用

### 下载安装
从 [Releases](https://github.com/Cooanyh/JMT-Player/releases) 页面下载最新版本的安装程序。

### 开发运行
```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 打包构建
npm run build
```

## 设置说明

点击右下角的悬浮设置按钮可以访问以下设置：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| 开机自启动 | Windows 启动时自动运行应用 | 开启 |
| 自动播放 | 应用启动后自动开始播放 | 开启 |
| 自动调整音量 | 启动时调整系统音量到指定值 | 开启 |
| 目标音量 | 自动调整的目标音量 | 80% |

## 系统托盘

- **双击托盘图标**：显示主窗口
- **右键托盘图标**：
  - 播放/暂停
  - 打开主窗口
  - 设置
  - 退出

## 技术栈

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [electron-store](https://github.com/sindresorhus/electron-store) - 持久化配置存储
- [electron-builder](https://www.electron.build/) - 应用打包工具

## 许可证

MIT License
