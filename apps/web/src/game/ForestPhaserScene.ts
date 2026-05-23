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
  spotlightInstanceIds: string[];
  selectedPieceId: string | null;
  selectedPieceIds: string[];
  selectablePieceIds: string[];
  scoringCardHighlights: ScoringCardHighlight[];
  scoringLineHighlights: ScoringLineHighlight[];
}

export interface ScoringCardHighlight {
  position: GridPosition;
  label: string;
  color: number;
}

export interface ScoringLineHighlight {
  positions: GridPosition[];
  label: string;
  color: number;
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
const GAP = 6;
const STEP = CARD + GAP;
const RADIUS = 14;

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

// Deterministic -1deg..1deg jitter per card instance, purely cosmetic so cards
// look hand-placed rather than perfectly aligned. Stable across re-renders.
function angleJitter(instanceId: string): number {
  let h = 0;
  for (let i = 0; i < instanceId.length; i++) {
    h = (h * 31 + instanceId.charCodeAt(i)) | 0;
  }
  return (((h % 200) + 200) % 200) / 100 - 1;
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
    this.surfaceLayer.setDepth(0);
    this.gridLayer.setDepth(1);
    this.cardLayer.setDepth(10);
    this.highlightLayer.setDepth(20);
    this.pieceLayer.setDepth(30);

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
    // Account for camera display offset (camera.x/y) plus world-to-screen transform via zoom + scroll.
    return {
      x: camera.x + (world.x - camera.scrollX) * camera.zoom,
      y: camera.y + (world.y - camera.scrollY) * camera.zoom
    };
  }

  getCardScreenSize(): number {
    if (!this.ready) return 0;
    return CARD * this.cameras.main.zoom;
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
    // No panel or framing rectangle behind the cards. Each card carries its own
    // contact shadow (buildCard), so the forest reads as cards resting directly
    // on the table rather than a floating board with an outline.

    // Empty slots = marks engraved into the table, not digital squares.
    for (const s of [...vm.cards, ...vm.expansionTargets]) {
      const w = this.worldOf(s);
      const slot = this.add.graphics();
      // dark groove
      slot.lineStyle(1.5, 0x1c0f08, 0.28);
      slot.strokeRoundedRect(w.x - CARD / 2, w.y - CARD / 2, CARD, CARD, RADIUS);
      // faint lit edge just inside, for a carved look
      slot.lineStyle(1, 0xb98a4b, 0.06);
      slot.strokeRoundedRect(w.x - CARD / 2 + 1.5, w.y - CARD / 2 + 1.5, CARD - 3, CARD - 3, RADIUS - 1);
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

      const restAngle = card.rotation + angleJitter(card.instanceId);

      let obj = this.cardObjs.get(card.instanceId);
      if (!obj) {
        const root = this.buildCard(def);
        root.setPosition(w.x, w.y);
        root.setAngle(restAngle - 6);
        this.cardLayer.add(root);
        obj = { root };
        this.cardObjs.set(card.instanceId, obj);

        if (card.isInitial) {
          const diagonal = card.x - card.y + 2; // 0..4 across 3x3 anti-diagonals
          const delay = Math.max(0, diagonal) * 90;
          root.setScale(0.55);
          root.setAlpha(0);
          root.setY(w.y - 36);
          this.tweens.add({
            targets: root,
            y: w.y,
            scale: 1,
            alpha: 1,
            angle: restAngle,
            duration: 460,
            delay,
            ease: "Back.easeOut"
          });
        } else {
          // Slide in and settle onto the table.
          root.setScale(0.55);
          root.setAlpha(0);
          root.setY(w.y - 36);
          this.tweens.add({
            targets: root,
            y: w.y,
            scale: 1,
            alpha: 1,
            angle: restAngle,
            duration: 460,
            ease: "Back.easeOut"
          });
          this.spawnCardLandingPulse(w.x, w.y);
          this.spawnLeafBurst(w.x, w.y);
        }
      } else {
        obj.root.setPosition(w.x, w.y);
        obj.root.setAngle(restAngle);
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

    // Contact shadow: a short, darker shadow sits close below the card, with a
    // wider soft falloff beneath it. Reads as a card resting on the table.
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.12);
    shadow.fillRoundedRect(-CARD / 2, -CARD / 2 + 9, CARD + 2, CARD, RADIUS + 2);
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-CARD / 2 + 3, -CARD / 2 + 4, CARD - 4, CARD, RADIUS);

    const img = this.add.image(0, 0, `card:${def.id}`).setDisplaySize(CARD, CARD);

    // Subtle lit edge along the top of the card.
    const highlight = this.add.graphics();
    highlight.lineStyle(1.5, 0xffffff, 0.16);
    highlight.beginPath();
    highlight.moveTo(-CARD / 2 + RADIUS, -CARD / 2 + 1);
    highlight.lineTo(CARD / 2 - RADIUS, -CARD / 2 + 1);
    highlight.strokePath();

    const frame = this.add.graphics();

    const hit = this.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0);

    c.add([shadow, img, highlight, frame, hit]);
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

    for (const item of vm.scoringCardHighlights) {
      const w = this.worldOf(item.position);
      const glow = this.add.graphics();
      glow.fillStyle(item.color, 0.18);
      glow.fillRoundedRect(-CARD / 2 - 7, -CARD / 2 - 7, CARD + 14, CARD + 14, RADIUS + 7);
      glow.lineStyle(5, item.color, 0.96);
      glow.strokeRoundedRect(-CARD / 2 - 7, -CARD / 2 - 7, CARD + 14, CARD + 14, RADIUS + 7);
      const label = this.add
        .text(0, -CARD / 2 - 22, item.label, {
          fontFamily: "Outfit, sans-serif",
          fontSize: "16px",
          fontStyle: "800",
          color: "#fff7c7",
          backgroundColor: "rgba(12, 23, 18, 0.82)",
          padding: { x: 8, y: 4 }
        })
        .setOrigin(0.5);
      const cont = this.add.container(w.x, w.y, [glow, label]);
      cont.setDepth(80);
      this.highlightLayer.add(cont);
      this.pulses.push(
        this.tweens.add({
          targets: cont,
          alpha: { from: 0.62, to: 1 },
          duration: 620,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        })
      );
    }

