import {BitmapButton} from "./game-objects/bitmapButton.js";

const STATIC_ROOT = "/static/"

let game;
const gameOptions = {
    cellSize: 80,
    boardOffset: {
        x: 160,
        y: 140
    },
    width: 800,
    height: 600,
};

const engineConfig = {
    rows: 5,
    columns: 5,
    items: 4,
    teams: ["red", "blue"],
    animals: ["mouse", "cat", "dog", "lion", "elephant"]
};

let currentPlayer = "red"; // TODO: replace me with a better turn handling

window.onload = function() {
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
        scene: [CommunicationScene, MainScene]
    };
    game = new Phaser.Game(gameConfig);
    window.focus();
};

class CommunicationScene extends Phaser.Scene {
    constructor() {
        super("CommunicationScene");
    }

    preload() {
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.add.bitmapText(gameOptions.width / 2, 50, "font", "Select playing mode", 20).setOrigin(0.5, 0,5);
        const localButton = new BitmapButton(this, gameOptions.width / 2, 200, "font", 'Local', 20).setOrigin(0.5, 0,5);
        this.add.existing(localButton);
        localButton.on('pointerup', this.local, this);
        const remoteButton = new BitmapButton(this, gameOptions.width / 2, 250, "font", 'Remote', 20).setOrigin(0.5, 0,5);
        this.add.existing(remoteButton);
        remoteButton.on('pointerup', this.remote, this);
    }

    local() {
        this.scene.start(MainScene.name);
    }

    remote() {
        // TODO: implement
    }
}

class MainScene extends Phaser.Scene {

    constructor() {
        super("MainScene");
    }

    preload() {
        this.load.spritesheet("tiles", STATIC_ROOT + "assets/sprites/tiles.png", {
            frameWidth: 80,
            frameHeight: 80
        });
        for (let animal of engineConfig.animals) {
            let img = this.load.image(animal, STATIC_ROOT + 'assets/sprites/' + animal + '.png');
        }
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.engine = new GameEngine(engineConfig);
        this.cellSprites = [];
        this.animalSprites = [];
        this.diceSprite = null;
        this.engine.generateBoard();
        this.drawField();
        this.drawDice();
        this.canPlay = true;
        this.currentPlayerText = this.add.bitmapText(gameOptions.boardOffset.x, 20, "font", "", 20);
        this.refreshCurrentPlayerText();
        this.input.on("pointerdown", this.tileSelect, this);
    }

    drawField() {
        for (let i = 0; i < this.engine.getRows(); i ++) {
            this.cellSprites[i] = [];
            this.animalSprites[i] = [];
            for (let j = 0; j < this.engine.getColumns(); j ++) {
                let gemX = gameOptions.boardOffset.x + gameOptions.cellSize * j + gameOptions.cellSize / 2;
                let gemY = gameOptions.boardOffset.y + gameOptions.cellSize * i + gameOptions.cellSize / 2;
                this.cellSprites[i][j] = this.add.sprite(gemX, gemY, "tiles", this.engine.getCellAt(i, j));
                let pawn = this.engine.getPawnAt(i, j);
                if (pawn != null) {
                    let animal =  this.add.sprite(gemX, gemY, pawn.animal);
                    animal.depth = 1; // TODO: better handling of depth (with groups)
                    this.animalSprites[i][j] = animal;
                    animal.tint = pawn.tint;
                    animal.displayWidth = gameOptions.cellSize;
                    animal.displayHeight = gameOptions.cellSize;
                }
            }
        }
    }

    drawDice() {
        this.diceSprite?.destroy();
        const x = 1.5 * gameOptions.boardOffset.x + gameOptions.cellSize * this.engine.getRows() + gameOptions.cellSize / 2;
        const y = gameOptions.boardOffset.y + gameOptions.cellSize * Math.floor(this.engine.getColumns() / 2) + gameOptions.cellSize / 2;
        const tileIndex = this.getDiceTileIndex(this.engine.getDiceValue());
        this.diceSprite = this.add.sprite(x, y, "tiles", tileIndex).setInteractive();
        this.diceSprite.on('pointerdown', this.diceSelect, this);
    }

    getDiceTileIndex(diceValue) {
        if (diceValue == null) {
            return 5;
        }
        if (diceValue === -1) {
            return 4;
        }
        return diceValue;
    }

    tileSelect(pointer) {
        if (!this.canPlay || !this.engine.canPlayerMove(currentPlayer)) {
            return;
        }
        let row = Math.floor((pointer.y - gameOptions.boardOffset.y) / gameOptions.cellSize);
        let col = Math.floor((pointer.x - gameOptions.boardOffset.x) / gameOptions.cellSize);
        if (this.engine.selectedPawn == null) {
            if (!this.engine.canSelect(row, col)) {
                return;
            }
            let animalSprite = this.animalSprites[row][col];
            animalSprite.setTint(0xffffff);
            this.engine.selectedPawn = { "row": row, "col": col };
        } else {
            const startRow = this.engine.selectedPawn.row;
            const startCol = this.engine.selectedPawn.col;
            const startPawn = this.engine.getPawnAt(startRow, startCol);
            if (startRow === row && startCol === col) {
                // cancel selection
                this.animalSprites[startRow][startCol].tint = startPawn.tint;
                this.engine.selectedPawn = null;
                return;
            }
            if (!this.engine.canMove(startRow, startCol, row, col)) {
                return;
            }
            this.animalSprites[startRow][startCol].tint = startPawn.tint;
            this.move(startRow, startCol, row, col);
            this.engine.move(startRow, startCol, row, col);
            this.engine.endTurn();
            this.endTurn();
            this.engine.selectedPawn = null;
        }
    }

