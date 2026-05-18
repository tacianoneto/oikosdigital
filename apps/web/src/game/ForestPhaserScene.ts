import Phaser from "phaser";
import { forestCardsById, getForestCardDefinition, resourceAssets, speciesDefinitions } from "@oikos/content";
import type { ForestCardState, GridPosition, PieceState, Resource } from "@oikos/shared";

export interface ForestViewModel {
  cards: ForestCardState[];
  pieces: PieceState[];
  canPlaceSetupPiece: boolean;
  expansionTargets: GridPosition[];
  movementTargets: GridPosition[];
  addPieceTargets: GridPosition[];
  bonusTargets: GridPosition[];
  selectedPieceId: string | null;
  selectedPieceIds: string[];
  selectablePieceIds: string[];
}

export interface ForestSceneCallbacks {
  onCardClick?: (position: GridPosition) => void;
  onExpansionTargetClick?: (position: GridPosition) => void;
  onAddPieceTargetClick?: (position: GridPosition) => void;
  onBonusTargetClick?: (position: GridPosition) => void;
  onPieceClick?: (pieceId: string) => void;
  onMovementTargetClick?: (position: GridPosition) => void;
}

const CARD = 196;
const GAP = 22;
const STEP = CARD + GAP;
const RADIUS = 16;

const SPECIES_COLOR: Record<string, number> = {
  jaguar: 0xe8a33d,
  maned_wolf: 0xc8553d,
  armadillo: 0xb98a4b,
  macaw: 0x3a7fc4,
  capuchin: 0x6b8a76,
  coati: 0xb6815f
};

const SELECT = 0x5fd08a;
const INK = 0x101a14;
const HIDDEN_TINT = 0x7f8780;
const HIDDEN_BASE = 0x747c76;

function key(p: GridPosition): string {
  return `${p.x}:${p.y}`;
}

function colorForPiece(piece: PieceState): number {
  return SPECIES_COLOR[piece.speciesId] ?? 0xb6815f;
}

interface CardObj {
  root: Phaser.GameObjects.Container;
}

interface PieceObj {
  root: Phaser.GameObjects.Container;
  worldX: number;
  worldY: number;
}

export class ForestPhaserScene extends Phaser.Scene {
  private vm: ForestViewModel | null = null;
  private cb: ForestSceneCallbacks = {};
  private vmSignature = "";

  private surfaceLayer!: Phaser.GameObjects.Container;
  private gridLayer!: Phaser.GameObjects.Container;
  private highlightLayer!: Phaser.GameObjects.Container;
  private cardLayer!: Phaser.GameObjects.Container;
  private pieceLayer!: Phaser.GameObjects.Container;

  private cardObjs = new Map<string, CardObj>();
  private pieceObjs = new Map<string, PieceObj>();
  private pulses: Phaser.Tweens.Tween[] = [];

  private ready = false;
  private userAdjusted = false;
  private lastSlotCount = -1;

  constructor() {
    super("ForestPhaserScene");
  }

