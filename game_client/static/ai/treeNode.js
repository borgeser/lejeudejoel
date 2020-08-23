export class TreeNode {
    constructor(value, descendants=[]) {
        this.value = value;
        this.descendants = descendants;
    }
}

export class GameNode {
    constructor(movement, myPawns, hisPawns, descendants=[]) {
        this.movement = movement;
        this.myPawns = myPawns;
        this.hisPawns = hisPawns;
        this.descendants = descendants;
    }
}
