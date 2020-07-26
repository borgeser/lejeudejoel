export class Dice {
    constructor() {
        this.faces = [-1, 0, 1, 2, 3, 4];
        this.value = null;
    }

    roll() {
        this.value = this.faces[Math.floor(Math.random() * this.faces.length)];
    }
}
