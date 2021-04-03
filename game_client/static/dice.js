export class Dice {
    constructor(params={value: null, faces: [-1, 0, 1, 2, 3, 4]}) {
        this.value = params.value;
        this.faces = params.faces;
    }

    roll() {
        this.value = this.faces[Math.floor(Math.random() * this.faces.length)];
    }
}