    for (const item of vm.scoringLineHighlights) {
      if (item.positions.length < 2) continue;
      const points = item.positions.map((position) => {
        const w = this.worldOf(position);
        return { x: w.x, y: w.y + 28 };
      });
      const line = this.add.graphics();
      line.lineStyle(12, 0x08130f, 0.76);
      for (let i = 1; i < points.length; i += 1) {
        line.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      }
      line.lineStyle(6, item.color, 1);
      for (let i = 1; i < points.length; i += 1) {
        line.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      }
      const mid = points[Math.floor(points.length / 2)];
      const badge = this.add.container(mid.x, mid.y - 64);
      const bg = this.add.graphics();
      bg.fillStyle(item.color, 0.94);
      bg.fillRoundedRect(-28, -18, 56, 36, 18);
      const text = this.add
        .text(0, 0, item.label, {
          fontFamily: "Outfit, sans-serif",
          fontSize: "17px",
          fontStyle: "900",
          color: "#06110d"
        })
        .setOrigin(0.5);
      badge.add([bg, text]);
      line.setDepth(90);
      badge.setDepth(91);
      this.highlightLayer.add([line, badge]);
      this.pulses.push(
        this.tweens.add({
          targets: [line, badge],
          alpha: { from: 0.68, to: 1 },
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        })
      );
    }

    const spotlightSet = new Set(vm.spotlightInstanceIds);
    if (spotlightSet.size > 0) {
      for (const card of vm.cards) {
        if (!spotlightSet.has(card.instanceId)) continue;
        const w = this.worldOf(card);
        const ring = this.add.graphics();
        ring.lineStyle(5, 0xffd479, 1);
        ring.strokeRoundedRect(-CARD / 2 - 6, -CARD / 2 - 6, CARD + 12, CARD + 12, RADIUS + 6);
        const glow = this.add.graphics();
        glow.fillStyle(0xffd479, 0.18);
        glow.fillRoundedRect(-CARD / 2 - 6, -CARD / 2 - 6, CARD + 12, CARD + 12, RADIUS + 6);
        const cont = this.add.container(w.x, w.y, [glow, ring]);
        cont.setDepth(50);
        this.highlightLayer.add(cont);
        this.pulses.push(
          this.tweens.add({
            targets: cont,
            alpha: { from: 0.55, to: 1 },
            duration: 540,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          })
        );
      }
    }
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

  private spawnCardLandingPulse(x: number, y: number): void {
    const ring = this.add.graphics();
    ring.lineStyle(4, 0xf2c14e, 0.9);
    ring.strokeCircle(0, 0, CARD * 0.42);
    ring.setPosition(x, y);
    ring.setDepth(498);
    ring.setScale(0.4);
    ring.setAlpha(0.95);
    this.pieceLayer.add(ring);
    this.tweens.add({
      targets: ring,
      scale: 1.35,
      alpha: 0,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });

    const inner = this.add.graphics();
    inner.fillStyle(0xffffff, 0.18);
    inner.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
    inner.setPosition(x, y);
    inner.setDepth(497);
    inner.setAlpha(0);
    this.pieceLayer.add(inner);
    this.tweens.add({
      targets: inner,
      alpha: { from: 0.45, to: 0 },
      duration: 480,
      ease: "Quad.easeOut",
      onComplete: () => inner.destroy()
    });
  }

  private spawnLeafBurst(x: number, y: number): void {
    const count = 14;
    const colors = [0x6fae5f, 0x4f9d4a, 0x8dc472, 0xa3d489, 0x3f8a3d];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.15, 0.15);
      const dist = Phaser.Math.FloatBetween(40, 110);
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist + Phaser.Math.FloatBetween(-10, 30);
      const color = colors[i % colors.length];
      const size = Phaser.Math.FloatBetween(6, 11);

      const leaf = this.add.ellipse(x, y, size, size * 0.55, color, 0.92);
      leaf.setAngle(Phaser.Math.FloatBetween(0, 360));
      leaf.setDepth(500);
      this.pieceLayer.add(leaf);

      const duration = Phaser.Math.Between(640, 980);
      this.tweens.add({
        targets: leaf,
        x: tx,
        y: ty,
        angle: leaf.angle + Phaser.Math.FloatBetween(140, 360),
        scaleX: { from: 1, to: 0.3 },
        scaleY: { from: 1, to: 0.3 },
        alpha: { from: 0.95, to: 0 },
        duration,
        ease: "Cubic.easeOut",
        onComplete: () => leaf.destroy()
      });
    }

    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.25);
    flash.fillCircle(x, y, 18);
    flash.setDepth(499);
    this.pieceLayer.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
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
    vm.spotlightInstanceIds.join("|"),
    vm.selectedPieceId ?? "",
    vm.selectedPieceIds.join("|"),
    vm.selectablePieceIds.join("|"),
    vm.scoringCardHighlights.map((item) => `${item.position.x},${item.position.y}:${item.label}:${item.color}`).join("|"),
    vm.scoringLineHighlights
      .map((item) => `${item.positions.map((position) => `${position.x},${position.y}`).join(">")}:${item.label}:${item.color}`)
      .join("|")
  ].join(";");
}
