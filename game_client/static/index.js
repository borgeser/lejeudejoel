import {BitmapButton} from "./game-objects/bitmapButton.js";

const STATIC_ROOT = "/static/";

let game;

const params = {
    fontSize: 64,
    smallFontSize: 48,
    width: 1920,
    height: 2304,
    lineHeight: 128,
};

window.onload = function() {
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: 0x222222,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: "thegame",
            width: params.width,
            height: params.height
        },
        scene: [CommunicationScene, ShareUrlScene]
    };
    game = new Phaser.Game(gameConfig);
    window.focus();
};


class CommunicationScene extends Phaser.Scene {
    constructor() {
        super("CommunicationScene");
        this.colorProtection = false;
        this.withDice = true;
    }

    preload() {
        this.load.bitmapFont("font", STATIC_ROOT + "assets/fonts/font.png", STATIC_ROOT + "assets/fonts/font.fnt");
    }

    create() {
        this.createColorProtectionSection(2);
        this.createDifficultySection(6);
        this.createPlayingModeSection(12);
    }

    createColorProtectionSection(offset) {
        this.add.bitmapText(params.width / 2, params.lineHeight * offset, "font", "Color protection", params.fontSize)
            .setOrigin(0.5, 0.5);
        this.avancedOn = new BitmapButton(this, params.width / 2, params.lineHeight * (offset + 1), "font", 'ON', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(this.avancedOn);
        this.avancedOff = new BitmapButton(this, params.width / 2, params.lineHeight * (offset + 2), "font", 'OFF', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(this.avancedOff);

        this.avancedOn.on('pointerup', () => {
            this.withDice = false;
            this.refreshDifficultyButtons();
        });
        this.avancedOff.on('pointerup', () => {
            this.withDice = true;
            this.refreshDifficultyButtons();
        });

        this.refreshDifficultyButtons();
    }

    refreshDifficultyButtons() {
        const advanced = !this.withDice;
        this.avancedOn.setSelected(advanced);
        this.avancedOff.setSelected(!advanced);
    }

    createDifficultySection(offset) {
        this.add.bitmapText(params.width / 2, params.lineHeight * offset, "font", "Advanced mode (no dice)", params.fontSize)
            .setOrigin(0.5, 0.5);
        this.protectionOn = new BitmapButton(this, params.width / 2, params.lineHeight * (offset + 1), "font", 'ON', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(this.protectionOn);
        this.protectionOff = new BitmapButton(this, params.width / 2, params.lineHeight * (offset + 2), "font", 'OFF', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(this.protectionOff);

        this.protectionOn.on('pointerup', () => {
            this.colorProtection = true;
            this.refreshProtectionButtons();
        });
        this.protectionOff.on('pointerup', () => {
            this.colorProtection = false;
            this.refreshProtectionButtons();
        });

        this.refreshProtectionButtons();
    }

    refreshProtectionButtons() {
        this.protectionOn.setSelected(this.colorProtection);
        this.protectionOff.setSelected(!this.colorProtection);
    }

    createPlayingModeSection(offset) {
        this.add.bitmapText(params.width / 2, params.lineHeight * offset, "font", "Select playing mode", params.fontSize)
            .setOrigin(0.5, 0.5);
        const localButton = new BitmapButton(this, params.width / 2, params.lineHeight * (offset + 1), "font", 'Local', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(localButton);
        localButton.on('pointerup', this.local, this);
        const remoteButton = new BitmapButton(this, params.width / 2,params.lineHeight * (offset + 2), "font", 'Remote', params.fontSize)
            .setOrigin(0.5, 0.5);
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
        this.add.bitmapText(params.width / 2, params.lineHeight, "font", "Share your url to your friend:", params.fontSize)
                .setOrigin(0.5, 0,5);
        this.add.bitmapText(params.width / 2, params.lineHeight * 2, "font", this.shareUrl, params.smallFontSize)
                .setOrigin(0.5, 0,5)
                .setMaxWidth(params.width, 47); // 47 is the '/' character in ASCII

        const copyButton = new BitmapButton(this, params.width / 2, params.lineHeight * 5, "font", 'Copy URL', params.fontSize)
            .setOrigin(0.5, 0.5);
        this.add.existing(copyButton);
        copyButton.on('pointerup', this.copyUrl, this);
        const goButton = new BitmapButton(this, params.width / 2, params.lineHeight * 6, "font", 'Go!', params.fontSize)
            .setOrigin(0.5, 0.5);
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
