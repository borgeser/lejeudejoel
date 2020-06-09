let game;
const gameOptions = {
    cellSize: 80,
    boardOffset: {
        x: 160,
        y: 140
    },
    width: 800,
    height: 600,
    destroySpeed: 200,
    fallSpeed: 100,
    slideSpeed: 300,
    localStorageName: "samegame"
};

const engineConfig = {
    rows: 5,
    columns: 5,
    items: 4,
    animals: ["mouse", "cat", "dog", "lion", "elephant"]
};

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
        scene: MainScene
    };
    game = new Phaser.Game(gameConfig);
    window.focus();
};

class MainScene extends Phaser.Scene {
    constructor() {
        super("PlayGame");
    }
    preload() {
        this.load.spritesheet("tiles", "assets/sprites/tiles.png", {
            frameWidth: 80,
            frameHeight: 80
        });
        for (let animal of engineConfig.animals) {
            let img = this.load.image(animal, 'assets/sprites/' + animal + '.png');
        }
        this.load.bitmapFont("font", "assets/fonts/font.png", "assets/fonts/font.fnt");
    }
    create() {
        this.engine = new GameEngine(engineConfig);
        this.score = 0;
        this.engine.generateBoard();
        this.drawField();
        this.canPick = true;
        this.input.on("pointerdown", this.tileSelect, this);
        this.scoreText = this.add.bitmapText(20, 20, "font", "ccc", 60);
        this.updateScore();
        this.savedData = localStorage.getItem(gameOptions.localStorageName) == null ? {
            score: 0
        } : JSON.parse(localStorage.getItem(gameOptions.localStorageName));
    }
    updateScore() {
        this.scoreText.text = "Score: " + this.score.toString();
    }
    drawField() {
        for (let i = 0; i < this.engine.getRows(); i ++) {
            for (let j = 0; j < this.engine.getColumns(); j ++) {
                let gemX = gameOptions.boardOffset.x + gameOptions.cellSize * j + gameOptions.cellSize / 2;
                let gemY = gameOptions.boardOffset.y + gameOptions.cellSize * i + gameOptions.cellSize / 2;
                this.add.sprite(gemX, gemY, "tiles", this.engine.getCellAt(i, j));
                let pawn = this.engine.getPawnAt(i, j);
                if (pawn != null) {
                    let animal = this.add.sprite(gemX, gemY, pawn.animal);
                    if (pawn.team === "red") {
                        animal.tint = 0xff0000
                    } else {
                        animal.tint = 0x0000ff
                    }
                    animal.displayWidth = gameOptions.cellSize;
                    animal.displayHeight = gameOptions.cellSize;
                }
            }
        }
    }
    tileSelect(pointer) {
        if(this.canPick){
            let row = Math.floor((pointer.y - gameOptions.boardOffset.y) / gameOptions.cellSize);
            let col = Math.floor((pointer.x - gameOptions.boardOffset.x) / gameOptions.cellSize);
            if(this.sameGame.validPick(row, col) && !this.sameGame.isEmpty(row, col)){
                let connectedItems = this.sameGame.countConnectedItems(row, col)
                if(connectedItems > 1){
                    this.score += (connectedItems * (connectedItems - 1));
                    this.updateScore();
                    this.canPick = false;
                    let gemsToRemove = this.sameGame.listConnectedItems(row, col);
                    let destroyed = 0;
                    gemsToRemove.forEach(function(gem){
                        destroyed ++;
                        this.tweens.add({
                            targets: this.sameGame.getCustomDataAt(gem.row, gem.column),
                            alpha: 0,
                            duration: gameOptions.destroySpeed,
                            callbackScope: this,
                            onComplete: function(){
                                destroyed --;
                                if(destroyed == 0){
                                    this.sameGame.removeConnectedItems(row, col)
                                    this.makeGemsFall();
                                }
                            }
                        });
                    }.bind(this))
                }
            }
        }
    }
    makeGemsFall() {
        let movements = this.sameGame.arrangeBoard();
        if(movements.length == 0){
            this.makeGemsSlide();
        }
        else{
            let fallingGems = 0;
            movements.forEach(function(movement){
                fallingGems ++;
                this.tweens.add({
                    targets: this.sameGame.getCustomDataAt(movement.row, movement.column),
                    y: this.sameGame.getCustomDataAt(movement.row, movement.column).y + gameOptions.cellSize * movement.deltaRow,
                    duration: gameOptions.fallSpeed * Math.abs(movement.deltaRow),
                    callbackScope: this,
                    onComplete: function(){
                        fallingGems --;
                        if(fallingGems == 0){
                            this.makeGemsSlide();
                        }
                    }
                })
            }.bind(this));
        }
    }
    makeGemsSlide() {
        let slideMovements = this.sameGame.compactBoardToLeft();
        if(slideMovements.length == 0){
            this.endOfMove();
        }
        else{
            let movingGems = 0;
            slideMovements.forEach(function(movement){
                movingGems ++;
                this.tweens.add({
                    targets: this.sameGame.getCustomDataAt(movement.row, movement.column),
                    x: this.sameGame.getCustomDataAt(movement.row, movement.column).x + gameOptions.cellSize * movement.deltaColumn,
                    duration: Math.abs(gameOptions.slideSpeed * movement.deltaColumn),
                    ease: "Bounce.easeOut",
                    callbackScope: this,
                    onComplete: function(){
                        movingGems --;
                        if(movingGems == 0){
                            this.endOfMove();
                        }
                    }
                });
            }.bind(this))
        }
    }
    endOfMove() {
        if(this.sameGame.stillPlayable(2)){
            this.canPick = true;
        }
        else{
            let bestScore = Math.max(this.score, this.savedData.score);
            localStorage.setItem(gameOptions.localStorageName,JSON.stringify({
                score: bestScore
          	}));
            let timedEvent =  this.time.addEvent({
                delay: 7000,
                callbackScope: this,
                callback: function(){
                    this.scene.start("PlayGame");
                }
            });
            if(this.sameGame.nonEmptyItems() == 0){
                this.gameText.text = "Congratulations!!";
            }
            else{
                this.gameText.text = "No more moves!!!";
            }
        }
    }
}

