const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function convertIcon() {
    const inputPath = path.join(__dirname, '..', 'assets', 'jmt.webp');
    const outputPath = path.join(__dirname, '..', 'assets', 'icon.png');

    console.log('正在转换图标...');
    console.log('输入:', inputPath);
    console.log('输出:', outputPath);

    try {
        await sharp(inputPath)
            .resize(256, 256, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toFile(outputPath);

        console.log('图标转换完成！');
    } catch (err) {
        console.error('转换失败:', err.message);
        process.exit(1);
    }
}

convertIcon();
