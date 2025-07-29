import * as config from "./config.js";

function buildMatrix(r, c) {
    return Array.from({ length: r }, () =>
        Array(c).fill(0)
    );

}

class Tetris {
    constructor(canvas, nextPieceCanvas) {
        this.gameRunning = false;

        this.loadRecord();
        this.board = this.createEmptyBoard();

        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;

        this.isGameOver = false;
        this.isPaused = false;

        this.currentPiece = null;
        this.nextPiece = null;

        this.dropCounter = 0;
        this.lastTime = 0;
        this.dropInterval = config.INITIAL_DROP_INTERVAL;

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.scale(config.BLOCK_SIZE, config.BLOCK_SIZE);

        this.nextPieceCanvas = nextPieceCanvas;
        this.nextPieceCtx = nextPieceCanvas.getContext('2d');
        this.nextPieceCtx.scale(config.BLOCK_SIZE, config.BLOCK_SIZE);


        

        this.spawnNextPiece();
        this.fetchNewPiece();
        this.bindInput();

    }

    loadRecord() {
        const holder = localStorage.getItem("recordHolder");
        const score = localStorage.getItem("recordScore");
        if (holder !== null && score !== null) {
            document.querySelector("#record-holder").textContent = holder;
            document.querySelector("#record-score").textContent = score;
        }

    }

    createEmptyBoard() {
        return buildMatrix(config.ROWS, config.COLS);
    }

    bindInput() {
        document.addEventListener("keydown", (e) => {
            if (this.isGameOver) {
                return;
            }

            if (this.isPaused) {
                if (e.key === "p") {
                    this.continueGame();
                    return;
                }
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                case 'a':
                    this.tryMovePiece(-1);
                    break;
                case 'ArrowRight':
                case 'd':
                    this.tryMovePiece(1);
                    break;
                case 'ArrowDown':
                case 's':
                    // 软降 - 加速下落
                    this.dropInterval = config.INITIAL_DROP_INTERVAL / 10;
                    break;
                case 'ArrowUp':
                case 'w':
                    this.tryRotatePiece();
                    break;
                case ' ':
                    this.hardDrop();
                    break;
                case 'p':
                case 'P':
                    this.pauseGame();
                    break;
            }

        });

        document.addEventListener("keyup", (e) => {
            if ((e.key === "ArrowDown" || e.key === "s") && !this.isGameOver && !this.isPaused) {
                this.refreshDropInterval();
            }
        });

        document.querySelector("#restart").addEventListener("click", ()=>{
            this.resetGame();
        })

    }

    resetGame() {
        this.board = this.createEmptyBoard();
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.isGameOver = false;
        document.querySelector("#game-over").style.display = "none";

        this.isPaused = false;
        this.dropInterval = config.INITIAL_DROP_INTERVAL;

        this.spawnNextPiece();
        this.fetchNewPiece();
        this.refreshStates();
        
        this.lastTime = performance.now();
        this.startGameLoop();
    }

    continueGame() {
        this.isPaused = false;
        this.lastTime = performance.now();
        this.startGameLoop();
        document.querySelector("#paused").style.display = "none";

    }

    pauseGame() {
        this.isPaused = true;
        document.querySelector("#paused").style.display = "block";
    }

    tryMovePiece(offsetX) {
        if (!this.checkCollision(offsetX, 0)) {
            this.currentPiece.position.x += offsetX;
        }
    }

