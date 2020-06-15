export class BitmapButton extends Phaser.GameObjects.BitmapText {
    constructor(scene, x, y, font, text, size, align) {
        super(scene, x, y, font, text, size, align);
        this.setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.enterButtonHoverState() )
            .on('pointerout', () => this.enterButtonRestState() )
            .on('pointerdown', () => this.enterButtonActiveState() )
            .on('pointerup', () => this.enterButtonHoverState() );
    }

    enterButtonHoverState() {
        this.setTint(0x00ffff);
    }

    enterButtonRestState() {
        this.setTint(0xffffff);
    }

    enterButtonActiveState() {
        this.setTint(0xffff00);
    }
}