class GameEngine {

    constructor(obj) {
        this.rows = obj.rows;
        this.columns = obj.columns;
        this.items = obj.items;
        this.animals = obj.animals;
        this.gameArray = [];
        this.gamePawns = [];
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
                    this.gamePawns[i][j] = {
                        "animal": this.animals[j],
                        "team": "red"
                    };
                } else if (i === this.rows - 1) {
                    this.gamePawns[i][j] = {
                        "animal": this.animals[j],
                        "team": "blue"
                    };
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

    // returns true if the item at (row, column) is empty
    isEmpty(row, column) {
        return this.gameArray[row][column].isEmpty;
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

    // returns the custom data of the item at (row, column)
    getCustomDataAt(row, column) {
        return this.gameArray[row][column].customData;
    }

    // returns true if the item at (row, column) is a valid pick
    validPick(row, column) {
        return row >= 0 && row < this.rows && column >= 0 && column < this.columns && this.gameArray[row] != undefined && this.gameArray[row][column] != undefined;
    }

    // returns an object with all connected items starting at (row, column)
    listConnectedItems(row, column) {
        if(!this.validPick(row, column) || this.gameArray[row][column].isEmpty){
            return;
        }
        this.colorToLookFor = this.gameArray[row][column].value;
        this.floodFillArray = [];
        this.floodFillArray.length = 0;
        this.floodFill(row, column);
        return this.floodFillArray;
    }

    // returns the number of connected items starting at (row, column)
    countConnectedItems(row, column) {
        return this.listConnectedItems(row, column).length;
    }

    // removes all connected items starting at (row, column)
    removeConnectedItems(row, column) {
        let items = this.listConnectedItems(row, column);
        items.forEach(function(item){
            this.gameArray[item.row][item.column].isEmpty = true;
        }.bind(this))
    }

    // returs true if in the board there is at least a move with a minimum minCombo items
    stillPlayable(minCombo) {
        for(let i = 0; i < this.getRows(); i ++){
            for(let j = 0; j < this.getColumns(); j ++){
                if(!this.isEmpty(i, j) && this.countConnectedItems(i, j) >= minCombo){
                    return true;
                }
            }
        }
        return false;
    }

    // returns the amount of non empty items on the board
    nonEmptyItems(minCombo) {
        let result = 0;
        for(let i = 0; i < this.getRows(); i ++){
            for(let j = 0; j < this.getColumns(); j ++){
                if(!this.isEmpty(i, j) ){
                    result ++;
                }
            }
        }
        return result;
    }

    // flood fill routine
    // http://www.emanueleferonato.com/2008/06/06/flash-flood-fill-implementation/
    floodFill(row, column) {
        if(!this.validPick(row, column) || this.isEmpty(row, column)){
            return;
        }
        if(this.gameArray[row][column].value == this.colorToLookFor && !this.alreadyVisited(row, column)){
            this.floodFillArray.push({
                row: row,
                column: column
            });
            this.floodFill(row + 1, column);
            this.floodFill(row - 1, column);
            this.floodFill(row, column + 1);
            this.floodFill(row, column - 1);
        }
    }

    // arranges the board, making items fall down. Returns an object with movement information
    arrangeBoard() {
        let result = []

        // falling down
        if(this.fallingDown){
            for(let i = this.getRows() - 2; i >= 0; i --){
                for(let j = 0; j < this.getColumns(); j ++){
                    let emptySpaces = this.emptySpacesBelow(i, j);
                    if(!this.isEmpty(i, j) && emptySpaces > 0){
                        this.swapItems(i, j, i + emptySpaces, j)
                        result.push({
                            row: i + emptySpaces,
                            column: j,
                            deltaRow: emptySpaces
                        });
                    }
                }
            }
        }

        // falling up
        else{
            for(let i = 1; i < this.getRows(); i ++){
                for(let j = 0; j < this.getColumns(); j ++){
                    let emptySpaces = this.emptySpacesAbove(i, j);
                    if(!this.isEmpty(i, j) && emptySpaces > 0){
                        this.swapItems(i, j, i - emptySpaces, j)
                        result.push({
                            row: i - emptySpaces,
                            column: j,
                            deltaRow: -emptySpaces
                        });
                    }
                }
            }
        }
        return result;
    }

    // checks if a column is completely empty
    isEmptyColumn(column) {
        return this.emptySpacesBelow(-1, column) == this.getRows();
    }

    // counts empty columns to the left of column
    countLeftEmptyColumns(column){
        let result = 0;
        for(let i = column - 1; i >= 0; i --){
            if(this.isEmptyColumn(i)){
                result ++;
            }
        }
        return result;
    }

    // compacts the board to the left and returns an object with movement information
    compactBoardToLeft() {
        let result = [];
        for(let i = 1; i < this.getColumns(); i ++){
            if(!this.isEmptyColumn(i)){
                let emptySpaces = this.countLeftEmptyColumns(i);
                if(emptySpaces > 0){
                    for(let j = 0; j < this.getRows(); j ++){
                        if(!this.isEmpty(j, i)){
                            this.swapItems(j, i, j, i - emptySpaces)
                            result.push({
                                row: j,
                                column: i - emptySpaces,
                                deltaColumn: -emptySpaces
                            });
                        }
                    }
                }
            }
        }
        return result;
    }

    // replenishes the board and returns an object with movement information
    replenishBoard() {
        let result = [];
        for(let i = 0; i < this.getColumns(); i ++){
            if(this.isEmpty(0, i)){
                let emptySpaces = this.emptySpacesBelow(0, i) + 1;
                for(let j = 0; j < emptySpaces; j ++){
                    let randomValue = Math.floor(Math.random() * this.items);
                    result.push({
                        row: j,
                        column: i,
                        deltaRow: emptySpaces
                    });
                    this.gameArray[j][i].value = randomValue;
                    this.gameArray[j][i].isEmpty = false;
                }
            }
        }
        return result;
    }

    // returns the amount of empty spaces below the item at (row, column)
    emptySpacesBelow(row, column) {
        let result = 0;
        if(row != this.getRows()){
            for(let i = row + 1; i < this.getRows(); i ++){
                if(this.isEmpty(i, column)){
                    result ++;
                }
            }
        }
        return result;
    }

    // returns the amount of empty spaces above the item at (row, column)
    emptySpacesAbove(row, column) {
        let result = 0;
        if(row != 0){
            for(let i = row - 1; i >=0; i --){
                if(this.isEmpty(i, column)){
                    result ++;
                }
            }
        }
        return result;
    }

    // swap the items at (row, column) and (row2, column2)
    swapItems(row, column, row2, column2) {
        let tempObject = Object.assign(this.gameArray[row][column]);
        this.gameArray[row][column] = Object.assign(this.gameArray[row2][column2]);
        this.gameArray[row2][column2] = Object.assign(tempObject);
    }

    // returns true if (row, column) is already in floodFillArray array
    alreadyVisited(row, column) {
        let found = false;
        this.floodFillArray.forEach(function(item) {
            if(item.row == row && item.column == column) {
                found = true;
            }
        });
        return found;
    }

}
