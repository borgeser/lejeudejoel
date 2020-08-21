import {BitmapButton} from "./game-objects/bitmapButton.js";
import {GameEngine} from "./gameEngine.js";
import {SelectedPawn} from "./selectedPawn.js";

const STATIC_ROOT = "/static/";

let WS_SCHEME;
if (window.location.protocol === "https:") {
    WS_SCHEME = "wss://";
} else {
    WS_SCHEME = "ws://"
}

const colors = {
    YELLOW: 0,
    BLUE: 1,
    RED: 2,
    GREEN: 3,
    GREY: 4
};

const engineConfig = {
    rows: 5,
    columns: 5,
    items: 5,
    teams: ["white", "black"],
    animals: ["mouse", "cat", "dog", "lion", "elephant"],
    animalsColors: [colors.GREY, colors.GREEN, colors.RED, colors.YELLOW, colors.BLUE]
};

const gameOptions = {
    cellSize: 256,
    fontSize: 64,
    boardOffset: {
        x: 0,
        y: 384
    },
    padding: {
        x: 128,
        y: 128
    },
    width: 1920,
    height: 2304,
};

window.onload = function() {
    if (!TEAM_NAME || !ROOM_NAME) {
        mode = new LocalMode();
    } else {
        mode = new RemoteMode(TEAM_NAME, ROOM_NAME);
        mode.startWebSocket();
    }
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: 0x222222,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: "thegame",
            width: gameOptions.width,
            height: gameOptions.height
        },
        scene: MainScene
    };
    game = new Phaser.Game(gameConfig);
    window.focus();
};

class LocalMode {
    getPlayer() {
        return engine.playingTeam;
    }

    isHost() {
        return true;
    }

    // UI Events

    onMove(startX, startY, endX, endY) {}

    onStorageMove(animalIndex, team, endX, endY) {}

    onSkip() {}

    onDiceRolled(color, player) {}

    onBoardAsked() {}

    onBoardCreated() {}
}

class RemoteMode {
    constructor(myTeam, roomName) {
        this._myTeam = myTeam;
        this.roomName = roomName;
    }

    getPlayer() {
        return this._myTeam;
    }

    isHost() {
        return this.getPlayer() === engineConfig.teams[0];
    }

    startWebSocket() {
        const socket = new WebSocket(
            WS_SCHEME
            + window.location.host
            + '/ws/game_server/'
            + this.roomName
            + '/'
        );
        this.socket = socket;

        // TODO: prevent two parallel players of the same kind (black or white)

        socket.onmessage = (e) => {
            console.log("New event: " + e.data);
            const data = JSON.parse(e.data);
            if (data.player === this.getPlayer()) {
                // don't forward local events
                return;
            }
            if (data.action === "dice") {
                let color = data.details.color;
                scene.diceRolled(color);
            } else if (data.action === "move") {
                let details = data.details;
                scene.moveFinished(details.before.x, details.before.y, details.after.x, details.after.y);
            } else if (data.action === "storage_move") {
                let details = data.details;
                scene.storageMoveFinished(details.before.animalIndex, details.before.team, details.after.x, details.after.y);
            } else if (data.action === "skip") {
                scene.skipGranted();
            } else if (data.action === "connect") {
                if (!this.isHost()) {
                    return;
                }
                this._sendBoard();
            } else if (data.action === "board") {
                scene.boardReceived(data.details);
            } else {
                console.log('Unknown action: ' + data.action);
            }
        };

        socket.onclose = function(e) {
            console.error('Chat socket closed unexpectedly');
        };

        socket.onerror = function(e) {
            console.error('Error in socket: ' + e);
        };
    }

    _send(data){
        this._waitForConnection(() => this.socket.send(data), 1000);
    }

    _waitForConnection(callback, interval=1000) {
        if (this.socket.readyState === WebSocket.OPEN) {
            callback();
        } else {
            setTimeout(() => this._waitForConnection(callback, interval), interval);
        }
    }