  preload(): void {
    for (const def of forestCardsById.values()) {
      this.load.image(`card:${def.id}`, encodeURI(def.imagePath));
    }
    for (const sp of Object.values(speciesDefinitions)) {
      this.load.image(`meeple:${sp.speciesId}`, encodeURI(sp.meepleAsset));
    }
    (Object.keys(resourceAssets) as Array<Resource | "point">).forEach((r) => {
      this.load.image(`res:${r}`, encodeURI(resourceAssets[r]));
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.surfaceLayer = this.add.container(0, 0);
    this.gridLayer = this.add.container(0, 0);
    this.highlightLayer = this.add.container(0, 0);
    this.cardLayer = this.add.container(0, 0);
    this.pieceLayer = this.add.container(0, 0);

    this.setupCameraControls();

    this.scale.on("resize", () => {
      if (!this.userAdjusted) this.fitCamera(true);
    });

    this.ready = true;
    if (this.vm) this.render();
  }

  setCallbacks(cb: ForestSceneCallbacks): void {
    this.cb = cb;
  }

  setState(vm: ForestViewModel): void {
    const nextSignature = viewSignature(vm);
    if (nextSignature === this.vmSignature) {
      this.vm = vm;
      return;
    }

    this.vmSignature = nextSignature;
    this.vm = vm;
    if (this.ready) this.render();
  }

  resetView(): void {
    this.userAdjusted = false;
    this.fitCamera(false);
  }

  gridToScreenPoint(position: GridPosition): { x: number; y: number } | null {
    if (!this.ready) {
      return null;
    }

    const world = this.worldOf(position);
    const camera = this.cameras.main;
    return {
      x: (world.x - camera.scrollX) * camera.zoom,
      y: (world.y - camera.scrollY) * camera.zoom
    };
  }

  private worldOf(p: GridPosition): { x: number; y: number } {
    return { x: p.x * STEP, y: p.y * STEP };
  }

  private render(): void {
    if (!this.vm) return;
    const vm = this.vm;

    this.pulses.forEach((t) => t.stop());
    this.pulses = [];
    this.highlightLayer.removeAll(true);
    this.gridLayer.removeAll(true);
    this.surfaceLayer.removeAll(true);

    this.drawSurface(vm);
    this.syncCards(vm);
    this.drawHighlights(vm);
    this.syncPieces(vm);

    const slots = vm.cards.length + vm.expansionTargets.length;
    if (slots !== this.lastSlotCount) {
      this.lastSlotCount = slots;
      if (!this.userAdjusted) this.fitCamera(this.cardObjs.size <= slots);
    }
  }

  private drawSurface(vm: ForestViewModel): void {
    const b = this.contentBounds(vm);
    const pad = 46;
    const g = this.add.graphics();
    g.fillStyle(0x0c1712, 0.55);
    g.fillRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 28);
    g.lineStyle(2, 0xffffff, 0.05);
    g.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 28);
    this.surfaceLayer.add(g);

    for (const s of [...vm.cards, ...vm.expansionTargets]) {
      const w = this.worldOf(s);
      const slot = this.add.graphics();
      slot.fillStyle(0x000000, 0.22);
      slot.fillRoundedRect(w.x - CARD / 2, w.y - CARD / 2, CARD, CARD, RADIUS);
      this.gridLayer.add(slot);
    }
  }

