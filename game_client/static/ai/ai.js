import {MoveGenerator} from "../moveGenerator.js";
import {TreeNode, GameNode} from "./treeNode.js";
import {MoveParser} from "../moveParser.js";

export class AI {
    bestNextMove(engine) {
        const myTeam = engine.playingTeam;
        const index = engine.teams.indexOf(myTeam);
        const nextIndex = (index + 1) % engine.teams.length;
        const otherTeam =  engine.teams[nextIndex];

        const myNumberOfPawns = engine.getTotalNumberOfPawns(myTeam);
        const otherNumberOfPawns = engine.getTotalNumberOfPawns(otherTeam);

        const nextTurnDescendants = this._generateTree(engine, 2, myTeam, otherTeam).descendants;
        const notBadDescendants = nextTurnDescendants.filter(tree =>
            tree.descendants.every(tree2 => tree2.myPawns >= myNumberOfPawns)
        );
        const veryGoodDescendants = notBadDescendants.filter(tree =>
            tree.descendants.some(tree2 => tree2.hisPawns < otherNumberOfPawns)
        );
        if (veryGoodDescendants.length > 0) {
            console.log("Very good :)");
            let randChild = veryGoodDescendants[Math.floor(Math.random() * veryGoodDescendants.length)];
            return randChild.movement;
        } else if (notBadDescendants.length > 0) {
            console.log("Not bad :|");
            let randChild = notBadDescendants[Math.floor(Math.random() * notBadDescendants.length)];
            return randChild.movement;
        } else if (nextTurnDescendants.length > 0) {
            console.log("Very bad :(");
            let randChild = nextTurnDescendants[Math.floor(Math.random() * nextTurnDescendants.length)];
            return randChild.movement;
        } else {
            console.log("No option :'(");
            return MoveParser.skip(myTeam);
        }
    }

    _generateTree(engine, depth, myTeam, otherTeam) {
        return new TreeNode(null, this._generateChildrenRecur(engine, depth, myTeam, otherTeam));
    }

    _generateChildrenRecur(engine, depth, myTeam, otherTeam) {
        if (depth <= 0) {
            return [];
        }
        const generator = new MoveGenerator(engine);
        const moves = generator.allMovements();
        return moves.map(x => {
            const eng2 = engine.clone();
            eng2.executeMovement(x);
            eng2.endTurn();
            return new GameNode(
                x,
                eng2.getTotalNumberOfPawns(myTeam),
                eng2.getTotalNumberOfPawns(otherTeam),
                this._generateChildrenRecur(eng2, depth - 1, myTeam, otherTeam));
        });
    }
}
