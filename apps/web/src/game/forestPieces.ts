import Phaser from "phaser";
import { gridPositionKey as key, parseGridPositionKey } from "@oikos/shared";
import type { GridPosition, PieceState, SpeciesId } from "@oikos/shared";
import type { ForestSceneCallbacks, ForestViewModel } from "./ForestPhaserScene";

interface PieceObj {
  root: Phaser.GameObjects.Container;
  worldX: number;
  worldY: number;
}

interface PieceLayout {
  cols: number;
  sx: number;
  sy: number;
  scale: number;
}

function pieceLayout(n: number): PieceLayout {
  if (n <= 1) return { cols: 1, sx: 0, sy: 0, scale: 1 };
  if (n === 2) return { cols: 2, sx: 72, sy: 0, scale: 1 };
  if (n === 3) return { cols: 3, sx: 56, sy: 0, scale: 1 };
  if (n === 4) return { cols: 2, sx: 70, sy: 52, scale: 0.95 };
  if (n <= 6) return { cols: 3, sx: 56, sy: 50, scale: 0.85 };
  if (n <= 9) return { cols: 3, sx: 52, sy: 46, scale: 0.75 };
  return { cols: 4, sx: 44, sy: 42, scale: 0.7 };
}

export interface ForestPiecesOptions {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  worldOf: (position: GridPosition) => { x: number; y: number };
  createTrimmedMeepleTexture: (speciesId: SpeciesId) => string;
  selectColor: number;
  hiddenTint: number;
}

// Owns the meeple sprites resting on the board: layout, spawn/move animations,
// selection glow, hidden-state tint and the capture/removal flourish. Kept as a
// stateful renderer (mirrors ForestAmbientMotes) because piece objects and their
// last world positions persist across frames.
export class ForestPieces {
  private readonly scene: Phaser.Scene;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly worldOf: (position: GridPosition) => { x: number; y: number };
  private readonly createTrimmedMeepleTexture: (speciesId: SpeciesId) => string;
  private readonly select: number;
  private readonly hiddenTint: number;

  private pieceObjs = new Map<string, PieceObj>();
  // Last known world position (card-local offset included) for every piece we
  // have rendered, kept even after the piece is removed so removal effects can
  // fire at the exact spot the meeple sat. Converted to screen on demand.
  private lastPieceWorld = new Map<string, { x: number; y: number }>();

  constructor(options: ForestPiecesOptions) {
    this.scene = options.scene;
    this.layer = options.layer;
    this.worldOf = options.worldOf;
    this.createTrimmedMeepleTexture = options.createTrimmedMeepleTexture;
    this.select = options.selectColor;
    this.hiddenTint = options.hiddenTint;
  }

  // World position (card-local offset included) for a piece we last rendered.
  getPieceWorld(pieceId: string): { x: number; y: number } | undefined {
    return this.lastPieceWorld.get(pieceId);
  }

