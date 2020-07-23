import {BitmapButton} from "./game-objects/bitmapButton.js";

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
    fontSize: 36,
    boardOffset: {
        x: 512,
        y: 512
    },
    width: 2304,
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
        const cells = engine.exportCells();
        const pawns = engine.exportPawns();
        const storage = engine.exportStorage();
        this._send(JSON.stringify({
            player: this.getPlayer(),
            action: 'board',
            details: {
                cells: cells,
                pawns: pawns,
                storage: storage,
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
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.engine = engine;
        this.cellSprites = [];
        this.animalSprites = [];
        this.storageSprites = {};
        this.diceSprite = null;
        this.skipButton = null;
        this.canPlay = false;
        if (mode.isHost()) {
            this._createBoard();
        } else {
            this._askForBoard();
        }
        this._drawDice();
        this._drawSkipTurn();
        this.currentPlayerText = this.add.bitmapText(gameOptions.boardOffset.x, 20, "font", "", gameOptions.fontSize);
        this.myPlayerText = this.add.bitmapText(gameOptions.boardOffset.x, 70, "font", "", gameOptions.fontSize);
        this._refreshPlayersTexts();
        this.input.on("pointerdown", this._pixelClicked, this);
        scene = this;
    }

    _createBoard() {
        this.engine.generateBoard();
        this._drawField();
        this.canPlay = true;
        mode.onBoardCreated();
    }

    _askForBoard() {
        mode.onBoardAsked();
    }

    _drawField() {
        this._drawCells();
        this._drawPawns();
        this._drawStorage();
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
                    animal.scaleX = 0;
                    animal.scaleY = 0;
                    this.tweens.add({
                        targets: animal,
                        scaleX: 1,
                        scaleY: 1,
                        _ease: 'Sine.easeInOut',
                        ease: 'Power2',
                        duration: 1000,
                        delay: i * 200,
                    });
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
                    animal.scaleX = 0;
                    animal.scaleY = 0;
                    this.tweens.add({
                        targets: animal,
                        scaleX: 1,
                        scaleY: 1,
                        _ease: 'Sine.easeInOut',
                        ease: 'Power2',
                        duration: 1000,
                        delay: t * 200,
                    });
                }
            }
        }
    }

    _drawDice() {
        this.diceSprite?.destroy();
        const x = 1.5 * gameOptions.boardOffset.x + gameOptions.cellSize * this.engine.getRows() + gameOptions.cellSize / 2;
        const y = gameOptions.boardOffset.y + gameOptions.cellSize * Math.floor(this.engine.getColumns() / 2) + gameOptions.cellSize / 2;
        const tileIndex = this._getDiceTileIndex(this.engine.getDiceValue());
        if (tileIndex == null) {
            if (this.engine.canPlayerRoll(mode.getPlayer())) {
                this.diceSprite = new BitmapButton(this, x, y, "font", 'Roll dice', gameOptions.fontSize).setOrigin(0.5, 0.5);
                this.add.existing(this.diceSprite);
                this.diceSprite.on('pointerdown', this._diceClicked, this);
            }
        } else {
            this.diceSprite = this.add.sprite(x, y, "tiles", tileIndex);
        }
    }

    _drawSkipTurn() {
        this.skipButton?.destroy();
        const x = 1.5 * gameOptions.boardOffset.x + gameOptions.cellSize * this.engine.getRows() + gameOptions.cellSize / 2;
        const y = gameOptions.boardOffset.y + gameOptions.cellSize * this.engine.getColumns() - gameOptions.cellSize / 2;
        if (this.engine.canPlayerMove(mode.getPlayer())) {
            this.skipButton = new BitmapButton(this, x, y, "font", 'Skip turn', gameOptions.fontSize).setOrigin(0.5, 0.5);
            this.add.existing(this.skipButton);
            this.skipButton.on('pointerdown', this._skipClicked, this);
        }
    }

    _getDiceTileIndex(diceValue) {
        if (diceValue === -1) {
            return 5;
        }
        return diceValue;
    }

    _endTurn() {
        this._drawDice();
        this._drawSkipTurn();
        this._refreshPlayersTexts();
    }

    _refreshPlayersTexts() {
        this.myPlayerText.text = "My color is " + mode.getPlayer();
        if (this.engine.playingTeam != null) {
            this.currentPlayerText.text = "Player " + this.engine.playingTeam + ", your turn";
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
                this.animalSprites[endRow][endCol]?.destroy();
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

    _addSelectedPawnTint() {
        let animalSprite;
        if (this.engine.selectedPawn.isStorage()) {
            animalSprite = this.storageSprites[this.engine.selectedPawn.team][this.engine.selectedPawn.animalIndex];
        } else {
            animalSprite = this.animalSprites[this.engine.selectedPawn.row][this.engine.selectedPawn.col];
        }
        animalSprite.setTint(0xaaaaaa);
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
        let row = Math.floor((y - gameOptions.boardOffset.y) / gameOptions.cellSize);
        let col = Math.floor((x - gameOptions.boardOffset.x) / gameOptions.cellSize);
        return {"row": row, "col": col};
    }

    _columnToPixelX(col) {
        return gameOptions.boardOffset.x + gameOptions.cellSize * col + gameOptions.cellSize / 2;
    }

    _rowToPixelY(row) {
        return gameOptions.boardOffset.y + gameOptions.cellSize * row + gameOptions.cellSize / 2;
    }

    _storageToPixelY(team_idx) {
        if (team_idx === 0) {
            return gameOptions.cellSize + gameOptions.cellSize / 2;
        } else {
            return gameOptions.boardOffset.y + gameOptions.cellSize * engineConfig.rows + gameOptions.cellSize / 2;
        }
    }

    _storageToPixelX(animal_idx) {
        return gameOptions.boardOffset.x + gameOptions.cellSize * animal_idx + gameOptions.cellSize / 2;
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

    _tileSelection(row, col) {
        if (!this.engine.canSelect(row, col)) {
            return;
        }
        this.engine.selectedPawn = new SelectedPawn({ "row": row, "col": col });
        this._addSelectedPawnTint();
    }

    _storageSelection(animalIndex, teamIndex) {
        if (!this.engine.canSelectStorage(animalIndex, teamIndex)) {
            return;
        }
        const team = this.engine.teams[teamIndex];
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
        this.engine.loadBoard(info.cells, info.pawns, info.storage);
        this._drawField();
        this.engine.playingTeam = info.playing_team;
        this._refreshPlayersTexts();
        this.engine.setDiceValue(info.dice);
        this._drawDice();
        this._drawSkipTurn();
        this.canPlay = true;
    }

    diceRolled(color) {
        this.engine.setDiceValue(color);
        this._drawDice();
        this._drawSkipTurn();
    }

    moveFinished(startRow, startCol, endRow, endCol) {
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

class Pawn {
    constructor(params) {
        this.index = params.index;
        this.animal = params.animal;
        this.color = params.color;
        this.team = params.team;
    }

    get tint() {
        if (this.team === "purple") {
            return 0x800080;
        }
        return 0xff7f00;
    }

    canBeat(other) {
        if (other == null) {
            return true;
        }
        if (this.team === other.team) {
            return false;
        }
        if (this.index === 0 && other.index === engineConfig.animals.length - 1) {
            return true;
        }
        return this.index === other.index + 1;
    }
}

class SelectedPawn {
    constructor(params) {
        this.row = params.row;
        this.col = params.col;
        this.animalIndex = params.animalIndex;
        this.team = params.team;
    }

    isStorage() {
        return this.animalIndex != null && this.team != null;
    }
}

class GameEngine {

    constructor(obj) {
        this.teams = obj.teams;
        this.rows = obj.rows;
        this.columns = obj.columns;
        this.items = obj.items;
        this.animals = obj.animals;
        this.animalsColors = obj.animalsColors;

        this._dice = new Dice();
        this.gameArray = [];
        this.gamePawns = [];
        this.pawnsStorage = {};

        this.selectedPawn = null;
        this.playingTeam = null;
    }

    // generates the game board
    generateBoard() {
        this._generateGameArray();
        this._generateGamePawns();
        this._generatePawnsStorage();
        this.playingTeam = this.teams[0];
    }

    loadBoard(cells, pawns, storage) {
        this.gameArray = cells;
        this.gamePawns = pawns.map(row => row.map(pawn => pawn != null ? new Pawn(pawn) : null));
        this.pawnsStorage = storage;
    }

    exportCells() {
        return this.gameArray;
    }

    exportPawns() {
        return this.gamePawns;
    }

    exportStorage() {
        return this.pawnsStorage;
    }

    _generateGameArray() {
        let cells = this._notSortedValuesForCells();
        for (let i = 0; i < this.rows; i++) {
            this.gameArray[i] = [];
            for (let j = 0; j < this.columns; j++) {
                const randomIndex = Math.floor(Math.random() * cells.length);
                this.gameArray[i][j] = cells.splice(randomIndex, 1)[0];
            }
        }
    }

    _generatePawnsStorage() {
        for (let team of this.teams) {
            this.pawnsStorage[team] = [];
            for (let i = 0; i < this.animals.length; i++) {
                this.pawnsStorage[team][i] = new Pawn({index: i, animal: this.animals[i], color: this.animalsColors[i], team: team});
            }
        }
    }

    _notSortedValuesForCells() {
        let result = [];
        for (let i = 0; i < this.columns; i++) {
            result = result.concat(Array(this.items).fill(i));
        }
        return result;
    }

    _generateGamePawns() {
        for (let i = 0; i < this.rows; i++) {
            this.gamePawns[i] = [];
            for (let j = 0; j < this.columns; j++) {
                this.gamePawns[i][j] = null;
            }
        }
    }

    // returns the number of board rows
    getRows() {
        return this.rows;
    }

    // returns the number of board columns
    getColumns() {
        return this.columns;
    }

    getCellAt(row, column) {
        if (!this.validPick(row, column)) {
            return null;
        }
        return this.gameArray[row][column];
    }

    getPawnAt(row, column) {
        if (!this.validPick(row, column)) {
            return null;
        }
        return this.gamePawns[row][column];
    }

    getStorageAt(index, team) {
        return this.pawnsStorage[team][index];
    }

    getNumberOfPawns(team) {
        return this.gamePawns.reduce((acc, row) => acc + row.reduce((acc2, pawn) => acc2 + (pawn?.team === team ? 1 : 0), 0), 0);
    }

    // returns true if the item at (row, column) is a valid pick
    validPick(row, column) {
        return row >= 0 && row < this.rows && column >= 0 && column < this.columns;
    }

    canMove(startRow, startCol, endRow, endCol) {
        if (startRow === endRow && startCol === endCol) {
            return false;
        }
        if (!this.validPick(startRow, startCol) || !this.validPick(endRow, endCol)) {
            return false;
        }
        if (!this.isAdjacent(startRow, startCol, endRow, endCol)) {
            return false;
        }
        const startPawn = this.getPawnAt(startRow, startCol);
        if (startPawn == null) {
            return false;
        }
        if (startPawn.team !== this.playingTeam) {
            return false;
        }
        const endPawn = this.getPawnAt(endRow, endCol);
        if (!startPawn.canBeat(endPawn)) {
            return false;
        }
        const currentColor = this.getDiceValue();
        if (currentColor === -1) {
            return true
        }
        return this.getCellAt(startRow, startCol) === currentColor
            || startPawn.color === currentColor;
    }

    canStorageMove(startPawn, endRow, endCol) {
        if (!this.validPick(endRow, endCol)) {
            return false;
        }
        if (startPawn == null) {
            return false;
        }
        if (startPawn.team !== this.playingTeam) {
            return false;
        }
        const endPawn = this.getPawnAt(endRow, endCol);
        if (endPawn != null) {
            return false;
        }
        const currentColor = this.getDiceValue();
        if (currentColor === -1) {
            return true
        }
        return startPawn.color === currentColor;
    }

    canSelect(row, col) {
        const pawn = this.getPawnAt(row, col);
        return pawn != null && pawn.team === this.playingTeam;
    }

    canSelectStorage(animalIndex, teamIndex) {
        const team = this.teams[teamIndex];
        const pawn = this.pawnsStorage[team][animalIndex];
        return pawn !== null && pawn.team === team && team === this.playingTeam;
    }

    move(startRow, startCol, endRow, endCol) {
        this.gamePawns[endRow][endCol] = this.getPawnAt(startRow, startCol);
        this.gamePawns[startRow][startCol] = null;
    }

    storageMove(animalIndex, team, endRow, endCol) {
        this.gamePawns[endRow][endCol] = this.getStorageAt(animalIndex, team);
        this.pawnsStorage[team][animalIndex] = null;
    }

    isAdjacent(startRow, startCol, endRow, endCol) {
        return (endRow === startRow && Math.abs(endCol - startCol) <= 1) ||
               (endCol === startCol && Math.abs(endRow - startRow) <= 1);
    }

    rollDice() {
        this._dice.roll();
    }

    getDiceValue() {
        return this._dice.value;
    }

    setDiceValue(value) {
        this._dice.value = value;
    }

    canPlayerRoll(team) {
        return team === this.playingTeam && !this.isDiceRolled();
    }

    canPlayerMove(team) {
        return team === this.playingTeam && this.isDiceRolled();
    }

    isDiceRolled() {
        return this._dice.value != null;
    }

    isGameFinished() {
        return this.getWinningTeam() != null;
    }

    getWinningTeam() {
        for (let index = 0; index < this.teams.length; index ++) {
            if (this.getNumberOfPawns(this.teams[index]) <= 2) {
                const nextIndex = (index + 1) % this.teams.length;
                return this.teams[nextIndex];
            }
        }
        return null;
    }

    endTurn() {
        const index = this.teams.indexOf(this.playingTeam);
        const nextIndex = (index + 1) % this.teams.length;
        this.playingTeam = this.teams[nextIndex];
        this._dice.value = null;
        this.selectedPawn = null;
    }
}

class Dice {
    constructor() {
        this.faces = [-1, 0, 1, 2, 3, 4];
        this.value = null;
    }

    roll() {
        this.value = this.faces[Math.floor(Math.random() * this.faces.length)];
    }
}

// TODO: try to clean these global variables
const engine = new GameEngine(engineConfig);
let game;
let mode;
let scene;