    tryRotatePiece() {
        const posX = this.currentPiece.position.x;
        let offset = 1;
        this.currentPiece.rotate();

        // 处理旋转后可能发生的碰撞, 墙踢（Wall Kick）机制

        while (this.checkCollision(0, 0)) {
            this.currentPiece.position.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.currentPiece.matrix[0].length) {
                // 无法旋转，恢复原状态
                this.currentPiece.rotate(true); // 逆时针旋转恢复
                this.currentPiece.position.x = posX;
                return;
            }
        }
    }

    hardDrop() {
        while (!this.checkCollision(0, 1)) {
            this.currentPiece.position.y += 1;
        }
        this.lockPiece();
    }

    startGameLoop() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            requestAnimationFrame(this.update.bind(this));
        }
    }

    update(timeStamp=0) {
        if (this.isGameOver || this.isPaused) {
            this.gameRunning = false;
            return;
        }

        const deltaTime = timeStamp - this.lastTime;
        this.lastTime = timeStamp;
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.tryDrop();
        }
        
        this.draw();
        
        requestAnimationFrame(this.update.bind(this));
    }

    draw() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoard();
        if (this.currentPiece) {
            this.currentPiece.drawCurrent(this.ctx);
        }

    }

    drawBoard() {
        for (let row = 0; row < config.ROWS; row++) {
            for (let col = 0; col < config.COLS; col++) {
                if (this.board[row][col]) {
                    this.ctx.fillStyle = config.COLORS[this.board[row][col]];
                    this.ctx.fillRect(col, row, 1, 1);

                }
            }
        }
    }

    tryDrop() {
        this.dropCounter = 0;
        if (this.checkCollision(0, 1)) {
            this.lockPiece();
            return;
        }
        this.currentPiece.position.y++;
    }

    refreshDropInterval() {
        this.dropInterval = Math.max(
            config.MIN_DROP_INTERVAL,
            config.INITIAL_DROP_INTERVAL - (this.level - 1) * config.DROP_INTERVAL_DECREMENT
        )
    }

    lockPiece() {
        const { matrix, position } = this.currentPiece;
        const x = position.x;
        const y = position.y;

        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] !== 0) {
                    // 确保不会超出上边界
                    if (row + y >= 0) {
                        this.board[row + y][col + x] = matrix[row][col];
                    }
                }
            }
        }

        this.tryClearLines();

        this.fetchNewPiece();        
    }

    tryClearLines() {

        let currentLineCleared = 0;
        let row = config.ROWS - 1;
        while (row >= 0) {
            if (this.isLineFull(row)) {

                currentLineCleared += 1;

                this.clearLine(row);
                continue;
            } else {
                row -= 1;
            }
        }

        if (currentLineCleared > 0) {
            this.score += config.LINES_SCORE[currentLineCleared];
            this.linesCleared += currentLineCleared;
        }

        this.refreshStates();
    }

    refreshStates() {
        const newLevel = Math.floor(this.linesCleared / config.LEVEL_UP_LINES) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.refreshDropInterval();
        }

        document.querySelector("#score").textContent = this.score;
        document.querySelector("#level").textContent = this.level;
        document.querySelector("#lines").textContent = this.linesCleared;
        document.querySelector("#speed").textContent =
            this.dropInterval + "ms/grid";

    }

    isLineFull(row) {
        for (let col = 0; col < config.COLS; col += 1) {
            if (this.board[row][col] === 0) {
                return false;
            }
        }
        return true;
    }

    // 消除一行并将上方所有方块下移
    clearLine(row) {
        for (let r = row; r > 0; r -= 1) {
            for (let col = 0; col < config.COLS; col += 1) {
                this.board[r][col] = this.board[r-1][col];
            }
        }
        for (let col = 0; col < config.COLS; col += 1) {
            this.board[0][col] = 0;
        }

    }


    spawnNextPiece() {
        this.nextPiece = new Tetromino(
            Math.floor(Math.random() * 7) + 1,
            config.COLORS
        )
    }

    drawNextPiece() {
        this.nextPieceCtx.fillStyle = "black";
        this.nextPieceCtx.fillRect(0, 0, 5, 5);

        this.nextPiece.drawPreview(this.nextPieceCtx);
        
    }

    fetchNewPiece() {
        this.currentPiece = this.nextPiece;
        this.spawnNextPiece();
        this.drawNextPiece();

        if (this.checkCollision(0, 0)) {
            this.gameOver();
        }
    }

    checkCollision(offsetX = 0, offsetY = 0) {
        const { matrix, position } = this.currentPiece;
        const x = position.x + offsetX;
        const y = position.y + offsetY;

        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] !== 0) {
                    // 检查是否超出左右边界
                    if (
                        col + x < 0 ||
                        col + x >= config.COLS ||
                        row + y >= config.ROWS ||
                        (row + y >= 0 && this.board[row + y][col + x])
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    gameOver() {
        this.isGameOver = true;
        document.querySelector("#game-over").style.display = "block";
        this.refreshRecord();
    }

    refreshRecord() {
        const recordScore = localStorage.getItem("recordScore");
        if (recordScore === null || recordScore < this.score) {
            let userInput = prompt("Input your name please", "");
            localStorage.setItem("recordHolder", userInput);
            localStorage.setItem("recordScore", this.score);

            this.loadRecord();
        }

    }

}

class Tetromino {
    constructor(type) {
        this.type = type;
        this.matrix = this.createMatrix();
        this.position = { x: Math.floor(config.COLS / 2) - Math.floor(this.matrix[0].length / 2), y: 0 };
    }

    createMatrix() {
        // 定义7种方块的形状
        // 1 = I, 2 = O, 3 = T, 4 = S, 5 = Z, 6 = J, 7 = L
        switch (this.type) {
            case 1: // I
                return [
                    [0, 0, 0, 0],
                    [1, 1, 1, 1],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ];
            case 2: // O
                return [
                    [2, 2],
                    [2, 2]
                ];
            case 3: // T
                return [
                    [0, 3, 0],
                    [3, 3, 3],
                    [0, 0, 0]
                ];
            case 4: // S
                return [
                    [0, 4, 4],
                    [4, 4, 0],
                    [0, 0, 0]
                ];
            case 5: // Z
                return [
                    [5, 5, 0],
                    [0, 5, 5],
                    [0, 0, 0]
                ];
            case 6: // J
                return [
                    [6, 0, 0],
                    [6, 6, 6],
                    [0, 0, 0]
                ];
            case 7: // L
                return [
                    [0, 0, 7],
                    [7, 7, 7],
                    [0, 0, 0]
                ];
        }
    }

    rotate(reverse = false) {
        const sz = this.matrix.length;
        const rotated = buildMatrix(sz, sz);

        for (let i = 0; i < sz; i++) {
            for (let j = 0; j < sz; j++) {
                if (reverse) {
                    rotated[i][j] = this.matrix[j][sz - 1 - i];
                } else {
                    rotated[i][j] = this.matrix[sz - 1 - j][i];
                }
            }
        }

        this.matrix = rotated;
    }

    drawCurrent(ctx) {
        const { x, y } = this.position;
        for (let row = 0; row < this.matrix.length; row++) {
            for (let col = 0; col < this.matrix[row].length; col++) {
                if (this.matrix[row][col] !== 0) {
                    ctx.fillStyle = config.COLORS[this.matrix[row][col]];
                    ctx.fillRect(x + col, y + row, 1, 1);
                }
            }
        }
    }

    drawPreview(ctx) {
        // 计算居中位置
        const offsetX = (5 - this.matrix[0].length) / 2;
        const offsetY = (5 - this.matrix.length) / 2;

        for (let row = 0; row < this.matrix.length; row++) {
            for (let col = 0; col < this.matrix[row].length; col++) {
                if (this.matrix[row][col] !== 0) {
                    ctx.fillStyle = config.COLORS[this.matrix[row][col]];
                    ctx.fillRect(col + offsetX, row + offsetY, 1, 1);
                }
            }
        }
    }
}


const canvas = document.querySelector("#game-canvas");
const nextPieceCanvas = document.querySelector("#next-piece");
const tetris = new Tetris(canvas, nextPieceCanvas);
tetris.startGameLoop();
