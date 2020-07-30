export class BitmapButton extends Phaser.GameObjects.BitmapText {
    constructor(scene, x, y, font, text, size, align) {
        super(scene, x, y, font, text, size, align);
        this.selected = false;
        this.setInteractive({ useHandCursor: true })
            .on('pointerover', () => this._enterButtonHoverState() )
            .on('pointerout', () => this._enterButtonRestState() )
    }

    _enterButtonHoverState() {
        this.setTint(0xffffff);
    }

    _enterButtonRestState() {
        if (this.selected) {
            this.setTint(0xffff00);
        } else {
            this.setTint(0xaaaaaa);
        }
    }

    setSelected(selected) {
        this.selected = selected;
        this._enterButtonRestState();
    }
}
