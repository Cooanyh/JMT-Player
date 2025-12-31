const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, session, dialog, powerSaveBlocker } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

// 允许跨域音频访问（用于 OfflineAudioContext 混音）
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');
// 禁用后台节流，保持应用活跃
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// 持久化存储
const store = new Store({
  defaults: {
    autoLaunch: true,
    autoPlay: true,
    autoVolume: true,
    volumeLevel: 80,
    showFloatingButton: true,
    windowBounds: { width: 1280, height: 800 },
    pendingUpdateVersion: null  // 存储检测到的待更新版本
  }
});

let mainWindow = null;
let tray = null;
let isQuitting = false;
let isPlaying = false;
let powerSaveBlockerId = null; // 电源保持锁 ID

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
      backgroundThrottling: false,
      webSecurity: true,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    },
    show: false,
    autoHideMenuBar: true
  });

  // 加载目标网页
  mainWindow.loadURL('https://player.coren.xin/');

  // 监听渲染进程崩溃
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('渲染进程崩溃:', details.reason);
    if (details.reason !== 'clean-exit') {
      mainWindow.reload();
    }
  });

  // 监听页面崩溃
  mainWindow.webContents.on('crashed', () => {
    console.error('页面崩溃，重新加载');
    mainWindow.reload();
  });

  // 监听页面加载失败 - 自动重试
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('页面加载失败:', errorCode, errorDescription);
    // 延迟3秒后重新加载
    setTimeout(() => {
      console.log('尝试重新加载页面...');
      mainWindow.loadURL('https://player.coren.xin/');
    }, 3000);
  });

  // 页面加载完成后触发自动播放
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
    if (store.get('autoPlay')) {
      setTimeout(() => {
        mainWindow.webContents.send('auto-play');
        console.log('发送自动播放指令');
      }, 2000);
    }
  });

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

  // 处理下载
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // 弹出保存对话框让用户选择保存位置
    const fileName = item.getFilename();

    dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName,
      filters: [
        { name: '所有文件', extensions: ['*'] }
      ]
    }).then(result => {
      if (!result.canceled && result.filePath) {
        item.setSavePath(result.filePath);

        item.on('updated', (event, state) => {
          if (state === 'progressing') {
            if (!item.isPaused()) {
              const progress = item.getReceivedBytes() / item.getTotalBytes();
              mainWindow.setProgressBar(progress);
            }
          }
        });

        item.once('done', (event, state) => {
          mainWindow.setProgressBar(-1);
          if (state === 'completed') {
            console.log('下载完成:', result.filePath);
          } else {
            console.log('下载失败:', state);
          }
        });
      } else {
        item.cancel();
      }
    });
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  updateTrayMenu();

  tray.setToolTip('济民堂播放器');

  // 左键单击托盘图标显示窗口
  tray.on('click', () => {
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
    {
      label: '刷新页面',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.reload();
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

  // 初始化自动更新
  initAutoUpdater();

  // 启用电源保持锁 - 防止系统休眠和息屏
  initPowerSaveBlocker();

  // 启动心跳检测
  initHeartbeat();

  // 阻止系统休眠（通过 Windows API）
  preventSystemSleep();
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

// Blob 文件保存处理
ipcMain.handle('save-blob-file', async (event, { data, filename, mimeType }) => {
  const fs = require('fs');

  try {
    let filters = [{ name: '所有文件', extensions: ['*'] }];
    if (mimeType && mimeType.includes('audio')) {
      filters.unshift({ name: 'MP3 音频', extensions: ['mp3'] });
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: filters
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 打开外部链接
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// ==================== 自动更新功能 ====================

// 更新状态
let updateInfo = null;
let updateDownloaded = false;

// 初始化自动更新
function initAutoUpdater() {
  // 配置日志
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false; // 不自动下载，让用户确认
  autoUpdater.autoInstallOnAppQuit = true; // 退出时自动安装

  // 检查更新事件
  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    console.log('发现新版本:', info.version);
    updateInfo = info;

    // 存储待更新版本
    store.set('pendingUpdateVersion', info.version);

    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }

    // 显示更新弹窗
    showUpdateDialog(info.version);
  });

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    console.log('已是最新版本');
    // 清除待更新版本标记（说明已经是最新版本）
    store.set('pendingUpdateVersion', null);
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    console.log(`下载进度: ${progress.percent.toFixed(1)}%`);
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      });
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('更新下载完成');
    updateDownloaded = true;
    // 清除待更新版本标记
    store.set('pendingUpdateVersion', null);
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
  });

  // 更新错误
  autoUpdater.on('error', (error) => {
    console.error('更新错误:', error.message);
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send('update-error', error.message);
    }
  });

  // 延迟5秒后自动检查更新
  setTimeout(() => {
    checkForUpdates(true);
  }, 5000);

  // 启动时检查是否有待更新版本，如果有则显示弹窗
  const pendingVersion = store.get('pendingUpdateVersion');
  if (pendingVersion) {
    console.log('检测到待更新版本:', pendingVersion);
    setTimeout(() => {
      showUpdateDialog(pendingVersion);
    }, 3000);
  }
}

