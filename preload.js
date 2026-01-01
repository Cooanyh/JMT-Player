const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('jmtAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onAutoPlay: (callback) => ipcRenderer.on('auto-play', callback),
  onTogglePlay: (callback) => ipcRenderer.on('toggle-play', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  notifyPlayState: (playing) => ipcRenderer.send('play-state-changed', playing),
  saveBlobFile: (data, filename, mimeType) => ipcRenderer.invoke('save-blob-file', { data, filename, mimeType }),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  // 自动更新 API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  onUpdateDevMode: (callback) => ipcRenderer.on('update-dev-mode', callback)
});

// 页面加载完成后注入功能
window.addEventListener('DOMContentLoaded', () => {
  console.log('JMT Player preload script loaded');

  // 等待页面完全加载
  setTimeout(() => {
    initFloatingButton();
    initPlaybackControl();
    initSettings();
    initBlobDownload();
    initMixRedirect();
    initPlaybackGuard();  // 播放保持机制
    initHeartbeatResponse();  // 心跳响应
  }, 1000);
});

// 初始化悬浮设置按钮
async function initFloatingButton() {
  const settings = await ipcRenderer.invoke('get-settings');

  // 创建悬浮按钮容器
  const floatingBtn = document.createElement('div');
  floatingBtn.id = 'jmt-floating-btn';
  floatingBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
      <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
    </svg>
  `;

  // 样式
  const style = document.createElement('style');
  style.textContent = `
    #jmt-floating-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      z-index: 99999;
      transition: all 0.3s ease;
      opacity: 0.85;
    }
    
    #jmt-floating-btn:hover {
      transform: scale(1.1);
      opacity: 1;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    
    #jmt-floating-btn svg {
      transition: transform 0.3s ease;
    }
    
    #jmt-floating-btn:hover svg {
      transform: rotate(90deg);
    }
    
    #jmt-settings-panel {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      backdrop-filter: blur(5px);
    }
    
    #jmt-settings-panel.show {
      display: flex;
    }
    
    .jmt-settings-content {
      background: white;
      border-radius: 16px;
      padding: 30px;
      width: 400px;
      max-width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .jmt-settings-title {
      font-size: 24px;
      font-weight: 600;
      color: #333;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .jmt-settings-title svg {
      fill: #667eea;
    }
    
    .jmt-setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }
    
    .jmt-setting-item:last-child {
      border-bottom: none;
    }
    
    .jmt-setting-label {
      font-size: 15px;
      color: #333;
    }
    
    .jmt-setting-desc {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    
    .jmt-toggle {
      position: relative;
      width: 50px;
      height: 26px;
      background: #ddd;
      border-radius: 13px;
      cursor: pointer;
      transition: background 0.3s;
    }
    
    .jmt-toggle.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .jmt-toggle::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    .jmt-toggle.active::after {
      transform: translateX(24px);
    }
    
    .jmt-volume-control {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .jmt-volume-slider {
      width: 100px;
      height: 6px;
      -webkit-appearance: none;
      background: linear-gradient(to right, #667eea 0%, #667eea var(--value), #ddd var(--value), #ddd 100%);
      border-radius: 3px;
      outline: none;
    }
    
    .jmt-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      background: #667eea;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    .jmt-volume-value {
      font-size: 14px;
      color: #667eea;
      font-weight: 600;
      min-width: 40px;
    }
    
    .jmt-settings-footer {
      margin-top: 25px;
      display: flex;
      justify-content: flex-end;
    }
    
    .jmt-btn-close {
      padding: 10px 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .jmt-btn-close:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    .jmt-update-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .jmt-update-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
    }
    
    .jmt-version-info {
      font-size: 14px;
      color: #666;
    }
    
    .jmt-version-info strong {
      color: #667eea;
    }
    
    .jmt-btn-check-update {
      padding: 6px 12px;
      background: #f0f0f0;
      color: #333;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .jmt-btn-check-update:hover {
      background: #e0e0e0;
    }
    
    .jmt-btn-check-update:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .jmt-update-status {
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      display: none;
    }
    
    .jmt-update-status.show {
      display: block;
    }
    
    .jmt-update-status.checking {
      background: #f0f7ff;
      color: #1890ff;
    }
    
    .jmt-update-status.available {
      background: #f6ffed;
      color: #52c41a;
    }
    
    .jmt-update-status.latest {
      background: #f6f6f6;
      color: #999;
    }
    
    .jmt-update-status.error {
      background: #fff2f0;
      color: #ff4d4f;
    }
    
    .jmt-update-status.downloading {
      background: #e6f7ff;
      color: #1890ff;
    }
    
    .jmt-update-status.downloaded {
      background: #f6ffed;
      color: #52c41a;
    }
    
    .jmt-progress-bar {
      width: 100%;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      margin-top: 10px;
      overflow: hidden;
    }
    
    .jmt-progress-bar-inner {
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 3px;
      transition: width 0.3s;
    }
    
    .jmt-update-actions {
      margin-top: 10px;
      display: flex;
      gap: 10px;
    }
    
    .jmt-btn-download, .jmt-btn-install {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .jmt-btn-download {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .jmt-btn-download:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .jmt-btn-install {
      background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      color: white;
    }
    
    .jmt-btn-install:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(82, 196, 26, 0.4);
    }
  `;

  document.head.appendChild(style);

  // 设置面板 HTML
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'jmt-settings-panel';
  settingsPanel.innerHTML = `
    <div class="jmt-settings-content">
      <div class="jmt-settings-title">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
        JMT Player 设置
      </div>
      
      <div class="jmt-setting-item">
        <div>
          <div class="jmt-setting-label">开机自启动</div>
          <div class="jmt-setting-desc">Windows 启动时自动运行</div>
        </div>
        <div class="jmt-toggle" data-setting="autoLaunch"></div>
      </div>
      
      <div class="jmt-setting-item">
        <div>
          <div class="jmt-setting-label">启动后自动播放</div>
          <div class="jmt-setting-desc">打开应用后自动开始播放</div>
        </div>
        <div class="jmt-toggle" data-setting="autoPlay"></div>
      </div>
      
      <div class="jmt-setting-item">
        <div>
          <div class="jmt-setting-label">自动调整系统音量</div>
          <div class="jmt-setting-desc">启动时调整至指定音量</div>
        </div>
        <div class="jmt-toggle" data-setting="autoVolume"></div>
      </div>
      
      <div class="jmt-setting-item">
        <div>
          <div class="jmt-setting-label">目标音量</div>
        </div>
        <div class="jmt-volume-control">
          <input type="range" class="jmt-volume-slider" min="0" max="100" value="80" data-setting="volumeLevel">
          <span class="jmt-volume-value">80%</span>
        </div>
      </div>
      
      <div class="jmt-update-section">
        <div class="jmt-update-header">
          <div class="jmt-version-info">当前版本: <strong id="jmt-current-version">v--</strong></div>
          <button class="jmt-btn-check-update" id="jmt-check-update-btn">检查更新</button>
        </div>
        <div class="jmt-update-status" id="jmt-update-status"></div>
        <div class="jmt-progress-bar" id="jmt-progress-bar" style="display: none;">
          <div class="jmt-progress-bar-inner" id="jmt-progress-inner" style="width: 0%;"></div>
        </div>
        <div class="jmt-update-actions" id="jmt-update-actions" style="display: none;"></div>
      </div>
      
      <div class="jmt-settings-footer">
        <button class="jmt-btn-close">完成</button>
      </div>
    </div>
  `;

  document.body.appendChild(settingsPanel);
  document.body.appendChild(floatingBtn);

  // 根据设置显示/隐藏悬浮按钮
  if (!settings.showFloatingButton) {
    floatingBtn.style.display = 'none';
  }

  // 事件绑定
  floatingBtn.addEventListener('click', () => {
    settingsPanel.classList.add('show');
    loadSettingsToUI();
  });

  settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) {
      settingsPanel.classList.remove('show');
    }
  });

  settingsPanel.querySelector('.jmt-btn-close').addEventListener('click', () => {
    settingsPanel.classList.remove('show');
  });

  // 开关绑定
  settingsPanel.querySelectorAll('.jmt-toggle').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      toggle.classList.toggle('active');
      const setting = toggle.dataset.setting;
      const value = toggle.classList.contains('active');
      await ipcRenderer.invoke('save-settings', { [setting]: value });
    });
  });

  // 音量滑块
  const volumeSlider = settingsPanel.querySelector('.jmt-volume-slider');
  const volumeValue = settingsPanel.querySelector('.jmt-volume-value');

  volumeSlider.addEventListener('input', () => {
    const value = volumeSlider.value;
    volumeValue.textContent = value + '%';
    volumeSlider.style.setProperty('--value', value + '%');
  });

  volumeSlider.addEventListener('change', async () => {
    await ipcRenderer.invoke('save-settings', { volumeLevel: parseInt(volumeSlider.value) });
  });

  // 更新功能初始化
  initUpdateUI();
}

// 加载设置到 UI
async function loadSettingsToUI() {
  const settings = await ipcRenderer.invoke('get-settings');
  const panel = document.getElementById('jmt-settings-panel');

  panel.querySelectorAll('.jmt-toggle').forEach(toggle => {
    const setting = toggle.dataset.setting;
    if (settings[setting]) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  });

  const volumeSlider = panel.querySelector('.jmt-volume-slider');
  const volumeValue = panel.querySelector('.jmt-volume-value');
  volumeSlider.value = settings.volumeLevel;
  volumeValue.textContent = settings.volumeLevel + '%';
  volumeSlider.style.setProperty('--value', settings.volumeLevel + '%');
}

// 初始化播放控制
function initPlaybackControl() {
  // 获取播放按钮 - 使用正确的选择器
  const getPlayButton = () => {
    // 优先使用 ID 选择器
    return document.getElementById('play-toggle-button-desktop')
      || document.querySelector('.control-btn.primary')
      || document.getElementById('cover-play-btn');
  };

  // 监控播放状态
  const checkPlayState = () => {
    const btn = getPlayButton();
    if (btn) {
      // 检查 FontAwesome 图标类来判断播放状态
      const icon = btn.querySelector('i');
      if (icon) {
        // fa-pause 表示正在播放，fa-play 表示已暂停
        const isPlaying = icon.classList.contains('fa-pause');
        ipcRenderer.send('play-state-changed', isPlaying);
      } else {
        // 回退到 SVG 检测
        const svg = btn.querySelector('svg');
        if (svg) {
          const path = svg.querySelector('path');
          if (path) {
            const d = path.getAttribute('d');
            const isPlaying = d && d.includes('M6') && !d.includes('M14');
            ipcRenderer.send('play-state-changed', !isPlaying);
          }
        }
      }
    }
  };

  // 定期检查播放状态
  setInterval(checkPlayState, 1000);

  // 自动播放 - 确保点击正确的按钮
  ipcRenderer.on('auto-play', () => {
    const btn = getPlayButton();
    if (btn) {
      // 检查当前是否已经是暂停状态（显示 play 图标）
      const icon = btn.querySelector('i');
      const needsClick = icon ? icon.classList.contains('fa-play') : true;

      if (needsClick) {
        btn.click();
        console.log('自动播放已触发 - 点击按钮:', btn.id || btn.className);
      } else {
        console.log('自动播放已触发 - 已经在播放中');
      }
    } else {
      console.log('自动播放失败 - 未找到播放按钮');
    }
  });

  // 切换播放
  ipcRenderer.on('toggle-play', () => {
    const btn = getPlayButton();
    if (btn) {
      btn.click();
      console.log('播放/暂停已触发');
    }
  });

  // 监听"仅音乐模式"按钮，显示提示弹窗
  initMusicOnlyModeNotification();
}

// 初始化"仅音乐模式"弹窗提示
function initMusicOnlyModeNotification() {
  // 创建弹窗样式
  const style = document.createElement('style');
  style.textContent = `
    .jmt-toast {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px 35px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(102, 126, 234, 0.5);
      z-index: 200000;
      font-size: 16px;
      font-weight: 500;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
      text-align: center;
      max-width: 90%;
      pointer-events: none;
    }
    .jmt-toast.show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
      pointer-events: auto;
    }
    .jmt-toast .toast-icon {
      display: block;
      font-size: 40px;
      margin-bottom: 15px;
    }
    .jmt-toast .toast-message {
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .jmt-toast .toast-confirm-btn {
      background: white;
      color: #667eea;
      border: none;
      padding: 10px 40px;
      border-radius: 25px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .jmt-toast .toast-confirm-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }
    .jmt-toast-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: 199999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .jmt-toast-overlay.show {
      opacity: 1;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'jmt-toast-overlay';
  document.body.appendChild(overlay);

  // 创建 Toast 容器
  const toast = document.createElement('div');
  toast.className = 'jmt-toast';
  toast.innerHTML = `
    <span class="toast-icon">🎵</span>
    <div class="toast-message">广告语将在本轮播放后结束，仅音乐播放</div>
    <button class="toast-confirm-btn">确 定</button>
  `;
  document.body.appendChild(toast);

  // 确认按钮事件
  const confirmBtn = toast.querySelector('.toast-confirm-btn');
  confirmBtn.addEventListener('click', () => {
    toast.classList.remove('show');
    overlay.classList.remove('show');
  });

  // 显示 Toast 的函数
  const showToast = () => {
    overlay.classList.add('show');
    toast.classList.add('show');
  };

  // 监听"仅音乐模式"按钮点击
  const setupMusicOnlyListener = () => {
    const musicOnlyBtn = document.getElementById('music-only-button-desktop');
    if (musicOnlyBtn) {
      musicOnlyBtn.addEventListener('click', () => {
        // 延迟检查按钮状态，确保状态已更新
        setTimeout(() => {
          if (musicOnlyBtn.classList.contains('active')) {
            showToast();
            console.log('仅音乐模式已开启，显示提示');
          }
        }, 100);
      });
      console.log('仅音乐模式弹窗监听已设置');
      return true;
    }
    return false;
  };

  // 初始尝试设置监听器
  if (!setupMusicOnlyListener()) {
    // 如果按钮还未加载，延迟重试
    const retryInterval = setInterval(() => {
      if (setupMusicOnlyListener()) {
        clearInterval(retryInterval);
      }
    }, 1000);
    // 最多重试10次
    setTimeout(() => clearInterval(retryInterval), 10000);
  }
}

// 初始化设置监听
function initSettings() {
  ipcRenderer.on('open-settings', () => {
    const panel = document.getElementById('jmt-settings-panel');
    if (panel) {
      panel.classList.add('show');
      loadSettingsToUI();
    }
  });
}

// 初始化 Blob 下载拦截
function initBlobDownload() {
  // 保存原始的 URL.createObjectURL
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const blobMap = new Map();

  URL.createObjectURL = function (blob) {
    const url = originalCreateObjectURL(blob);
    blobMap.set(url, blob);
    return url;
  };

  // 监听下载链接点击
  document.addEventListener('click', async (e) => {
    const anchor = e.target.closest('a[download]');
    if (anchor && anchor.href && anchor.href.startsWith('blob:')) {
      e.preventDefault();
      e.stopPropagation();

      try {
        let blob = blobMap.get(anchor.href);
        if (!blob) {
          const response = await fetch(anchor.href);
          blob = await response.blob();
        }

        const arrayBuffer = await blob.arrayBuffer();
        const result = await ipcRenderer.invoke('save-blob-file', {
          data: Array.from(new Uint8Array(arrayBuffer)),
          filename: anchor.download || 'download.mp3',
          mimeType: blob.type
        });

        if (result.success) {
          console.log('文件已保存:', result.filePath);
        }
      } catch (err) {
        console.error('保存文件失败:', err);
      }
    }
  }, true);

  console.log('Blob 下载拦截已启用');
}

// 拦截混音下载按钮，重定向到浏览器
function initMixRedirect() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#mix-download-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 通过 IPC 打开浏览器
      ipcRenderer.send('open-external', 'https://player.coren.xin/');

      alert('混音功能需要在浏览器中使用，已为您打开浏览器。');
      location.reload();
      return false;
    }
  }, true);
  console.log('混音重定向已启用');
}

