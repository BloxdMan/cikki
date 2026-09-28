/* icons.js - sprite sheet loader and helper */
(function (global) {
    const sheets = new Map();

    function registerSpriteSheet(name, src, cols = 1, rows = 1, width, height) {
        const sheet = { name, src, cols, rows, width, height, img: null, loaded: false };
        sheets.set(name, sheet);
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                sheet.img = img;
                sheet.loaded = true;
                resolve(sheet);
            };
            img.onerror = reject;
            img.src = src;
        });
        sheet.promise = promise;
        return promise;
    }

    function createSpriteTexture(sheetName, ix, iy, size, height, fallbackX, fallbackY) {
        const texture = { sheetName, ix, iy, size, height: height || size, fallbackX, fallbackY };
        texture.render = element => {
            const sheet = sheets.get(texture.sheetName);
            if (!sheet || !sheet.loaded) return;
            const img = sheet.img;
            const cellW = sheet.width || img.naturalWidth / sheet.cols;
            const cellH = sheet.height || img.naturalHeight / sheet.rows;
            const sourceX = texture.fallbackX ?? texture.ix;
            const sourceY = texture.fallbackY ?? texture.iy;
            const canvas = document.createElement('canvas');
            canvas.width = texture.size;
            canvas.height = texture.height;
            canvas.className = 'icon-canvas';
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, Math.floor(cellW * sourceX), Math.floor(cellH * sourceY), Math.floor(cellW), Math.floor(cellH), 0, 0, canvas.width, canvas.height);
            element.innerHTML = '';
            element.appendChild(canvas);
        };
        return texture;
    }

    function setAssetIcon(element, assetName, size, assets) {
        const asset = assets && assets.getCell('Icons', assetName);
        if (!asset) return;
        const base = assets.sheets[asset.sheet]?.coordinateBase || 0;
        setIcon(element, asset.x - base, asset.y - base, size, asset.sheet, asset.fallbackX, asset.fallbackY);
    }

    function setIcon(element, ix, iy, size, sheetName = 'Icons', fallbackX, fallbackY) {
        const texture = createSpriteTexture(sheetName, ix, iy, size || 48, size || 48, fallbackX, fallbackY);
        const sheet = sheets.get(sheetName);
        if (sheet?.loaded) texture.render(element);
        else sheet?.promise.then(() => texture.render(element));
    }

    function setRandom(element, size, sheetName = 'Icons') {
        const sheet = sheets.get(sheetName);
        if (!sheet) return;
        setIcon(element, Math.floor(Math.random() * sheet.cols), Math.floor(Math.random() * sheet.rows), size, sheetName);
    }

    global.registerSpriteSheet = registerSpriteSheet;
    global.createSpriteTexture = createSpriteTexture;
    global.IconSheet = { load: (src, cols, rows) => registerSpriteSheet('Icons', src, cols, rows), setIcon, setRandom, setAssetIcon };
})(window);
