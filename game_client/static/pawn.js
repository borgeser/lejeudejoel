export class Pawn {
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
        // TODO: remove ref of engineConfig
        if (this.index === 0 && other.index === engineConfig.animals.length - 1) {
            return true;
        }
        return this.index === other.index + 1;
    }
}