// 初始化更新 UI
async function initUpdateUI() {
  // 获取并显示当前版本
  const versionEl = document.getElementById('jmt-current-version');
  const checkBtn = document.getElementById('jmt-check-update-btn');
  const statusEl = document.getElementById('jmt-update-status');
  const progressBar = document.getElementById('jmt-progress-bar');
  const progressInner = document.getElementById('jmt-progress-inner');
  const actionsEl = document.getElementById('jmt-update-actions');

  // 显示当前版本
  try {
    const version = await ipcRenderer.invoke('get-app-version');
    versionEl.textContent = 'v' + version;
  } catch (e) {
    versionEl.textContent = '未知';
  }

  // 更新状态显示函数
  function showStatus(message, type) {
    statusEl.className = 'jmt-update-status show ' + type;
    statusEl.textContent = message;
  }

  // 隐藏状态
  function hideStatus() {
    statusEl.className = 'jmt-update-status';
  }

  // 存储更新信息
  let pendingUpdateVersion = null;

  // 检查更新按钮
  checkBtn.addEventListener('click', async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = '检查中...';
    showStatus('正在连接更新服务器...', 'checking');
    progressBar.style.display = 'none';
    actionsEl.style.display = 'none';

    try {
      const result = await ipcRenderer.invoke('check-for-updates');
      if (!result.success) {
        showStatus('检查更新失败: ' + (result.error || '未知错误'), 'error');
      }
      // 成功时会通过事件回调处理
    } catch (e) {
      showStatus('检查更新失败: ' + e.message, 'error');
    }

    checkBtn.disabled = false;
    checkBtn.textContent = '检查更新';
  });

  // 监听更新事件
  ipcRenderer.on('update-checking', () => {
    showStatus('正在检查更新...', 'checking');
  });

  ipcRenderer.on('update-available', (event, info) => {
    pendingUpdateVersion = info.version;
    showStatus(`发现新版本 v${info.version}！`, 'available');
    actionsEl.style.display = 'flex';
    actionsEl.innerHTML = `<button class="jmt-btn-download" id="jmt-download-btn">下载更新</button>`;

    document.getElementById('jmt-download-btn').addEventListener('click', async () => {
      const btn = document.getElementById('jmt-download-btn');
      btn.disabled = true;
      btn.textContent = '开始下载...';
      showStatus('正在下载更新...', 'downloading');
      progressBar.style.display = 'block';
      progressInner.style.width = '0%';

      try {
        await ipcRenderer.invoke('download-update');
      } catch (e) {
        showStatus('下载失败: ' + e.message, 'error');
        progressBar.style.display = 'none';
      }
    });
  });

  ipcRenderer.on('update-not-available', () => {
    showStatus('当前已是最新版本 ✓', 'latest');
    actionsEl.style.display = 'none';
  });

  ipcRenderer.on('update-progress', (event, progress) => {
    progressBar.style.display = 'block';
    progressInner.style.width = progress.percent.toFixed(1) + '%';
    const mb = (progress.transferred / 1024 / 1024).toFixed(1);
    const totalMb = (progress.total / 1024 / 1024).toFixed(1);
    showStatus(`正在下载: ${mb}MB / ${totalMb}MB (${progress.percent.toFixed(1)}%)`, 'downloading');
  });

  ipcRenderer.on('update-downloaded', (event, info) => {
    progressBar.style.display = 'none';
    showStatus(`v${info.version} 下载完成，准备安装`, 'downloaded');
    actionsEl.style.display = 'flex';
    actionsEl.innerHTML = `
      <button class="jmt-btn-install" id="jmt-install-btn">立即重启安装</button>
      <button class="jmt-btn-check-update" id="jmt-later-btn">稍后安装</button>
    `;

    document.getElementById('jmt-install-btn').addEventListener('click', async () => {
      await ipcRenderer.invoke('install-update');
    });

    document.getElementById('jmt-later-btn').addEventListener('click', () => {
      showStatus('更新将在下次启动时自动安装', 'latest');
      actionsEl.style.display = 'none';
    });
  });

  ipcRenderer.on('update-error', (event, errorMessage) => {
    progressBar.style.display = 'none';
    // 开发模式下静默处理
    if (errorMessage && errorMessage.includes('ENOENT') || errorMessage.includes('dev-app-update')) {
      console.log('开发模式，跳过更新检查');
      showStatus('开发模式，更新检查已跳过', 'latest');
    } else {
      showStatus('更新出错: ' + errorMessage, 'error');
    }
    actionsEl.style.display = 'none';
  });

  // 开发模式
  ipcRenderer.on('update-dev-mode', () => {
    showStatus('开发模式，更新检查已跳过', 'latest');
    actionsEl.style.display = 'none';
  });

  console.log('更新 UI 已初始化');
}