    _sendBoard() {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'board',
            details: {
                cells: engine.exportCells(),
                pawns: engine.exportPawns(),
                storage: engine.exportStorage(),
                cemetery: engine.exportCemetery(),
                rules: engine.exportRules(),
                dice: engine.getDiceValue(),
                playing_team: engine.playingTeam
            }
        }));
    }

    // UI Events

    onDiceRolled(color) {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'dice',
            details: {
                color: color
            }
        }));
    }

    onMove(startX, startY, endX, endY) {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'move',
            details: {
                before: {
                    x: startX,
                    y: startY
                },
                after: {
                    x: endX,
                    y: endY
                }
            }
        }));
    }

    onStorageMove(animalIndex, team, endX, endY) {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'storage_move',
            details: {
                before: {
                    animalIndex: animalIndex,
                    team: team
                },
                after: {
                    x: endX,
                    y: endY
                }
            }
        }));
    }

    onSkip() {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'skip'
        }));
    }

    onBoardAsked() {
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'connect'
        }));
    }

    onBoardCreated() {
        this._sendBoard();
    }
}

class MainScene extends Phaser.Scene {

    constructor() {
        super("MainScene");
    }

    preload() {
        this.load.spritesheet("tiles", STATIC_ROOT + "assets/sprites/tiles.png", {
            frameWidth: gameOptions.cellSize,
            frameHeight: gameOptions.cellSize
        });
        for (let animal of engineConfig.animals) {
            for (let team of engineConfig.teams) {
                this.load.image(team + "/" + animal, STATIC_ROOT + 'assets/sprites/' + team + "/" + animal + '.png');
            }
        }
        this.load.image("death", STATIC_ROOT + 'assets/sprites/death.png');
        this.load.image("darwin", STATIC_ROOT + 'assets/sprites/darwin.png');
        this.load.image("arrow", STATIC_ROOT + 'assets/sprites/arrow.png');
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.engine = engine;
        this.cellSprites = [];
        this.animalSprites = [];
        this.storageSprites = {};
        this.cemeteryUnorderedSprites = [];
        this.diceSprite = null;
        this.skipButton = null;
        this.currentPlayerArrow = null;
        this.canPlay = false;
        if (mode.isHost()) {
            this._createBoard();
        } else {
            this._askForBoard();
        }
        this._drawDarwin();
        this._drawDice();
        this._drawCurrentPlayerArrow();
        this._drawSkipTurn();
        this.currentPlayerText = this.add.bitmapText(
            this._boardTotalOffset().x,
            gameOptions.padding.y,
            "font",
            "",
            gameOptions.fontSize
        );
        this.myPlayerText = this.add.bitmapText(
            this._boardTotalOffset().x,
            gameOptions.height - gameOptions.padding.y - gameOptions.fontSize,
            "font",
            "",
            gameOptions.fontSize
        );
        this._refreshPlayersTexts();
        this.input.on("pointerdown", this._pixelClicked, this);
        scene = this;
    }

    _createBoard() {
        const rules = this._getRulesFromStorage();
        this.engine.generateBoard();
        this.engine.loadRules(rules.colorProtection, rules.withDice);
        this._drawField();
        this.canPlay = true;
        mode.onBoardCreated();
    }

    _askForBoard() {
        mode.onBoardAsked();
    }

    _getRulesFromStorage() {
        return {
            colorProtection: JSON.parse(localStorage.getItem('colorProtection')) || false,
            withDice: JSON.parse(localStorage.getItem('withDice')) || false
        }
    }

    _drawField() {
        this._cleanDrawings();
        this._drawCells();
        this._drawPawns();
        this._drawStorage();
        this._drawCemetery();
    }

    _cleanDrawings() {
        for (let cellSpritesRow of this.cellSprites) {
            for (let cellSprite of cellSpritesRow) {
                cellSprite?.destroy();
            }
        }
        for (let animalSpritesRow of this.animalSprites) {
            for (let animalSprite of animalSpritesRow) {
                animalSprite?.destroy();
            }
        }
        for (let team in this.storageSprites) {
            for (let storageSprite of this.storageSprites[team]) {
                storageSprite?.destroy();
            }
        }
        for (let sprite of this.cemeteryUnorderedSprites) {
            sprite?.destroy();
        }
    }

