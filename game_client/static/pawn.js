export class Pawn {
    constructor(params) {
        this.index = params.index;
        this.lastAnimalIndex = params.lastAnimalIndex;
        this.animal = params.animal;
        this.color = params.color;
        this.team = params.team;
    }

    canBeat(other) {
        if (other == null) {
            return true;
        }
        if (this.team === other.team) {
            return false;
        }
        if (this.index === 0 && other.index === this.lastAnimalIndex) {
            return true;
        }
        return this.index === other.index + 1;
    }
}
