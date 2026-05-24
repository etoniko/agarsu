import { getPixi } from "./pixi.js";
import {
    getSkinUrl,
    CENTER_FRAME_URL,
    CENTER_FRAME_SIZE,
    CENTER_SKIN_SIZE
} from "../config/constants.js";

export class CenterTopDisplay {
    constructor() {
        const PIXI = getPixi();

        this.container = new PIXI.Container();
        this.container.zIndex = -500;
        this.container.visible = false;

        this.skinSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        this.skinSprite.anchor.set(0.5);

        this.skinMask = new PIXI.Graphics();
        this.skinMask.beginFill(0xffffff);
        this.skinMask.drawCircle(0, 0, CENTER_SKIN_SIZE / 2);
        this.skinMask.endFill();

        this.frameSprite = PIXI.Sprite.from(CENTER_FRAME_URL);
        this.frameSprite.anchor.set(0.5);
        this.frameSprite.width = CENTER_FRAME_SIZE;
        this.frameSprite.height = CENTER_FRAME_SIZE;

        this.nickText = new PIXI.Text("", {
            fontFamily: "Arial, sans-serif",
            fontWeight: "700",
            fontSize: 22,
            fill: 0xffffff,
            align: "center"
        });
        this.nickText.anchor.set(0.5, 1);
        this.nickText.position.set(0, -185);

        this.scoreText = new PIXI.Text("", {
            fontFamily: "Arial, sans-serif",
            fontWeight: "700",
            fontSize: 22,
            fill: 0xffffff,
            align: "center"
        });
        this.scoreText.anchor.set(0.5, 0);
        this.scoreText.position.set(0, 190);

        // Как в main_out: сначала скин (круг), поверх — center.png
        this.container.addChild(
            this.skinSprite,
            this.skinMask,
            this.frameSprite,
            this.nickText,
            this.scoreText
        );
        this.skinSprite.mask = this.skinMask;
    }

    setTopPlayer(player, skinUrl) {
        if (!player) {
            this.container.visible = false;
            return;
        }

        const PIXI = getPixi();
        this.container.visible = true;
        this.nickText.text = player.nick || "";
        this.scoreText.text = String(player.score ?? 0);
        this.skinSprite.texture = PIXI.Texture.from(skinUrl || getSkinUrl("4"));
        this.skinSprite.width = CENTER_SKIN_SIZE;
        this.skinSprite.height = CENTER_SKIN_SIZE;
    }

    setMapPosition(x, y) {
        this.container.position.set(x, y);
    }

    attachTo(stage) {
        stage.addChild(this.container);
    }
}