    _drawCells() {
        for (let i = 0; i < this.engine.getRows(); i ++) {
            this.cellSprites[i] = [];
            for (let j = 0; j < this.engine.getColumns(); j ++) {
                let gemX = this._columnToPixelX(j);
                let gemY = this._rowToPixelY(i);
                const cellSprite = this.add.sprite(gemX, gemY, "tiles", this.engine.getCellAt(i, j));
                cellSprite.scaleX = 0;
                cellSprite.scaleY = 0;
                this.cellSprites[i][j] = cellSprite;
                this.tweens.add({
                    targets: cellSprite,
                    scaleX: 1,
                    scaleY: 1,
                    angle: 180,
                    _ease: 'Sine.easeInOut',
                    ease: 'Power2',
                    duration: 1000,
                    delay: i * 200,
                });
            }
        }
    }

    _drawPawns() {
        for (let i = 0; i < this.engine.getRows(); i ++) {
            this.animalSprites[i] = [];
            for (let j = 0; j < this.engine.getColumns(); j ++) {
                let gemX = this._columnToPixelX(j);
                let gemY = this._rowToPixelY(i);
                let pawn = this.engine.getPawnAt(i, j);
                if (pawn != null) {
                    let animal =  this.add.sprite(gemX, gemY, pawn.team + "/" + pawn.animal);
                    animal.depth = 1; // TODO: better handling of depth (with groups)
                    this.animalSprites[i][j] = animal;
                }
            }
        }
    }

    _drawStorage() {
        for (let t = 0; t < this.engine.teams.length; t++) {
            const team = this.engine.teams[t];
            this.storageSprites[team] = [];
            for (let j = 0; j < this.engine.getColumns(); j++) {
                let gemX = this._storageToPixelX(j);
                let gemY = this._storageToPixelY(t);
                let pawn = this.engine.getStorageAt(j, team);
                if (pawn != null) {
                    let animal =  this.add.sprite(gemX, gemY, pawn.team + "/" + pawn.animal);
                    animal.depth = 1; // TODO: better handling of depth (with groups)
                    this.storageSprites[team][j] = animal;
                }
            }
        }
    }

    _drawCemetery() {
        for (let t = 0; t < this.engine.teams.length; t++) {
            const team = this.engine.teams[t];
            for (let j = 0; j < this.engine.getColumns(); j++) {
                let x = this._cemeteryToPixelX(j);
                let y = this._cemeteryToPixelY(t);
                let pawn = this.engine.getCemeteryAt(j, team);
                if (pawn != null) {
                    let animal =  this.add.sprite(x, y, pawn.team + "/" + pawn.animal);
                    animal.depth = 1; // TODO: better handling of depth (with groups)
                    this.cemeteryUnorderedSprites.push(animal);
                    this._drawDeathSymbol(x, y);
                }
            }
        }
    }

    _drawDice() {
        this.diceSprite?.destroy();
        const xOffset = this._boardTotalOffset().x + this._boardWidth();
        const remainingSpace = gameOptions.width - xOffset;
        const x = remainingSpace / 2 +  xOffset;
        const y = this._boardTotalOffset().y + gameOptions.cellSize * Math.floor(this.engine.getColumns() / 2) + gameOptions.cellSize / 2;
        const tileIndex = this._getDiceTileIndex(this.engine.getDiceValue());
        if (tileIndex == null) {
            if (this.engine.canPlayerRoll(mode.getPlayer())) {
                this.diceSprite = new BitmapButton(this, x, y, "font", 'ROLL', gameOptions.fontSize).setOrigin(0.5, 0.5);
                this.add.existing(this.diceSprite);
                this.diceSprite.on('pointerdown', this._diceClicked, this);
            }
        } else {
            this.diceSprite = this.add.sprite(x, y, "tiles", tileIndex);
        }
    }

    _drawSkipTurn() {
        this.skipButton?.destroy();
        const xOffset = this._boardTotalOffset().x + this._boardWidth();
        const remainingSpace = gameOptions.width - xOffset;
        const x = remainingSpace / 2 +  xOffset;
        const y = this._boardTotalOffset().y + this._boardHeight() - gameOptions.cellSize / 2;
        if (this.engine.canPlayerMove(mode.getPlayer()) && !this.engine.hasCurrentPlayerAPossibleMove()) {
            this.skipButton = new BitmapButton(this, x, y, "font", 'SKIP', gameOptions.fontSize).setOrigin(0.5, 0.5);
            this.add.existing(this.skipButton);
            this.skipButton.on('pointerdown', this._skipClicked, this);
        }
    }

