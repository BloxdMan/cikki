/* assets.js - named catalog of the image and sprite assets used by Cikki */
(function (global) {
    const sheets = {
        Icons: {
            name: 'Icons',
            coordinateBase: 1,
            src: 'assets/icon/icon.png',
            columns: 6,
            rows: 6,
            cellWidth: 256,
            cellHeight: 256,
            cells: {
                back: { x: 1, y: 1, name: 'Back' },
                next: { x: 2, y: 1, name: 'Next' },
                close: { x: 3, y: 1, name: 'Close' },
                check: { x: 4, y: 1, name: 'Check' },
                reward: { x: 5, y: 1, name: 'Reward' },
                home: { x: 6, y: 1, name: 'Home' },
                search: { x: 1, y: 2, name: 'Search' },
                settings: { x: 2, y: 2, name: 'Settings' },
                list: { x: 3, y: 2, name: 'List' },
                gaming: { x: 4, y: 2, name: 'Gaming' },
                japanese: { x: 1, y: 3, name: 'Japanese' },
                calculator: { x: 2, y: 3, name: 'Calculator' },
                pen: { x: 3, y: 3, name: 'Pen' },
                lighting: { x: 4, y: 3, name: 'Lighting' },
                card: { x: 4, y: 4, name: 'Card' },
                book: { x: 2, y: 4, name: 'Book' },
                profile: { x: 3, y: 4, name: 'Profile' },
                statistics: { x: 3, y: 4, name: 'Statistics' },
                achievements: { x: 5, y: 2, name: 'Achievements' },
                minigames: { x: 4, y: 2, name: 'Minigames' }
            }
        }
    };

    const images = {
        crystal: { name: 'Crystal', src: 'assets/icon/crystal.png', width: 256, height: 256 }
    };

    function getCell(sheetName, cellName) {
        const sheet = sheets[sheetName];
        return sheet && sheet.cells[cellName] ? Object.assign({ sheet: sheetName }, sheet.cells[cellName]) : null;
    }

    function getTexture(cellName, sheetName = 'Icons') {
        const cell = getCell(sheetName, cellName);
        if (!cell || !global.createSpriteTexture) return null;
        const sheet = sheets[sheetName];
        const base = sheet.coordinateBase || 0;
        return global.createSpriteTexture(sheetName, cell.x - base, cell.y - base, sheet.cellWidth, sheet.cellHeight);
    }

    function register() {
        return Promise.all(Object.values(sheets).map(sheet => global.registerSpriteSheet(
            sheet.name,
            sheet.src,
            sheet.columns,
            sheet.rows,
            sheet.cellWidth,
            sheet.cellHeight
        )));
    }

    global.CikkiAssets = { sheets, images, getCell, getTexture, register };
})(window);
