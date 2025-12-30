const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec } = require('child_process');

// 持久化存储
const store = new Store({
  defaults: {
    autoLaunch: true,
    autoPlay: true,
    autoVolume: true,
    volumeLevel: 80,
    showFloatingButton: true,
    windowBounds: { width: 1280, height: 800 }
  }
});

let mainWindow = null;
let tray = null;
let isQuitting = false;
let isPlaying = false;

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 创建主窗口
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // 后台不降速，保证音频播放
      webSecurity: true
    },
    show: false,
    autoHideMenuBar: true
  });

  // 加载目标网页
  mainWindow.loadURL('https://player.coren.xin/');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // 自动调整音量
    if (store.get('autoVolume')) {
      setSystemVolume(store.get('volumeLevel'));
    }

    // 自动播放（延迟等待页面加载）
    if (store.get('autoPlay')) {
      setTimeout(() => {
        mainWindow.webContents.send('auto-play');
      }, 3000);
    }
  });

  // 保存窗口大小
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const { width, height } = mainWindow.getBounds();
      store.set('windowBounds', { width, height });
    }
  });

  // 点击关闭按钮隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  updateTrayMenu();

  tray.setToolTip('JMT Player - 济民堂广告播放器');

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 更新托盘菜单
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isPlaying ? '⏸ 暂停' : '▶ 播放',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-play');
        }
      }
    },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '设置',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// 设置系统音量（使用 PowerShell）
function setSystemVolume(level) {
  const script = `
    $volume = ${level / 100};
    $obj = new-object -com wscript.shell;
    # 先静音再调整音量
    1..50 | ForEach-Object { $obj.SendKeys([char]174) }
    Start-Sleep -Milliseconds 100;
    $steps = [math]::Round($volume * 50);
    1..$steps | ForEach-Object { $obj.SendKeys([char]175) }
  `;

  exec(`powershell -Command "${script.replace(/\n/g, ' ')}"`, (error) => {
    if (error) {
      console.error('设置音量失败:', error);
    }
  });
}

// 设置开机自启
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: process.execPath,
    args: ['--hidden']
  });
  store.set('autoLaunch', enable);
}

// IPC 通信处理
ipcMain.handle('get-settings', () => {
  return {
    autoLaunch: store.get('autoLaunch'),
    autoPlay: store.get('autoPlay'),
    autoVolume: store.get('autoVolume'),
    volumeLevel: store.get('volumeLevel'),
    showFloatingButton: store.get('showFloatingButton')
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  if (settings.autoLaunch !== undefined) {
    setAutoLaunch(settings.autoLaunch);
  }
  if (settings.autoPlay !== undefined) {
    store.set('autoPlay', settings.autoPlay);
  }
  if (settings.autoVolume !== undefined) {
    store.set('autoVolume', settings.autoVolume);
  }
  if (settings.volumeLevel !== undefined) {
    store.set('volumeLevel', settings.volumeLevel);
    if (store.get('autoVolume')) {
      setSystemVolume(settings.volumeLevel);
    }
  }
  if (settings.showFloatingButton !== undefined) {
    store.set('showFloatingButton', settings.showFloatingButton);
  }
  return true;
});

ipcMain.on('play-state-changed', (event, playing) => {
  isPlaying = playing;
  updateTrayMenu();
});

ipcMain.on('close-settings', () => {
  // 设置窗口关闭时的处理
});

// 应用生命周期
app.whenReady().then(() => {
  createWindow();
  createTray();

  // 首次运行设置开机自启
  if (store.get('autoLaunch')) {
    setAutoLaunch(true);
  }
});

app.on('window-all-closed', () => {
  // Windows 不退出应用
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// 处理启动参数（隐藏启动）
if (process.argv.includes('--hidden')) {
  app.on('ready', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });
}