    _drawCurrentPlayerArrow() {
        this.currentPlayerArrow?.destroy();
        const x = gameOptions.padding.x;
        const teamIndex = this.engine.teams.indexOf(this.engine.playingTeam);
        const y = this._storageToPixelY(teamIndex);
        this.currentPlayerArrow = this.add.sprite(x, y, "arrow");
    }

    _drawDarwin() {
        const xOffset = this._boardTotalOffset().x + this._boardWidth();
        const remainingSpace = gameOptions.width - xOffset;
        const x = remainingSpace / 2 +  xOffset;
        const y = this._boardTotalOffset().y + gameOptions.cellSize / 2;
        this.add.sprite(x, y, "darwin").setScale(0.6, 0.6);
    }

    _drawDeathSymbol(x, y) {
        const death = this.add.sprite(x, y, "death");
        death.depth = 2;
        this.cemeteryUnorderedSprites.push(death);
    }

    _getDiceTileIndex(diceValue) {
        if (diceValue === -1) {
            return 5;
        }
        return diceValue;
    }

    _endTurn() {
        if (this.engine.isGameFinished()) {
            const winner = this.engine.getWinningTeam();
            this.currentPlayerText.text = "Player " + winner + ", you win!";
            this._startVictoryAnimation(winner);
            return;
        }
        this._drawDice();
        this._drawSkipTurn();
        this._drawCurrentPlayerArrow();
        this._refreshPlayersTexts();
    }

    _startVictoryAnimation(winner) {
        for (let row = 0; row < this.engine.getRows(); row++) {
            for (let col = 0; col < this.engine.getColumns(); col++) {
                const pawn = this.engine.getPawnAt(row, col);
                if (pawn != null && pawn.team !== winner) {
                    const sprite = this.animalSprites[row][col];
                    this.tweens.add({
                        targets: sprite,
                        scaleX: 0,
                        scaleY: 0,
                        angle: 180,
                        _ease: 'Sine.easeInOut',
                        ease: 'Power2',
                        duration: 5000
                    });
                }
            }
        }
        for (let team of engineConfig.teams) {
            if (team !== winner) {
                for (let sprite of this.storageSprites[team]) {
                    if (sprite != null) {
                        this.tweens.add({
                            targets: sprite,
                            scaleX: 0,
                            scaleY: 0,
                            angle: 180,
                            _ease: 'Sine.easeInOut',
                            ease: 'Power2',
                            duration: 5000
                        });
                    }
                }
            }
        }
    }

    _boardTotalOffset() {
        return {
            x: gameOptions.boardOffset.x + gameOptions.padding.x,
            y: gameOptions.boardOffset.y + gameOptions.padding.y
        };
    }

    _boardWidth() {
        return gameOptions.cellSize * this.engine.getRows();
    }

    _boardHeight() {
        return gameOptions.cellSize * this.engine.getColumns();
    }

    _refreshPlayersTexts() {
        this.myPlayerText.text = "My color is " + mode.getPlayer();
        if (this.engine.playingTeam != null) {
            this.currentPlayerText.text = "";
        } else {
            this.currentPlayerText.text = "Waiting for other player...";
        }
    }

    _move(startRow, startCol, endRow, endCol) {
        this.canPlay = false;
        let targetCell = this.cellSprites[endRow][endCol];
        let startSprite = this.animalSprites[startRow][startCol];
        this.tweens.add({
            targets: startSprite,
            x: targetCell.x,
            y: targetCell.y,
            duration: 500,
            onComplete: () => {
                this.animalSprites[startRow][startCol] = null;
                this.animalSprites[endRow][endCol] = startSprite;
                this.canPlay = true;
            }
        });
    }

