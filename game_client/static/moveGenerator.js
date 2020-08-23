import {MoveParser} from "./moveParser.js";

export class MoveGenerator {
    constructor(engine) {
        this.engine = engine;
        this.team = this.engine.playingTeam;
    }

    allMovements() {
        return [].concat(this.movements(), this.storageMovements());
    }

    movements() {
        let results = [];
        for (let i = 0; i < this.engine.rows; i++) {
            for (let j = 0; j < this.engine.columns; j++) {
                results.push(...this.movementsFor(i, j));
            }
        }
        return results;
    }

    storageMovements() {
        let results = [];
        for (let i = 0; i < this.engine.pawnsStorage[this.team].length; i++) {
            results.push(...this.storageMovementsFor(i));
        }
        return results;
    }

    movementsFor(i, j) {
        if (!this.engine.canSelect(i, j)) {
            return []
        }
        let results = [];
        if (this.engine.canMove(i, j, i-1, j)) {
            results.push(MoveParser.move(this.team, i, j, i-1, j));
        }
        if (this.engine.canMove(i, j, i+1, j)) {
            results.push(MoveParser.move(this.team, i, j, i+1, j));
        }
        if (this.engine.canMove(i, j, i, j-1)) {
            results.push(MoveParser.move(this.team, i, j, i, j-1));
        }
        if (this.engine.canMove(i, j, i, j+1)) {
            results.push(MoveParser.move(this.team, i, j, i, j+1));
        }
        return results;
    }

    storageMovementsFor(animalIndex) {
        if (!this.engine.canSelectStorage(animalIndex, this.team)) {
            return [];
        }
        const pawn = this.engine.getStorageAt(animalIndex, this.team);
        let results = [];
        for (let i = 0; i < this.engine.rows; i++) {
            for (let j = 0; j < this.engine.columns; j++) {
                if (this.engine.canStorageMove(pawn, i, j)) {
                    results.push(MoveParser.storageMove(this.team, animalIndex, this.team, i, j));
                }
            }
        }
        return results;
    }

}