  private syncCards(vm: ForestViewModel): void {
    const alive = new Set<string>();

    for (const card of vm.cards) {
      alive.add(card.instanceId);
      const def = getForestCardDefinition(card.definitionId);
      const w = this.worldOf(card);
      const isMove = vm.movementTargets.some((t) => key(t) === key(card));
      const isAdd = vm.addPieceTargets.some((t) => key(t) === key(card));
      const isBonus = vm.bonusTargets.some((t) => key(t) === key(card));
      const interactive = vm.canPlaceSetupPiece || isMove || isAdd || isBonus;

      let obj = this.cardObjs.get(card.instanceId);
      if (!obj) {
        const root = this.buildCard(def);
        root.setPosition(w.x, w.y);
        root.setScale(0.7);
        root.setAlpha(0);
        root.setAngle(card.rotation - 6);
        this.cardLayer.add(root);
        obj = { root };
        this.cardObjs.set(card.instanceId, obj);
        this.tweens.add({
          targets: root,
          scale: 1,
          alpha: 1,
          angle: card.rotation,
          duration: 380,
          ease: "Back.easeOut"
        });
      } else {
        obj.root.setPosition(w.x, w.y);
        obj.root.setAngle(card.rotation);
      }

      const frame = obj.root.getData("frame") as Phaser.GameObjects.Graphics;
      frame.clear();
      if (interactive) {
        const c = isMove ? SELECT : isBonus ? 0x7fe9d8 : 0xf2c14e;
        frame.lineStyle(4, c, 1);
        frame.strokeRoundedRect(-CARD / 2 - 2, -CARD / 2 - 2, CARD + 4, CARD + 4, RADIUS + 2);
      } else {
        frame.lineStyle(1.5, 0xffffff, 0.14);
        frame.strokeRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      }

      const hit = obj.root.getData("hit") as Phaser.GameObjects.Rectangle;
      hit.removeAllListeners();
      const lift = obj.root;
      if (interactive) {
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerover", () => this.tweens.add({ targets: lift, scale: 1.035, duration: 130 }));
        hit.on("pointerout", () => this.tweens.add({ targets: lift, scale: 1, duration: 130 }));
        hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
          e?.stopPropagation?.();
          const pos = { x: card.x, y: card.y };
          if (vm.canPlaceSetupPiece) this.cb.onCardClick?.(pos);
          else if (isMove) this.cb.onMovementTargetClick?.(pos);
          else if (isBonus) this.cb.onBonusTargetClick?.(pos);
          else if (isAdd) this.cb.onAddPieceTargetClick?.(pos);
        });
      } else {
        hit.disableInteractive();
      }
    }

    for (const [id, obj] of this.cardObjs) {
      if (!alive.has(id)) {
        this.tweens.add({
          targets: obj.root,
          alpha: 0,
          scale: 0.7,
          duration: 200,
          onComplete: () => obj.root.destroy()
        });
        this.cardObjs.delete(id);
      }
    }
  }

  private buildCard(def: ReturnType<typeof getForestCardDefinition>): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-CARD / 2 + 3, -CARD / 2 + 8, CARD, CARD, RADIUS);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a1410, 1);
    bg.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);

    const art = CARD - 14;
    const img = this.add.image(0, 0, `card:${def.id}`).setDisplaySize(art, art);

    const corners = this.add.graphics();
    corners.lineStyle(14, 0x0a1410, 1);
    corners.strokeRoundedRect(-CARD / 2 + 7, -CARD / 2 + 7, CARD - 14, CARD - 14, RADIUS - 4);

    const frame = this.add.graphics();

    const hit = this.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0);

    c.add([shadow, bg, img, corners, frame, hit]);
    c.setData("frame", frame);
    c.setData("hit", hit);
    return c;
  }

  private drawHighlights(vm: ForestViewModel): void {
    for (const t of vm.expansionTargets) {
      const w = this.worldOf(t);
      const slot = this.add.container(w.x, w.y);
      const g = this.add.graphics();
      g.fillStyle(0xf2c14e, 0.08);
      g.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      g.lineStyle(3, 0xf2c14e, 0.8);
      this.dashedRoundRect(g, -CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      const plus = this.add
        .text(0, -14, "+", {
          fontFamily: "Outfit, sans-serif",
          fontSize: "44px",
          fontStyle: "300",
          color: "#f2c14e"
        })
        .setOrigin(0.5);
      const label = this.add
        .text(0, 26, "COLOCAR CARTA", {
          fontFamily: "Outfit, sans-serif",
          fontSize: "12px",
          fontStyle: "700",
          color: "#f2c14e"
        })
        .setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e?.stopPropagation?.();
        this.cb.onExpansionTargetClick?.({ x: t.x, y: t.y });
      });
      hit.on("pointerover", () => this.tweens.add({ targets: slot, scale: 1.03, duration: 120 }));
      hit.on("pointerout", () => this.tweens.add({ targets: slot, scale: 1, duration: 120 }));
      slot.add([g, plus, label, hit]);
      this.highlightLayer.add(slot);
      this.pulses.push(
        this.tweens.add({ targets: [plus, label], alpha: { from: 0.5, to: 1 }, duration: 820, yoyo: true, repeat: -1 })
      );
    }

    const ringFor = (positions: GridPosition[], color: number) => {
      for (const p of positions) {
        const w = this.worldOf(p);
        const ring = this.add.graphics();
        ring.lineStyle(4, color, 1);
        ring.strokeRoundedRect(-CARD / 2 - 4, -CARD / 2 - 4, CARD + 8, CARD + 8, RADIUS + 4);
        const cont = this.add.container(w.x, w.y, [ring]);
        this.highlightLayer.add(cont);
        this.pulses.push(
          this.tweens.add({
            targets: cont,
            alpha: { from: 0.55, to: 1 },
            duration: 760,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          })
        );
      }
    };

    ringFor(vm.movementTargets, SELECT);
    ringFor(vm.addPieceTargets, 0xf2c14e);
    ringFor(vm.bonusTargets, 0x7fe9d8);
  }

  private dashedRoundRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const dash = 11;
    const gap = 8;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Phaser.Math.Distance.Between(x1, y1, x2, y2);
      const dx = (x2 - x1) / len;
      const dy = (y2 - y1) / len;
      for (let s = 0; s < len; s += dash + gap) {
        g.lineBetween(x1 + dx * s, y1 + dy * s, x1 + dx * Math.min(s + dash, len), y1 + dy * Math.min(s + dash, len));
      }
    };
    seg(x + r, y, x + w - r, y);
    seg(x + w, y + r, x + w, y + h - r);
    seg(x + w - r, y + h, x + r, y + h);
    seg(x, y + h - r, x, y + r);
  }

  private syncPieces(vm: ForestViewModel): void {
    const byLoc = new Map<string, PieceState[]>();
    for (const p of vm.pieces) {
      if (!p.location) continue;
      const k = `${p.location.x}:${p.location.y}`;
      byLoc.set(k, [...(byLoc.get(k) ?? []), p]);
    }

    const selectable = new Set(vm.selectablePieceIds);
    const selected = new Set([...vm.selectedPieceIds, ...(vm.selectedPieceId ? [vm.selectedPieceId] : [])]);
    const alive = new Set<string>();

    for (const [k, list] of byLoc) {
      const [gx, gy] = k.split(":").map(Number);
      const base = this.worldOf({ x: gx, y: gy });
      const n = list.length;
      const ps = n <= 3 ? 1 : n <= 6 ? 0.85 : 0.7;
      const cols = Math.min(n, 3);
      const rows = Math.ceil(n / cols);
      const sx = 40 * ps;
      const sy = 36 * ps;

      list.forEach((piece, i) => {
        alive.add(piece.pieceId);
        const row = Math.floor(i / cols);
        const inRow = i % cols;
        const rowCount = Math.min(cols, n - row * cols);
        const tx = base.x + (inRow - (rowCount - 1) / 2) * sx;
        const ty = base.y + (row - (rows - 1) / 2) * sy + 28;
        const isSel = selectable.has(piece.pieceId);
        const isPicked = selected.has(piece.pieceId);

        let po = this.pieceObjs.get(piece.pieceId);
        if (!po) {
          const root = this.buildPiece(piece);
          root.setPosition(tx, ty);
          root.setScale(ps * 0.5);
          root.setAlpha(0);
          this.pieceLayer.add(root);
          po = { root, worldX: tx, worldY: ty };
          this.pieceObjs.set(piece.pieceId, po);
          this.tweens.add({ targets: root, scale: ps, alpha: 1, duration: 300, ease: "Back.easeOut" });
        } else if (po.worldX !== tx || po.worldY !== ty) {
          const fromX = po.root.x;
          const fromY = po.root.y;
          po.worldX = tx;
          po.worldY = ty;
          this.arcMove(po.root, fromX, fromY, tx, ty, ps, colorForPiece(piece));
        } else {
          po.root.setScale(ps);
        }

        const glow = po.root.getData("glow") as Phaser.GameObjects.Graphics;
        const pieceImg = po.root.getData("img") as Phaser.GameObjects.Image;
        this.applyPieceHiddenState(po.root, piece, colorForPiece(piece));
        glow.clear();
        if (pieceImg.postFX) {
          pieceImg.postFX.clear();
          if (isPicked) {
            pieceImg.postFX.addGlow(SELECT, 6, 0, false, 0.2, 12);
          }
        }
        if (isPicked) {
          glow.fillStyle(SELECT, 0.16);
          glow.fillEllipse(0, 11, 30, 9);
        } else if (isSel) {
          glow.lineStyle(2, 0xf2c14e, 0.75);
          glow.strokeEllipse(0, 11, 26, 8);
        }

        const hit = po.root.getData("hit") as Phaser.GameObjects.Arc;
        hit.removeAllListeners();
        if (isSel) {
          hit.setInteractive({ useHandCursor: true });
          hit.on("pointerover", () => this.tweens.add({ targets: po!.root, scale: ps * 1.12, duration: 120 }));
          hit.on("pointerout", () => this.tweens.add({ targets: po!.root, scale: ps, duration: 120 }));
          hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
            e?.stopPropagation?.();
            this.cb.onPieceClick?.(piece.pieceId);
          });
        } else {
          hit.disableInteractive();
        }
        po.root.setDepth(isPicked ? 300 : isSel ? 200 : 100 + i);
      });
    }

    for (const [id, po] of this.pieceObjs) {
      if (!alive.has(id)) {
        this.tweens.add({
          targets: po.root,
          alpha: 0,
          scale: 0.4,
          duration: 240,
          onComplete: () => po.root.destroy()
        });
        this.pieceObjs.delete(id);
      }
    }
  }

  private arcMove(
    root: Phaser.GameObjects.Container,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    scale: number,
    color: number
  ): void {
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const lift = Math.min(120, 34 + dist * 0.28);
    const cx = (fromX + toX) / 2;
    const cy = (fromY + toY) / 2 - lift;
    const duration = Phaser.Math.Clamp(260 + dist * 0.45, 320, 720);

    let lastTrail = 0;
    const proxy = { t: 0 };
    root.setDepth(400);

    this.tweens.add({
      targets: proxy,
      t: 1,
      duration,
      ease: "Cubic.easeInOut",
      onUpdate: () => {
        const t = proxy.t;
        const inv = 1 - t;
        const x = inv * inv * fromX + 2 * inv * t * cx + t * t * toX;
        const y = inv * inv * fromY + 2 * inv * t * cy + t * t * toY;
        root.setPosition(x, y);
        root.setScale(scale * (1 + 0.12 * Math.sin(Math.PI * t)));
        if (t - lastTrail > 0.085 && t < 0.96) {
          lastTrail = t;
          this.spawnTrail(x, y + 9, color);
        }
      },
      onComplete: () => {
        root.setPosition(toX, toY);
        root.setScale(scale);
        root.setDepth(100);
      }
    });
  }

  private spawnTrail(x: number, y: number, color: number): void {
    const dot = this.add.ellipse(x, y, 18, 7, color, 0.5);
    dot.setDepth(60);
    this.pieceLayer.add(dot);
    this.tweens.add({
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
    const c = this.add.container(0, 0);
    const color = colorForPiece(piece);

    const shadow = this.add.ellipse(0, 10, 26, 8, 0x000000, 0.32);
    const base = this.add.ellipse(0, 8, 24, 8, color, 1).setStrokeStyle(1.5, INK, 0.9);
    const glow = this.add.graphics();

    const tex = this.textures.get(`meeple:${piece.speciesId}`).getSourceImage();
    const targetH = 34;
    const ww = tex.width || 1;
    const hh = tex.height || 1;
    const img = this.add
      .image(0, -6, `meeple:${piece.speciesId}`)
      .setDisplaySize((targetH * ww) / hh, targetH)
      .setOrigin(0.5, 0.6);

    c.add([shadow, glow, base, img]);

    const hit = this.add.circle(0, -4, 17, 0xffffff, 0);
    c.add(hit);
    c.setData("shadow", shadow);
    c.setData("base", base);
    c.setData("glow", glow);
    c.setData("hit", hit);
    c.setData("img", img);
    this.applyPieceHiddenState(c, piece, color);
    return c;
  }

  private applyPieceHiddenState(root: Phaser.GameObjects.Container, piece: PieceState, color: number): void {
    const isHidden = piece.state.hidden;
    const previous = root.getData("hiddenState") as boolean | undefined;
    const shadow = root.getData("shadow") as Phaser.GameObjects.Ellipse;
    const base = root.getData("base") as Phaser.GameObjects.Ellipse;
    const img = root.getData("img") as Phaser.GameObjects.Image;

    shadow.setAlpha(isHidden ? 0.3 : 0.32);
    base.setFillStyle(isHidden ? HIDDEN_BASE : color, 1);
    img.setAlpha(1);
    if (isHidden) {
      img.setTint(HIDDEN_TINT);
    } else {
      img.clearTint();
    }

    if (previous !== isHidden) {
      root.setData("hiddenState", isHidden);
      this.tweens.add({
        targets: root,
        alpha: isHidden ? 0.72 : 1,
        duration: 140,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => root.setAlpha(1)
      });
    }
  }

  private contentBounds(vm: ForestViewModel): Phaser.Geom.Rectangle {
    const slots = [...vm.cards, ...vm.expansionTargets];
    if (slots.length === 0) {
      return new Phaser.Geom.Rectangle(-CARD * 1.5, -CARD * 1.5, CARD * 3, CARD * 3);
    }
    const xs = slots.map((s) => s.x);
    const ys = slots.map((s) => s.y);
    const minX = Math.min(...xs) * STEP - CARD / 2;
    const maxX = Math.max(...xs) * STEP + CARD / 2;
    const minY = Math.min(...ys) * STEP - CARD / 2;
    const maxY = Math.max(...ys) * STEP + CARD / 2;
    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  private fitCamera(immediate: boolean): void {
    if (!this.vm) return;
    const b = this.contentBounds(this.vm);
    const cam = this.cameras.main;
    const cw = this.scale.gameSize.width || cam.width;
    const ch = this.scale.gameSize.height || cam.height;
    if (cw < 4 || ch < 4) {
      this.time.delayedCall(60, () => this.fitCamera(immediate));
      return;
    }
    const pad = 120;
    const zoom = Phaser.Math.Clamp(
      Math.min(cw / (b.width + pad * 2), ch / (b.height + pad * 2)),
      0.28,
      1
    );
    const cx = b.centerX;
    const cy = b.centerY;
    if (immediate) {
      cam.setZoom(zoom);
      cam.centerOn(cx, cy);
    } else {
      this.tweens.add({ targets: cam, zoom, duration: 460, ease: "Cubic.easeOut" });
      cam.pan(cx, cy, 460, "Cubic.easeOut");
    }
  }

  private setupCameraControls(): void {
    const cam = this.cameras.main;

    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.userAdjusted = true;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0012, 0.28, 2));
    });

    let dragging = false;
    let lx = 0;
    let ly = 0;
    let moved = false;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      dragging = true;
      moved = false;
      lx = p.x;
      ly = p.y;
    });
    this.input.on("pointerup", () => {
      dragging = false;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      const ddx = p.x - lx;
      const ddy = p.y - ly;
      if (Math.abs(ddx) + Math.abs(ddy) > 3) moved = true;
      if (moved) {
        this.userAdjusted = true;
        cam.scrollX -= ddx / cam.zoom;
        cam.scrollY -= ddy / cam.zoom;
      }
      lx = p.x;
      ly = p.y;
    });
  }
}

function viewSignature(vm: ForestViewModel): string {
  const cards = vm.cards
    .map((card) => `${card.instanceId}:${card.definitionId}:${card.x},${card.y}:${card.rotation}:${card.isInitial ? 1 : 0}`)
    .join("|");
  const pieces = vm.pieces
    .map((piece) =>
      `${piece.pieceId}:${piece.ownerId}:${piece.speciesId}:${
        piece.location ? `${piece.location.x},${piece.location.y},${piece.location.siteId}` : "-"
      }:${piece.state.hidden ? 1 : 0}`
    )
    .join("|");
  const positions = (items: GridPosition[]) => items.map((item) => `${item.x},${item.y}`).join("|");

  return [
    cards,
    pieces,
    vm.canPlaceSetupPiece ? 1 : 0,
    positions(vm.expansionTargets),
    positions(vm.movementTargets),
    positions(vm.addPieceTargets),
    positions(vm.bonusTargets),
    vm.selectedPieceId ?? "",
    vm.selectedPieceIds.join("|"),
    vm.selectablePieceIds.join("|")
  ].join(";");
}
