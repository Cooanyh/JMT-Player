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

  tray.setToolTip('济民堂播放器');

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

// 设置系统音量（使用 Windows Core Audio API）
function setSystemVolume(level) {
  // 创建 PowerShell 脚本文件来设置音量
  const volumeScript = `
$code = @'
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int _0(); int _1(); int _2(); int _3();
  int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
  int _5();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

public class Audio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); }
  }
  public static bool Mute {
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, System.Guid.Empty)); }
  }
}
'@
Add-Type -TypeDefinition $code
[Audio]::Mute = $false
[Audio]::Volume = ${level / 100}
`;

  // 将脚本保存为临时文件并执行
  const fs = require('fs');
  const os = require('os');
  const scriptPath = path.join(os.tmpdir(), 'jmt_setvol.ps1');

  fs.writeFileSync(scriptPath, volumeScript, 'utf8');

  exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
    // 清理临时文件
    try { fs.unlinkSync(scriptPath); } catch (e) { }

    if (error) {
      console.error('设置音量失败:', error.message);
      console.log('尝试备用方法...');
      fallbackSetVolume(level);
    } else {
      console.log('系统音量已设置为:', level + '%');
    }
  });
}

// 备用音量设置方法（使用模拟按键）
function fallbackSetVolume(level) {
  const steps = Math.round(level / 2);
  const script = `
$wsh = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt 50; $i++) { $wsh.SendKeys([char]174) }
Start-Sleep -Milliseconds 300
for ($i = 0; $i -lt ${steps}; $i++) { $wsh.SendKeys([char]175) }
`;

  const fs = require('fs');
  const os = require('os');
  const scriptPath = path.join(os.tmpdir(), 'jmt_setvol_fallback.ps1');

  fs.writeFileSync(scriptPath, script, 'utf8');

  exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error) => {
    try { fs.unlinkSync(scriptPath); } catch (e) { }

    if (error) {
      console.error('备用音量设置失败:', error.message);
    } else {
      console.log('系统音量已设置 (备用方法):', level + '%');
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