    endTurn() {
        this.drawDice();
        this.refreshCurrentPlayerText();
        currentPlayer = currentPlayer === "red" ? "blue" : "red";
    }

    refreshCurrentPlayerText() {
        this.currentPlayerText.text = "Player " + this.engine.playingTeam + ", your turn"
    }

    diceSelect() {
        if (!this.canPlay || !this.engine.canPlayerRoll(currentPlayer)) {
            return;
        }
        this.engine.rollDice();
        this.drawDice();
    }

    move(startRow, startCol, endRow, endCol) {
        let targetCell = this.cellSprites[endRow][endCol];
        let startSprite = this.animalSprites[startRow][startCol];
        startSprite.x = targetCell.x;
        startSprite.y = targetCell.y;
        this.animalSprites[startRow][startCol] = null;
        this.animalSprites[endRow][endCol]?.destroy();
        this.animalSprites[endRow][endCol] = startSprite;
    }
}

class Pawn {
    constructor(index, animal, team) {
        this.index = index;
        this.animal = animal;
        this.team = team;
    }

    get tint() {
        if (this.team === "red") {
            return 0xff0000;
        }
        return 0x0000ff;
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

class GameEngine {

    constructor(obj) {
        this.teams = obj.teams;
        this.rows = obj.rows;
        this.columns = obj.columns;
        this.items = obj.items;
        this.animals = obj.animals;

        this._dice = new Dice();
        this.gameArray = [];
        this.gamePawns = [];

        this.selectedPawn = null;
        this.diceRolled = false;
        this.playingTeam = obj.teams[0];
    }

    // generates the game board
    generateBoard() {
        this._generateGameArray();
        this._generateGamePawns();
    }

    _generateGameArray() {
        for (let i = 0; i < this.rows; i++) {
            this.gameArray[i] = [];
            for (let j = 0; j < this.columns; j++) {
                this.gameArray[i][j] = Math.floor(Math.random() * this.items);
            }
        }
    }

    _generateGamePawns() {
        for (let i = 0; i < this.rows; i++) {
            this.gamePawns[i] = [];
            for (let j = 0; j < this.columns; j++) {
                if (i === 0) {
                    this.gamePawns[i][j] = new Pawn(j, this.animals[j], this.teams[0]);
                } else if (i === this.rows - 1) {
                    this.gamePawns[i][j] = new Pawn(j, this.animals[j], this.teams[1]);
                } else {
                    this.gamePawns[i][j] = null;
                }
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

    // returns true if the item at (row, column) is a valid pick
    validPick(row, column) {
        return row >= 0 && row < this.rows && column >= 0 && column < this.columns;
    }

    canMove(startRow, startCol, endRow, endCol) {
        const currentColor = this.getDiceValue();
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
        if (currentColor === -1) {
            return true
        }
        return this.getCellAt(startRow, startCol) === currentColor
            || this.getCellAt(endRow, endCol) === currentColor;
    }

    canSelect(row, col) {
        const pawn = this.getPawnAt(row, col);
        return pawn != null && pawn.team === this.playingTeam;
    }

    move(startRow, startCol, endRow, endCol) {
        this.gamePawns[endRow][endCol] = this.getPawnAt(startRow, startCol);
        this.gamePawns[startRow][startCol] = null;
    }

    isAdjacent(startRow, startCol, endRow, endCol) {
        return Math.abs(endRow - startRow) <= 1 && Math.abs(endCol - startCol) <= 1;
    }

    rollDice() {
        this._dice.roll();
        this.diceRolled = true;
    }

    getDiceValue() {
        if (!this.diceRolled) {
            return null;
        }
        return this._dice.value;
    }

    canPlayerRoll(team) {
        return team === this.playingTeam && !this.diceRolled;
    }

    canPlayerMove(team) {
        return team === this.playingTeam && this.diceRolled;
    }

    endTurn() {
        const index = this.teams.indexOf(this.playingTeam);
        const nextIndex = (index + 1) % this.teams.length;
        this.playingTeam = this.teams[nextIndex];
        this.diceRolled = false;
        this.selectedPawn = null;
    }
}

class Dice {
    constructor() {
        this.faces = [-1, -1, 0, 1, 2, 3];
        this.value = -1;
    }

    roll() {
        this.value = this.faces[Math.floor(Math.random() * this.faces.length)];
    }
}
