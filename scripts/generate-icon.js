const pngToIco = require('png-to-ico');
const path = require('path');
const fs = require('fs');

async function createIco() {
    const inputPath = path.join(__dirname, '..', 'assets', 'icon.png');
    const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');
    const trayPath = path.join(__dirname, '..', 'assets', 'tray.ico');

    console.log('正在生成图标...');
    console.log('输入文件:', inputPath);

    try {
        const buf = await pngToIco(inputPath);
        fs.writeFileSync(icoPath, buf);
        fs.writeFileSync(trayPath, buf);

        console.log('图标生成完成！');
        console.log('- icon.ico');
        console.log('- tray.ico');
    } catch (err) {
        console.error('生成失败:', err.message);
        // 如果失败，直接复制 PNG 作为备用
        console.log('使用 PNG 作为备用...');
        fs.copyFileSync(inputPath, icoPath);
        fs.copyFileSync(inputPath, trayPath);
    }
}

createIco();
