const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('jmtAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    onAutoPlay: (callback) => ipcRenderer.on('auto-play', callback),
    onTogglePlay: (callback) => ipcRenderer.on('toggle-play', callback),
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
    notifyPlayState: (playing) => ipcRenderer.send('play-state-changed', playing)
});

// 页面加载完成后注入功能
window.addEventListener('DOMContentLoaded', () => {
    console.log('JMT Player preload script loaded');

    // 等待页面完全加载
    setTimeout(() => {
        initFloatingButton();
        initPlaybackControl();
        initSettings();
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
    // 获取播放按钮
    const getPlayButton = () => document.querySelector('.control-btn.primary');

    // 监控播放状态
    const checkPlayState = () => {
        const btn = getPlayButton();
        if (btn) {
            // 根据按钮状态判断是否在播放
            const svg = btn.querySelector('svg');
            if (svg) {
                const path = svg.querySelector('path');
                if (path) {
                    // 播放图标通常是三角形，暂停是两条竖线
                    const d = path.getAttribute('d');
                    const isPlaying = d && d.includes('M6') && !d.includes('M14'); // 简化判断
                    ipcRenderer.send('play-state-changed', !isPlaying);
                }
            }
        }
    };

    // 定期检查播放状态
    setInterval(checkPlayState, 1000);

    // 自动播放
    ipcRenderer.on('auto-play', () => {
        const btn = getPlayButton();
        if (btn) {
            btn.click();
            console.log('自动播放已触发');
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
