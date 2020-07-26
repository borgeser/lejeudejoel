export class SelectedPawn {
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
