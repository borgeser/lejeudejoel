import {BitmapButton} from "./game-objects/bitmapButton.js";

const STATIC_ROOT = "/static/";

let game;

const gameOptions = {
    cellSize: 80,
    boardOffset: {
        x: 160,
        y: 140
    },
    width: 800,
    height: 600,
};

window.onload = function() {
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: 0x222222,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: "thegame",
            width: gameOptions.width,
            height: gameOptions.height
        },
        scene: CommunicationScene
    };
    game = new Phaser.Game(gameConfig);
    window.focus();
};


class CommunicationScene extends Phaser.Scene {
    constructor() {
        super("CommunicationScene");
    }

    preload() {
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.add.bitmapText(gameOptions.width / 2, 50, "font", "Select playing mode", 20).setOrigin(0.5, 0,5);
        const localButton = new BitmapButton(this, gameOptions.width / 2, 200, "font", 'Local', 20).setOrigin(0.5, 0,5);
        this.add.existing(localButton);
        localButton.on('pointerup', this.local, this);
        const remoteButton = new BitmapButton(this, gameOptions.width / 2, 250, "font", 'Remote', 20).setOrigin(0.5, 0,5);
        this.add.existing(remoteButton);
        remoteButton.on('pointerup', this.remote, this);
    }

    local() {
        location.href = 'local';
    }

    remote() {
        const roomName = this.generateRoomName(4);
        // TODO: test if the room already exists.
        location.href = roomName + "/red";
    }

    generateRoomName(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
}
