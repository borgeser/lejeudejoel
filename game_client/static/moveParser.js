export class MoveParser {
    static storageMove(player, animalIndex, team, endX, endY) {
        return {
            player: player,
            action: 'storage_move',
            details: {
                before: {
                    animalIndex: animalIndex,
                    team: team
                },
                after: {
                    x: endX,
                    y: endY
                }
            }
        };
    }

    static move(player, startX, startY, endX, endY) {
        return {
            player: player,
            action: 'move',
            details: {
                before: {
                    x: startX,
                    y: startY
                },
                after: {
                    x: endX,
                    y: endY
                }
            }
        };
    }

    static skip(player) {
        return {
            player: player,
            action: 'skip'
        };
    }
}
