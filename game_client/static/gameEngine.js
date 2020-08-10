import {Dice} from "./dice.js";
import {FakeDice} from "./fakeDice.js";
import {Pawn} from "./pawn.js";

export class GameEngine {

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
        this.cemetery = {};

        this.selectedPawn = null;
        this.playingTeam = null;
        this.lastMove = null;
    }

    // generates the game board
    generateBoard() {
        this._generateGameArray();
        this._generateGamePawns();
        this._generatePawnsStorage();
        this._generateCemetery();
        this.playingTeam = this.teams[0];
    }

    loadBoard(cells, pawns, storage, cemetery) {
        this.gameArray = cells;
        this.gamePawns = pawns.map(row => row.map(pawn => pawn != null ? new Pawn(pawn) : null));
        this.pawnsStorage = storage;
        this.cemetery = cemetery;
    }

    loadRules(colorProtection, withDice) {
        this.colorProtection = colorProtection;
        this.withDice = withDice;
        this._dice = withDice ? new Dice() : new FakeDice();
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

    exportCemetery() {
        return this.cemetery;
    }

    exportRules() {
        return {
            colorProtection: this.colorProtection,
            withDice: this.withDice
        }
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
                this.pawnsStorage[team][i] = new Pawn({
                    index: i,
                    animal: this.animals[i],
                    lastAnimalIndex: this.animals.length - 1,
                    color: this.animalsColors[i],
                    team: team
                });
            }
        }
    }

    _generateCemetery() {
        for (let team of this.teams) {
            this.cemetery[team] = [];
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

    getNumberInStorage(team) {
        return this.pawnsStorage[team].filter(p => p != null).length;
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
        if (this.colorProtection && endPawn?.color === this.getCellAt(endRow, endCol)) {
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

    canSelectStorage(animalIndex, team) {
        const pawn = this.pawnsStorage[team][animalIndex];
        return pawn !== null && pawn.team === team && team === this.playingTeam;
    }

    move(startRow, startCol, endRow, endCol) {
        this.gamePawns[endRow][endCol] = this.getPawnAt(startRow, startCol);
        this.gamePawns[startRow][startCol] = null;
        this.lastMove = {row: endRow, col: endCol};
    }

    storageMove(animalIndex, team, endRow, endCol) {
        this.gamePawns[endRow][endCol] = this.getStorageAt(animalIndex, team);
        this.pawnsStorage[team][animalIndex] = null;
        this.lastMove = {row: endRow, col: endCol};
    }

    sendToCemetery(row, col) {
        const pawn = this.gamePawns[row][col];
        if (pawn == null) {
            return null;
        }
        this.gamePawns[row][col] = null;
        this.cemetery[pawn.team][pawn.index] = pawn;
        return pawn;
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

    hasCurrentPlayerAPossibleMove() {
        const currentColor = this._dice.value;
        const team = this.playingTeam;
        for (let i = 0; i < this.pawnsStorage[team].length; i++) {
            const pawn = this.pawnsStorage[team][i];
            if (this.canSelectStorage(i, team) && (currentColor === -1 || pawn.color === currentColor)) {
                return true;
            }
        }
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                if (
                    this.canSelect(i, j) &&
                    (
                        this.canMove(i, j, i-1, j) ||
                        this.canMove(i, j, i+1, j) ||
                        this.canMove(i, j, i, j-1) ||
                        this.canMove(i, j, i, j+1)
                    )
                ) {
                    return true;
                }
            }
        }
        return false
    }

    isDiceRolled() {
        return this._dice.value != null;
    }

    isGameFinished() {
        return this.getWinningTeam() != null;
    }

    getWinningTeam() {
        for (let index = 0; index < this.teams.length; index++) {
            const team = this.teams[index];
            const pawnsOnBoard = this.getNumberOfPawns(team);
            const pawnsOnStorage = this.getNumberInStorage(team);
            if (pawnsOnBoard + pawnsOnStorage <= 2) {
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
        if (this.withDice) {
            this._dice.value = null;
        } else {
            this._dice.value = this.getCellAt(this.lastMove.row, this.lastMove.col);
        }
    }
}