    _storageMove(animalIndex, team, endRow, endCol) {
        this.canPlay = false;
        let targetCell = this.cellSprites[endRow][endCol];
        let startSprite = this.storageSprites[team][animalIndex];
        this.tweens.add({
            targets: startSprite,
            x: targetCell.x,
            y: targetCell.y,
            duration: 500,
            onComplete: () => {
                this.storageSprites[team][animalIndex] = null;
                this.animalSprites[endRow][endCol]?.destroy();
                this.animalSprites[endRow][endCol] = startSprite;
                this.canPlay = true;
            }
        });
    }

    _sendToCemetery(row, col) {
        const pawn = this.engine.getPawnAt(row, col);
        if (pawn == null) {
            return;
        }
        this.canPlay = false;
        let sprite = this.animalSprites[row][col];
        const teamIndex = this.engine.teams.indexOf(pawn.team);
        const x = this._cemeteryToPixelX(pawn.index);
        const y = this._cemeteryToPixelY(teamIndex);
        this.tweens.add({
            targets: sprite,
            x: x,
            y: y,
            duration: 500,
            onComplete: () => {
                this.cemeteryUnorderedSprites.push(sprite);
                this._drawDeathSymbol(x, y);
                this.animalSprites[row][col] = null;
                this.canPlay = true;
            }
        });
    }

    _addSelectedPawnTint() {
        let animalSprite;
        if (this.engine.selectedPawn.isStorage()) {
            animalSprite = this.storageSprites[this.engine.selectedPawn.team][this.engine.selectedPawn.animalIndex];
        } else {
            animalSprite = this.animalSprites[this.engine.selectedPawn.row][this.engine.selectedPawn.col];
        }
        animalSprite.setTint(0x582900);
    }

    _removeSelectedPawnTint() {
        if (this.engine.selectedPawn == null) {
            return;
        }
        let animalSprite;
        if (this.engine.selectedPawn.isStorage()) {
            animalSprite = this.storageSprites[this.engine.selectedPawn.team][this.engine.selectedPawn.animalIndex];
        } else {
            animalSprite = this.animalSprites[this.engine.selectedPawn.row][this.engine.selectedPawn.col];
        }
        animalSprite.setTint(0xffffff);
    }

    _pixelsToCoords(x, y) {
        let row = Math.floor((y - this._boardTotalOffset().y) / gameOptions.cellSize);
        let col = Math.floor((x - this._boardTotalOffset().x) / gameOptions.cellSize);
        return {"row": row, "col": col};
    }

    _columnToPixelX(col) {
        return this._boardTotalOffset().x + gameOptions.cellSize * col + gameOptions.cellSize / 2;
    }

    _rowToPixelY(row) {
        return this._boardTotalOffset().y + gameOptions.cellSize * row + gameOptions.cellSize / 2;
    }

    _storageToPixelY(teamIndex) {
        if (teamIndex === 0) {
            return gameOptions.cellSize + gameOptions.cellSize / 2;
        } else {
            return this._boardTotalOffset().y + gameOptions.cellSize * engineConfig.rows + gameOptions.cellSize / 2;
        }
    }

    _storageToPixelX(animalIndex) {
        return this._boardTotalOffset().x + gameOptions.cellSize * animalIndex + gameOptions.cellSize / 2;
    }

    _isStorage(row, col) {
        if (col < 0 || col >= engineConfig.columns) {
            return false;
        }
        return row === -1 || row === engineConfig.rows;
    }

    _storageInfo(row, col) {
        const animalIndex = col;
        const teamIndex = row === -1 ? 0 : 1;
        return {"animal_index": animalIndex, "team_index": teamIndex};
    }

    _cemeteryToPixelY(teamIndex) {
        return this._storageToPixelY(teamIndex);
    }

    _cemeteryToPixelX(animalIndex) {
        return this._storageToPixelX(animalIndex);
    }

    _tileSelection(row, col) {
        if (!this.engine.canSelect(row, col)) {
            return;
        }
        this.engine.selectedPawn = new SelectedPawn({ "row": row, "col": col });
        this._addSelectedPawnTint();
    }

    _storageSelection(animalIndex, teamIndex) {
        const team = this.engine.teams[teamIndex];
        if (!this.engine.canSelectStorage(animalIndex, team)) {
            return;
        }
        this.engine.selectedPawn = new SelectedPawn({ "animalIndex": animalIndex, "team": team });
        this._addSelectedPawnTint();
    }