// 检查更新
function checkForUpdates(silent = false) {
  // 检查是否在开发模式
  if (!app.isPackaged) {
    console.log('开发模式，跳过更新检查');
    if (!silent && mainWindow) {
      mainWindow.webContents.send('update-dev-mode');
    }
    return;
  }

  try {
    autoUpdater.checkForUpdates().catch(err => {
      if (!silent) {
        console.error('检查更新失败:', err.message);
      }
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message);
      }
    });
  } catch (error) {
    if (!silent) {
      console.error('检查更新异常:', error.message);
    }
    if (mainWindow) {
      mainWindow.webContents.send('update-error', error.message);
    }
  }
}

// IPC: 获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC: 检查更新
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 下载更新
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 安装更新并重启
ipcMain.handle('install-update', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

// IPC: 获取更新状态
ipcMain.handle('get-update-status', () => {
  return {
    updateInfo,
    updateDownloaded
  };
});

// ==================== 电源保持与防休眠 ====================

// 初始化电源保持锁
function initPowerSaveBlocker() {
  // 防止应用挂起（播放音频时很重要）
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  console.log('电源保持锁已启用, ID:', powerSaveBlockerId);

  // 同时启用防止显示器关闭
  const displayBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  console.log('防止显示器休眠已启用, ID:', displayBlockerId);
}

// 心跳检测 - 定期检查渲染进程状态
function initHeartbeat() {
  let lastPongTime = Date.now();

  // 监听心跳响应
  ipcMain.on('heartbeat-pong', () => {
    lastPongTime = Date.now();
  });

  // 每30秒发送心跳
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('heartbeat-ping');

      // 检查是否超过60秒没有响应
      if (Date.now() - lastPongTime > 60000) {
        console.warn('渲染进程无响应，尝试重载页面');
        lastPongTime = Date.now(); // 重置，避免连续重载
        mainWindow.reload();
      }
    }
  }, 30000);

  console.log('心跳检测已启动');
}

// 阻止系统休眠（Windows 特定）
function preventSystemSleep() {
  // 使用 PowerShell 调用 Windows API 阻止休眠
  const sleepScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PowerState {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);
    
    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
    public const uint ES_DISPLAY_REQUIRED = 0x00000002;
    
    public static void PreventSleep() {
        SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
    }
}
"@
[PowerState]::PreventSleep()
`;

  const fs = require('fs');
  const os = require('os');
  const scriptPath = path.join(os.tmpdir(), 'jmt_prevent_sleep.ps1');

  fs.writeFileSync(scriptPath, sleepScript, 'utf8');

  exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error) => {
    try { fs.unlinkSync(scriptPath); } catch (e) { }

    if (error) {
      console.error('防休眠设置失败:', error.message);
    } else {
      console.log('系统防休眠已启用');
    }
  });

  // 每5分钟刷新一次防休眠状态
  setInterval(() => {
    fs.writeFileSync(scriptPath, sleepScript, 'utf8');
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, () => {
      try { fs.unlinkSync(scriptPath); } catch (e) { }
    });
  }, 300000);
}

// 心跳 IPC
ipcMain.on('heartbeat-pong', () => {
  // 已在 initHeartbeat 中处理
});

// ==================== 更新弹窗引导 ====================

// 显示更新弹窗
function showUpdateDialog(version) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const currentVersion = app.getVersion();

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '发现新版本',
    message: `济民堂播放器有新版本可用！`,
    detail: `当前版本: v${currentVersion}\n最新版本: v${version}\n\n建议您立即更新以获得最佳体验。`,
    buttons: ['立即更新', '稍后提醒'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      // 用户点击"立即更新"
      console.log('用户选择立即更新');
      // 触发下载更新
      autoUpdater.downloadUpdate().then(() => {
        console.log('开始下载更新');
      }).catch(err => {
        console.error('下载更新失败:', err.message);
        // 下载失败，打开 Gitee 下载页面
        shell.openExternal(`https://gitee.com/coren01/JMT-Player/releases/tag/v${version}`);
      });
    } else {
      // 用户点击"稍后提醒"，保持 pendingUpdateVersion
      console.log('用户选择稍后更新，下次启动将继续提醒');
    }
  });
}