  sync(vm: ForestViewModel, pulses: Phaser.Tweens.Tween[], callbacks: ForestSceneCallbacks): void {
    const byLoc = new Map<string, PieceState[]>();
    for (const p of vm.pieces) {
      if (!p.location) continue;
      const k = key(p.location);
      byLoc.set(k, [...(byLoc.get(k) ?? []), p]);
    }

    const selectable = new Set(vm.selectablePieceIds);
    const selected = new Set([...vm.selectedPieceIds, ...(vm.selectedPieceId ? [vm.selectedPieceId] : [])]);
    const alive = new Set<string>();

    for (const [k, list] of byLoc) {
      const { x: gx, y: gy } = parseGridPositionKey(k);
      const base = this.worldOf({ x: gx, y: gy });
      const n = list.length;
      const layout = pieceLayout(n);
      const ps = layout.scale;
      const cols = layout.cols;
      const rows = Math.ceil(n / cols);
      const sx = layout.sx;
      const sy = layout.sy;

      list.forEach((piece, i) => {
        alive.add(piece.pieceId);
        const row = Math.floor(i / cols);
        const inRow = i % cols;
        const rowCount = Math.min(cols, n - row * cols);
        const tx = base.x + (inRow - (rowCount - 1) / 2) * sx;
        const ty = base.y + (row - (rows - 1) / 2) * sy + 28;
        this.lastPieceWorld.set(piece.pieceId, { x: tx, y: ty });
        const isSel = selectable.has(piece.pieceId);
        const isPicked = selected.has(piece.pieceId);

        let po = this.pieceObjs.get(piece.pieceId);
        if (!po) {
          const root = this.buildPiece(piece);
          root.setPosition(tx, ty);
          root.setScale(ps * 0.5);
          root.setAlpha(0);
          this.layer.add(root);
          po = { root, worldX: tx, worldY: ty };
          this.pieceObjs.set(piece.pieceId, po);
          this.scene.tweens.add({ targets: root, scale: ps, alpha: 1, duration: 300, ease: "Back.easeOut" });
        } else if (po.worldX !== tx || po.worldY !== ty) {
          const fromX = po.root.x;
          const fromY = po.root.y;
          po.worldX = tx;
          po.worldY = ty;
          this.arcMove(po.root, fromX, fromY, tx, ty, ps);
        } else {
          po.root.setScale(ps);
        }

        const glow = po.root.getData("glow") as Phaser.GameObjects.Graphics;
        const pieceImg = po.root.getData("img") as Phaser.GameObjects.Image;
        this.applyPieceHiddenState(po.root, piece);
        glow.clear();
        if (pieceImg.postFX) {
          pieceImg.postFX.clear();
          if (isPicked) {
            pieceImg.postFX.addGlow(this.select, 6, 0, false, 0.2, 12);
          }
        }
        if (isPicked) {
          glow.fillStyle(this.select, 0.28);
          glow.fillCircle(0, -4, 31);
          glow.lineStyle(5, this.select, 1);
          glow.strokeCircle(0, -4, 33);
          glow.lineStyle(2, 0xffffff, 0.9);
          glow.strokeCircle(0, -4, 38);
        } else if (isSel) {
          glow.fillStyle(this.select, 0.2);
          glow.fillCircle(0, -4, 29);
          glow.lineStyle(4, this.select, 0.98);
          glow.strokeCircle(0, -4, 32);
          glow.lineStyle(2, 0xffffff, 0.75);
          glow.strokeCircle(0, -4, 37);
          pulses.push(
            this.scene.tweens.add({
              targets: glow,
              alpha: { from: 0.62, to: 1 },
              duration: 620,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut"
            })
          );
        }

        const hit = po.root.getData("hit") as Phaser.GameObjects.Arc;
        hit.removeAllListeners();
        if (isSel) {
          hit.setInteractive({ useHandCursor: true });
          hit.on("pointerover", () => this.scene.tweens.add({ targets: po!.root, scale: ps * 1.12, duration: 120 }));
          hit.on("pointerout", () => this.scene.tweens.add({ targets: po!.root, scale: ps, duration: 120 }));
          hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
            e?.stopPropagation?.();
            callbacks.onPieceClick?.(piece.pieceId);
          });
        } else {
          hit.disableInteractive();
        }
        po.root.setDepth(isPicked ? 300 : isSel ? 200 : 100 + i);
      });
    }

    for (const [id, po] of this.pieceObjs) {
      if (!alive.has(id)) {
        // Burst exactly where the meeple sits (world space, so it tracks the
        // camera) then shrink + red flash the sprite away.
        this.spawnRemovalBurst(po.root.x, po.root.y);
        const img = po.root.getData("img") as Phaser.GameObjects.Image | undefined;
        if (img?.postFX) {
          img.postFX.clear();
          img.postFX.addGlow(0xff3b30, 6, 0, false, 0.3, 16);
        }
        this.scene.tweens.add({
          targets: po.root,
          alpha: 0,
          scale: 0.05,
          angle: 26,
          duration: 360,
          ease: "Back.easeIn",
          onComplete: () => po.root.destroy()
        });
        this.pieceObjs.delete(id);
      }
    }
  }

  // Quick capture/removal flourish drawn in the piece layer (world space) so it
  // stays locked to the spot the meeple left even as the camera pans/zooms.
  private spawnRemovalBurst(x: number, y: number): void {
    const cy = y - 4;
    const flash = this.scene.add.circle(x, cy, 26, 0xff3b30, 0.5);
    flash.setDepth(70);
    this.layer.add(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.9,
      duration: 340,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });

    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 26 + Math.random() * 18;
      const particle = this.scene.add.circle(x, cy, 2.5 + Math.random() * 1.5, 0xffd9a0, 0.95);
      particle.setDepth(71);
      this.layer.add(particle);
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 460 + Math.random() * 160,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private arcMove(
    root: Phaser.GameObjects.Container,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    scale: number
  ): void {
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const lift = Math.min(120, 34 + dist * 0.28);
    const cx = (fromX + toX) / 2;
    const cy = (fromY + toY) / 2 - lift;
    const duration = Phaser.Math.Clamp(260 + dist * 0.45, 320, 720);
    const shadow = root.getData("shadow") as Phaser.GameObjects.Ellipse | undefined;

    let lastTrail = 0;
    const proxy = { t: 0 };
    root.setDepth(400);

    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration,
      ease: "Cubic.easeInOut",
      onUpdate: () => {
        const t = proxy.t;
        const inv = 1 - t;
        const x = inv * inv * fromX + 2 * inv * t * cx + t * t * toX;
        const y = inv * inv * fromY + 2 * inv * t * cy + t * t * toY;
        const air = Math.sin(Math.PI * t);
        root.setPosition(x, y);
        root.setScale(scale * (1 + 0.08 * air));
        shadow?.setAlpha(Phaser.Math.Linear(0.18, 0.08, air));
        shadow?.setScale(1 + air * 0.25, 1 + air * 0.08);
        if (t - lastTrail > 0.085 && t < 0.96) {
          lastTrail = t;
          this.spawnTrail(x, y + 9);
        }
      },
      onComplete: () => {
        root.setPosition(toX, toY);
        root.setScale(scale);
        root.setDepth(100);
        shadow?.setAlpha(0.18);
        shadow?.setScale(1, 1);
        this.scene.tweens.add({
          targets: root,
          scaleX: scale * 1.04,
          scaleY: scale * 0.94,
          duration: 80,
          yoyo: true,
          ease: "Quad.easeOut",
          onComplete: () => root.setScale(scale)
        });
      }
    });
  }

  private spawnTrail(x: number, y: number): void {
    const dot = this.scene.add.ellipse(x, y, 16, 5, 0x000000, 0.1);
    dot.setDepth(60);
    this.layer.add(dot);
    this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => dot.destroy()
    });
  }

  private buildPiece(piece: PieceState): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);

    const shadow = this.scene.add.ellipse(3, 17, 34, 10, 0x000000, 0.18);
    const glow = this.scene.add.graphics();

    const textureKey = this.createTrimmedMeepleTexture(piece.speciesId);
    const tex = this.scene.textures.get(textureKey).getSourceImage();
    const targetH = 44;
    const ww = tex.width || 1;
    const hh = tex.height || 1;
    const img = this.scene.add
      .image(0, -8, textureKey)
      .setDisplaySize((targetH * ww) / hh, targetH)
      .setOrigin(0.5, 0.6);

    c.add([shadow, glow, img]);

    const hit = this.scene.add.circle(0, -5, 22, 0xffffff, 0);
    c.add(hit);
    c.setData("shadow", shadow);
    c.setData("glow", glow);
    c.setData("hit", hit);
    c.setData("img", img);
    this.applyPieceHiddenState(c, piece);
    return c;
  }

  private applyPieceHiddenState(root: Phaser.GameObjects.Container, piece: PieceState): void {
    const isHidden = piece.state.hidden;
    const previous = root.getData("hiddenState") as boolean | undefined;
    const shadow = root.getData("shadow") as Phaser.GameObjects.Ellipse;
    const img = root.getData("img") as Phaser.GameObjects.Image;

    shadow.setAlpha(isHidden ? 0.12 : 0.18);
    img.setAlpha(1);
    if (isHidden) {
      img.setTint(this.hiddenTint);
    } else {
      img.clearTint();
    }

    if (previous !== isHidden) {
      root.setData("hiddenState", isHidden);
      this.scene.tweens.add({
        targets: root,
        alpha: isHidden ? 0.72 : 1,
        duration: 140,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => root.setAlpha(1)
      });
    }
  }
}