    _tileMovement(row, col) {
        const startRow = this.engine.selectedPawn.row;
        const startCol = this.engine.selectedPawn.col;
        this._removeSelectedPawnTint();
        this.engine.selectedPawn = null;
        if (!this.engine.canMove(startRow, startCol, row, col)) {
            return;
        }
        this._sendToCemetery(row, col);
        this.engine.sendToCemetery(row, col);
        this._move(startRow, startCol, row, col);
        this.engine.move(startRow, startCol, row, col);
        this.engine.endTurn();
        this._endTurn();
        mode.onMove(startRow, startCol, row, col);
    }

    _storageMovement(row, col) {
        const animalIndex = this.engine.selectedPawn.animalIndex;
        const team = this.engine.selectedPawn.team;
        this._removeSelectedPawnTint();
        this.engine.selectedPawn = null;
        if (!this.engine.canStorageMove(this.engine.getStorageAt(animalIndex, team), row, col)) {
            return;
        }
        this._storageMove(animalIndex, team, row, col);
        this.engine.storageMove(animalIndex, team, row, col);
        this.engine.endTurn();
        this._endTurn();
        mode.onStorageMove(animalIndex, team, row, col);
    }

    // UI Event

    _diceClicked() {
        if (!this.canPlay || !this.engine.canPlayerRoll(mode.getPlayer())) {
            return;
        }
        this.engine.rollDice();
        this._drawDice();
        this._drawSkipTurn();
        mode.onDiceRolled(this.engine.getDiceValue(), this.engine.playingTeam);
    }

    _skipClicked() {
        if (!this.canPlay || !this.engine.canPlayerMove(mode.getPlayer())) {
            return;
        }
        this._removeSelectedPawnTint();
        this.engine.selectedPawn = null;
        this.engine.endTurn();
        this._endTurn();
        mode.onSkip();
    }

    _pixelClicked(pointer) {
        if (!this.canPlay || !this.engine.canPlayerMove(mode.getPlayer())) {
            return;
        }
        const coords = this._pixelsToCoords(pointer.x, pointer.y);
        if (this.engine.selectedPawn == null) {
            if (this._isStorage(coords.row, coords.col)) {
                const info = this._storageInfo(coords.row, coords.col);
                this._storageSelection(info.animal_index, info.team_index);
            } else {
                this._tileSelection(coords.row, coords.col);
            }
        } else if (this.engine.selectedPawn.isStorage()) {
            this._storageMovement(coords.row, coords.col);
        } else {
            this._tileMovement(coords.row, coords.col);
        }
    }

    // Socket Event

    boardReceived(info) {
        this.engine.loadBoard(info.cells, info.pawns, info.storage, info.cemetery);
        this.engine.loadRules(info.rules.colorProtection, info.rules.withDice);
        this._drawField();
        this.engine.playingTeam = info.playing_team;
        this._refreshPlayersTexts();
        this.engine.setDiceValue(info.dice);
        this._drawDice();
        this._drawSkipTurn();
        this._drawCurrentPlayerArrow();
        this.canPlay = true;
    }

    diceRolled(color) {
        this.engine.setDiceValue(color);
        this._drawDice();
        this._drawSkipTurn();
    }

    moveFinished(startRow, startCol, endRow, endCol) {
        this._sendToCemetery(endRow, endCol);
        this.engine.sendToCemetery(endRow, endCol);
        this._move(startRow, startCol, endRow, endCol);
        this.engine.move(startRow, startCol, endRow, endCol);
        this.engine.endTurn();
        this._endTurn();
    }

    storageMoveFinished(animalIndex, team, endRow, endCol) {
        this._storageMove(animalIndex, team, endRow, endCol);
        this.engine.storageMove(animalIndex, team, endRow, endCol);
        this.engine.endTurn();
        this._endTurn();
    }

    skipGranted() {
        this.engine.endTurn();
        this._endTurn();
    }

}

// TODO: try to clean these global variables
const engine = new GameEngine(engineConfig);
let game;
let mode;
let scene;