// ==================== 播放可靠性增强 ====================

// 播放保持机制 - 检测播放中断并自动恢复
function initPlaybackGuard() {
  let shouldBePlaying = false;
  let lastPlayTime = 0;

  // 监听播放事件
  document.addEventListener('play', (e) => {
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
      shouldBePlaying = true;
      lastPlayTime = Date.now();
      console.log('检测到播放开始');
    }
  }, true);

  // 监听暂停事件
  document.addEventListener('pause', (e) => {
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
      // 只有用户主动暂停才更新状态
      // 如果是意外暂停（如缓冲），不更新 shouldBePlaying
      const timeSincePlay = Date.now() - lastPlayTime;
      if (timeSincePlay > 1000) {
        // 播放超过1秒后暂停，可能是用户操作
        shouldBePlaying = false;
        console.log('检测到播放暂停');
      }
    }
  }, true);

  // 监听播放结束
  document.addEventListener('ended', (e) => {
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
      shouldBePlaying = false;
      console.log('播放结束');
    }
  }, true);

  // 定期检查播放状态
  setInterval(() => {
    const audioElements = document.querySelectorAll('audio');
    const videoElements = document.querySelectorAll('video');
    const allMedia = [...audioElements, ...videoElements];

    allMedia.forEach(media => {
      // 如果应该播放但实际暂停了（不是用户操作），尝试恢复
      if (shouldBePlaying && media.paused && !media.ended && media.readyState >= 2) {
        console.log('检测到播放异常中断，尝试恢复...');
        media.play().then(() => {
          console.log('播放已恢复');
        }).catch(err => {
          console.log('自动恢复播放失败:', err.message);
        });
      }
    });
  }, 5000);

  // 阻止页面可见性变化导致的节流
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true
    });
  } catch (e) {
    console.log('无法覆盖 visibilityState:', e.message);
  }

  console.log('播放保持机制已启用');
}

// 心跳响应 - 响应主进程的心跳检测
function initHeartbeatResponse() {
  ipcRenderer.on('heartbeat-ping', () => {
    ipcRenderer.send('heartbeat-pong');
  });

  console.log('心跳响应已启用');
}
