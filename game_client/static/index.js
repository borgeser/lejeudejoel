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
        scene: [CommunicationScene, ShareUrlScene]
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
        this.add.bitmapText(gameOptions.width / 2, 50, "font", "Select playing mode", 20).setOrigin(0.5, 0.5);
        const localButton = new BitmapButton(this, gameOptions.width / 2, 200, "font", 'Local', 20).setOrigin(0.5, 0.5);
        this.add.existing(localButton);
        localButton.on('pointerup', this.local, this);
        const remoteButton = new BitmapButton(this, gameOptions.width / 2, 250, "font", 'Remote', 20).setOrigin(0.5, 0.5);
        this.add.existing(remoteButton);
        remoteButton.on('pointerup', this.remote, this);
    }

    local() {
        location.href = 'local';
    }

    remote() {
        const roomName = this.generateRoomName(4);
        // TODO: test if the room already exists.
        const shareUrl = location.href + roomName + "/black";
        const myUrl = roomName + "/white";
        this.scene.start(ShareUrlScene.name, { shareUrl: shareUrl, myUrl: myUrl });
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

class ShareUrlScene extends Phaser.Scene {
    constructor() {
        super("ShareUrlScene");
    }

    init(params) {
        this.shareUrl = params.shareUrl;
        this.myUrl = params.myUrl;
    }

    preload() {
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.add.bitmapText(gameOptions.width / 2, 50, "font", "Share your url to your friend:", 20)
                .setOrigin(0.5, 0,5);
        this.add.bitmapText(gameOptions.width / 2, 100, "font", this.shareUrl, 20)
                .setOrigin(0.5, 0,5)
                .setMaxWidth(gameOptions.width, 47); // 47 is the '/' character in ASCII

        const copyButton = new BitmapButton(this, gameOptions.width / 2, 250, "font", 'Copy URL', 20).setOrigin(0.5, 0.5);
        this.add.existing(copyButton);
        copyButton.on('pointerup', this.copyUrl, this);
        const goButton = new BitmapButton(this, gameOptions.width / 2, 300, "font", 'Go!', 20).setOrigin(0.5, 0.5);
        this.add.existing(goButton);
        goButton.on('pointerup', this.goToGame, this);
    }

    copyUrl() {
        let invisibleText = document.getElementById('invisibleUrl');
        invisibleText.innerHTML = this.shareUrl;
        this.selectText(invisibleText);
        document.execCommand("copy");
        invisibleText.innerHTML = "";
    }

    goToGame() {
        location.href = this.myUrl;
    }

    // courtesy of https://stackoverflow.com/a/987376/4269317
    selectText(node) {
        if (document.body.createTextRange) {
            const range = document.body.createTextRange();
            range.moveToElementText(node);
            range.select();
        } else if (window.getSelection) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(node);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            console.warn("Could not select text in node: Unsupported browser.");
        }
    }
}
