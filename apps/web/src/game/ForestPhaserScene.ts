import Phaser from "phaser";
import { forestCardsById, getForestCardDefinition, resourceAssets, speciesDefinitions } from "@oikos/content";
import type { ForestCardState, GridPosition, PieceState, Resource, SpeciesId } from "@oikos/shared";

export interface RotateFitTarget {
  position: GridPosition;
  rotation: number;
}

export interface ForestViewModel {
  cards: ForestCardState[];
  pieces: PieceState[];
  canPlaceSetupPiece: boolean;
  expansionTargets: GridPosition[];
  rotateFitTargets: RotateFitTarget[];
  rotateFitCardId: string | null;
  movementTargets: GridPosition[];
  addPieceTargets: GridPosition[];
  bonusTargets: GridPosition[];
  placementPreview: PlacementPreview | null;
  spotlightInstanceIds: string[];
  selectedPieceId: string | null;
  selectedPieceIds: string[];
  selectablePieceIds: string[];
  scoringCardHighlights: ScoringCardHighlight[];
  scoringLineHighlights: ScoringLineHighlight[];
}

export interface PlacementPreview {
  position: GridPosition;
  rotation: number;
  cardId: string;
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
  onRotateFitTargetClick?: (position: GridPosition, rotation: number) => void;
  onConfirmPlacement?: () => void;
  onCancelPlacement?: () => void;
  onAddPieceTargetClick?: (position: GridPosition) => void;
  onBonusTargetClick?: (position: GridPosition) => void;
  onPieceClick?: (pieceId: string) => void;
  onMovementTargetClick?: (position: GridPosition) => void;
}

const CARD = 196;
const GAP = 6;
const STEP = CARD + GAP;
const RADIUS = 14;

const SELECT = 0x5fd08a;
const HIDDEN_TINT = 0x7f8780;
const MEEPLE_ASSET_VERSION = "2026-06-01-new-meeples-v3";
const MEEPLE_ALPHA_PADDING = 8;

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

interface CardObj {
  root: Phaser.GameObjects.Container;
}

interface PieceObj {
  root: Phaser.GameObjects.Container;
  worldX: number;
  worldY: number;
}

function versionedAsset(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${encodeURI(path)}${separator}v=${MEEPLE_ASSET_VERSION}`;
}

export class ForestPhaserScene extends Phaser.Scene {
  private vm: ForestViewModel | null = null;
  private cb: ForestSceneCallbacks = {};
  private vmSignature = "";

  private surfaceLayer!: Phaser.GameObjects.Container;
  private gridLayer!: Phaser.GameObjects.Container;
  private ambientLayer!: Phaser.GameObjects.Container;
  private highlightLayer!: Phaser.GameObjects.Container;
  private cardLayer!: Phaser.GameObjects.Container;
  private pieceLayer!: Phaser.GameObjects.Container;

  private cardObjs = new Map<string, CardObj>();
  private pieceObjs = new Map<string, PieceObj>();
  // Last known world position (card-local offset included) for every piece we
  // have rendered, kept even after the piece is removed so removal effects can
  // fire at the exact spot the meeple sat. Converted to screen on demand.
  private lastPieceWorld = new Map<string, { x: number; y: number }>();
  private pulses: Phaser.Tweens.Tween[] = [];
  private ambient: AmbientParticle[] = [];

  private ambientCamera?: Phaser.Cameras.Scene2D.Camera;

  private woodEl?: HTMLElement | null;
  private lastWoodSig = "";

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
      this.load.image(`meeple:${sp.speciesId}`, versionedAsset(sp.meepleAsset));
    }
    (Object.keys(resourceAssets) as Array<Resource | "point">).forEach((r) => {
      this.load.image(`res:${r}`, encodeURI(resourceAssets[r]));
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    for (const sp of Object.values(speciesDefinitions)) {
      this.createTrimmedMeepleTexture(sp.speciesId);
    }

    this.surfaceLayer = this.add.container(0, 0);
    this.gridLayer = this.add.container(0, 0);
    this.ambientLayer = this.add.container(0, 0);
    this.highlightLayer = this.add.container(0, 0);
    this.cardLayer = this.add.container(0, 0);
    this.pieceLayer = this.add.container(0, 0);
    this.surfaceLayer.setDepth(0);
    this.gridLayer.setDepth(1);
    this.ambientLayer.setDepth(5);
    this.cardLayer.setDepth(10);
    this.highlightLayer.setDepth(20);
    this.pieceLayer.setDepth(30);

    // Ambient motes live on a dedicated camera with no zoom/scroll, so they
    // float gently over the whole viewport regardless of how the main camera
    // pans or zooms onto the forest. The main camera ignores the mote layer and
    // the mote camera ignores the board, so neither bleeds into the other.
    const gw = this.scale.gameSize.width || this.cameras.main.width || 1280;
    const gh = this.scale.gameSize.height || this.cameras.main.height || 720;
    this.ambientCamera = this.cameras.add(0, 0, gw, gh);
    this.ambientCamera.transparent = true;
    this.ambientCamera.setScroll(0, 0);
    this.cameras.main.ignore(this.ambientLayer);
    this.ambientCamera.ignore([
      this.surfaceLayer,
      this.gridLayer,
      this.highlightLayer,
      this.cardLayer,
      this.pieceLayer
    ]);

    this.setupCameraControls();
    this.spawnAmbient();

    this.scale.on("resize", () => {
      if (!this.userAdjusted) this.fitCamera(true);
      const w = this.scale.gameSize.width || this.cameras.main.width;
      const h = this.scale.gameSize.height || this.cameras.main.height;
      this.ambientCamera?.setSize(w, h);
      this.reflowAmbient();
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

  // Per-frame drift for the ambient motes. Cheap: no tweens, just integrate a
  // slow upward velocity, a sine sway, and a sine twinkle. Particles that drift
  // off the top wrap back in at the bottom.
  // Drive the .table-wood DOM layer so the wooden surface zooms and pans with
  // the main camera, keeping the planks locked to the cards resting on them.
  // The layer is in world coordinates (origin 0 0); we replicate the camera's
  // world→screen transform: screen = cam.(x|y) + (world - scroll) * zoom, with
  // the layer's top-left anchored at world WORLD_MIN so negative coords show.
  private syncWood(): void {
    if (this.woodEl === undefined) {
      const host = this.game.canvas?.parentElement as HTMLElement | null;
      this.woodEl =
        (host?.closest(".playfield-panel")?.querySelector(".table-wood") as HTMLElement | null) ?? null;
    }
    const el = this.woodEl;
    if (!el) return;

    const cam = this.cameras.main;
    const z = cam.zoom;
    // Layer top-left is anchored at this world coordinate; must match the
    // 24000px layer size (covers world [-12000, 12000]) so negative coords show.
    const WORLD_MIN = -12000;
    const tx = cam.x + (WORLD_MIN - cam.scrollX) * z;
    const ty = cam.y + (WORLD_MIN - cam.scrollY) * z;
    const sig = `${z.toFixed(4)}|${tx.toFixed(1)}|${ty.toFixed(1)}`;
    if (sig === this.lastWoodSig) return;
    this.lastWoodSig = sig;
    // 2D transform (not translate3d) to avoid promoting this huge layer.
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
  }

  update(_time: number, delta: number): void {
    this.syncWood();
    if (this.ambient.length === 0) return;
    const dt = Math.min(delta, 50) / 1000;
    const t = this.time.now / 1000;
    const w = this.scale.gameSize.width || this.cameras.main.width;
    const h = this.scale.gameSize.height || this.cameras.main.height;

    for (const p of this.ambient) {
      p.y += p.vy * dt;
      p.x += Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp * dt;
      if (p.y < -16) {
        p.y = h + 16;
        p.x = Math.random() * w;
      }
      if (p.x < -16) p.x = w + 16;
      else if (p.x > w + 16) p.x = -16;
      const alpha = p.baseAlpha + Math.sin(t * p.twinkleFreq + p.twinklePhase) * p.twinkleAmp;
      p.obj.setPosition(p.x, p.y);
      p.obj.setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
    }
  }

  private spawnAmbient(): void {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const w = this.scale.gameSize.width || this.cameras.main.width || 1280;
    const h = this.scale.gameSize.height || this.cameras.main.height || 720;
    // Keep it sparse: roughly one mote per 56k px², clamped so it never clutters.
    const count = Phaser.Math.Clamp(Math.round((w * h) / 56000), 14, 28);

    for (let i = 0; i < count; i += 1) {
      // ~1 in 3 motes is a warm firefly; the rest are spores or tiny leaf flecks.
      const firefly = i % 3 === 0;
      this.ambient.push(this.buildAmbientParticle(firefly, w, h));
    }
  }

  private buildAmbientParticle(firefly: boolean, w: number, h: number): AmbientParticle {
    const x = Math.random() * w;
    const y = Math.random() * h;

    let obj: Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
    let baseAlpha: number;
    let twinkleAmp: number;

    const leafFleck = !firefly && Math.random() < 0.28;

    if (firefly) {
      const r = Phaser.Math.FloatBetween(2.4, 3.8);
      obj = this.add.circle(x, y, r, 0xffe39a, 1).setBlendMode(Phaser.BlendModes.ADD);
      baseAlpha = 0.34;
      twinkleAmp = 0.24;
    } else if (leafFleck) {
      const size = Phaser.Math.FloatBetween(5, 9);
      obj = this.add.ellipse(x, y, size, size * 0.42, Phaser.Math.RND.pick([0x6f8f53, 0x7a6a3f, 0x4d764a]), 1);
      obj.setAngle(Phaser.Math.FloatBetween(0, 360));
      baseAlpha = 0.16;
      twinkleAmp = 0.04;
    } else {
      const r = Phaser.Math.FloatBetween(2, 3.2);
      obj = this.add.ellipse(x, y, r * 2, r * 1.4, 0xbcd9a4, 1);
      obj.setAngle(Phaser.Math.FloatBetween(0, 360));
      baseAlpha = 0.24;
      twinkleAmp = 0.08;
    }

    obj.setAlpha(baseAlpha);
    this.ambientLayer.add(obj);

    return {
      obj,
      x,
      y,
      vy: -Phaser.Math.FloatBetween(firefly ? 7 : leafFleck ? 2 : 4, firefly ? 15 : leafFleck ? 7 : 11),
      swayAmp: Phaser.Math.FloatBetween(leafFleck ? 10 : 6, leafFleck ? 22 : 16),
      swayFreq: Phaser.Math.FloatBetween(leafFleck ? 0.26 : 0.18, leafFleck ? 0.62 : 0.5),
      swayPhase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      baseAlpha,
      twinkleAmp,
      twinkleFreq: Phaser.Math.FloatBetween(0.6, 1.6),
      twinklePhase: Phaser.Math.FloatBetween(0, Math.PI * 2)
    };
  }

  // Pull any motes that ended up outside the new viewport back into view.
  private reflowAmbient(): void {
    const w = this.scale.gameSize.width || this.cameras.main.width;
    const h = this.scale.gameSize.height || this.cameras.main.height;
    if (w < 4 || h < 4) return;
    for (const p of this.ambient) {
      if (p.x < -16 || p.x > w + 16) p.x = Math.random() * w;
      if (p.y < -16 || p.y > h + 16) p.y = Math.random() * h;
    }
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

  // Screen point (canvas-local) of a piece's last rendered position, including
  // its card-local offset. Returns null if we never rendered that piece.
  getPieceScreenPoint(pieceId: string): { x: number; y: number } | null {
    if (!this.ready) return null;
    const world = this.lastPieceWorld.get(pieceId);
    if (!world) return null;
    const camera = this.cameras.main;
    return {
      x: camera.x + (world.x - camera.scrollX) * camera.zoom,
      y: camera.y + (world.y - camera.scrollY) * camera.zoom
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
    this.drawRotateFitGhosts(vm);
    this.drawPlacementPreview(vm);
    this.syncPieces(vm);

    const slots = vm.cards.length + vm.expansionTargets.length + (vm.placementPreview ? 1 : 0);
    if (slots !== this.lastSlotCount) {
      this.lastSlotCount = slots;
      if (!this.userAdjusted) this.fitCamera(this.cardObjs.size <= slots);
    }
  }

  private drawSurface(_vm: ForestViewModel): void {
    // Nothing is drawn behind the cards: no panel, no framing rectangle, no
    // engraved slot grooves. Each card carries only its own soft contact shadow
    // (buildCard), so the forest reads as cards resting directly on the wood
    // table. Empty expansion spots are shown by the gold dashed highlight in
    // drawHighlights, not by a dark outline here.
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

    const img = this.add.image(0, 0, `card:${def.id}`).setDisplaySize(CARD, CARD);

    // Subtle top-left rim from the table light.
    const highlight = this.add.graphics();
    highlight.lineStyle(1.5, 0xffffff, 0.22);
    highlight.beginPath();
    highlight.moveTo(-CARD / 2 + RADIUS, -CARD / 2 + 1);
    highlight.lineTo(CARD / 2 - RADIUS, -CARD / 2 + 1);
    highlight.strokePath();
    highlight.lineStyle(1, 0xffffff, 0.12);
    highlight.beginPath();
    highlight.moveTo(-CARD / 2 + 1, -CARD / 2 + RADIUS);
    highlight.lineTo(-CARD / 2 + 1, CARD / 2 - RADIUS);
    highlight.strokePath();

    const frame = this.add.graphics();

    const hit = this.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0);

    c.add([img, highlight, frame, hit]);
    c.setData("frame", frame);
    c.setData("hit", hit);
    return c;
  }

  private drawHighlights(vm: ForestViewModel): void {
    for (const t of vm.expansionTargets) {
      const occupied = vm.cards.some((card) => key(card) === key(t));
      const w = this.worldOf(t);
      const slot = this.add.container(w.x, w.y);
      const g = this.add.graphics();
      g.fillStyle(occupied ? 0xd66060 : 0xf2c14e, occupied ? 0.1 : 0.08);
      g.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      g.lineStyle(3, occupied ? 0xd66060 : 0xf2c14e, 0.8);
      this.dashedRoundRect(g, -CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      const plus = this.add
        .text(0, -14, occupied ? "!" : "+", {
          fontFamily: "Outfit, sans-serif",
          fontSize: "44px",
          fontStyle: "300",
          color: occupied ? "#ffb6a9" : "#f2c14e"
        })
        .setOrigin(0.5);
      const label = this.add
        .text(0, 26, occupied ? "SUBSTITUIR CARTA" : "COLOCAR CARTA", {
          fontFamily: "Outfit, sans-serif",
          fontSize: "12px",
          fontStyle: "700",
          color: occupied ? "#ffb6a9" : "#f2c14e"
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

  // Ghost previews of a river card at positions where it would only fit after
  // rotating. Each ghost is drawn at the rotation that connects, tinted blue,
  // with a rotate badge, so the player sees they can snap it there by rotating.
  private drawRotateFitGhosts(vm: ForestViewModel): void {
    const cardId = vm.rotateFitCardId;
    if (!cardId || vm.rotateFitTargets.length === 0) return;
    const textureKey = `card:${cardId}`;
    if (!this.textures.exists(textureKey)) return;

    const RIVER = 0x3a7fc4;

    for (const target of vm.rotateFitTargets) {
      const w = this.worldOf(target.position);
      const slot = this.add.container(w.x, w.y);

      const img = this.add
        .image(0, 0, textureKey)
        .setDisplaySize(CARD, CARD)
        .setAngle(target.rotation)
        .setAlpha(0.38);

      const frame = this.add.graphics();
      frame.fillStyle(RIVER, 0.1);
      frame.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
      frame.lineStyle(3, RIVER, 0.9);
      this.dashedRoundRect(frame, -CARD / 2, -CARD / 2, CARD, CARD, RADIUS);

      // Rotate badge: circular chip with the rotation degrees needed.
      const badge = this.add.graphics();
      badge.fillStyle(RIVER, 0.95);
      badge.fillCircle(0, 0, 20);
      badge.lineStyle(2, 0xffffff, 0.85);
      badge.strokeCircle(0, 0, 20);
      const badgeIcon = this.add
        .text(0, -2, "↻", {
          fontFamily: "Outfit, sans-serif",
          fontSize: "22px",
          fontStyle: "700",
          color: "#ffffff"
        })
        .setOrigin(0.5);
      const badgeText = this.add
        .text(0, 30, `${target.rotation}°`, {
          fontFamily: "Outfit, sans-serif",
          fontSize: "13px",
          fontStyle: "800",
          color: "#dbeeff"
        })
        .setOrigin(0.5);
      const badgeGroup = this.add.container(0, -4, [badge, badgeIcon, badgeText]);

      const hit = this.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e?.stopPropagation?.();
        this.cb.onRotateFitTargetClick?.({ x: target.position.x, y: target.position.y }, target.rotation);
      });
      hit.on("pointerover", () => this.tweens.add({ targets: slot, scale: 1.03, duration: 120 }));
      hit.on("pointerout", () => this.tweens.add({ targets: slot, scale: 1, duration: 120 }));

      slot.add([img, frame, badgeGroup, hit]);
      this.highlightLayer.add(slot);
      this.pulses.push(
        this.tweens.add({ targets: img, alpha: { from: 0.24, to: 0.46 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })
      );
    }
  }

  // Pending placement: a solid preview of the card at the chosen slot with
  // confirm/cancel buttons floating above it, to guard against misclicks.
  private drawPlacementPreview(vm: ForestViewModel): void {
    const preview = vm.placementPreview;
    if (!preview) return;
    const textureKey = `card:${preview.cardId}`;
    if (!this.textures.exists(textureKey)) return;

    const w = this.worldOf(preview.position);
    const slot = this.add.container(w.x, w.y);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(-CARD / 2 + 3, -CARD / 2 + 6, CARD - 2, CARD, RADIUS);

    const img = this.add
      .image(0, 0, textureKey)
      .setDisplaySize(CARD, CARD)
      .setAngle(preview.rotation)
      .setAlpha(0.95);

    const frame = this.add.graphics();
    frame.lineStyle(4, 0xf2c14e, 1);
    frame.strokeRoundedRect(-CARD / 2 - 2, -CARD / 2 - 2, CARD + 4, CARD + 4, RADIUS + 2);

    slot.add([shadow, img, frame]);

    // Confirm / cancel buttons, centered above the card.
    const makeButton = (
      offsetX: number,
      fill: number,
      glyph: string,
      handler?: () => void
    ): Phaser.GameObjects.Container => {
      const g = this.add.graphics();
      g.fillStyle(0x0d1a14, 0.95);
      g.fillCircle(0, 0, 24);
      g.fillStyle(fill, 1);
      g.fillCircle(0, 0, 21);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(0, 0, 24);
      const icon = this.add
        .text(0, -1, glyph, {
          fontFamily: "Outfit, sans-serif",
          fontSize: "24px",
          fontStyle: "800",
          color: "#0d1a14"
        })
        .setOrigin(0.5);
      const hit = this.add.circle(0, 0, 26, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e?.stopPropagation?.();
        handler?.();
      });
      const btn = this.add.container(offsetX, -CARD / 2 - 34, [g, icon, hit]);
      hit.on("pointerover", () => this.tweens.add({ targets: btn, scale: 1.12, duration: 110 }));
      hit.on("pointerout", () => this.tweens.add({ targets: btn, scale: 1, duration: 110 }));
      return btn;
    };

    const confirm = makeButton(-30, 0x5fd08a, "✓", () => this.cb.onConfirmPlacement?.());
    const cancel = makeButton(30, 0xe06a5a, "✕", () => this.cb.onCancelPlacement?.());
    slot.add([confirm, cancel]);

    this.highlightLayer.add(slot);
    this.pulses.push(
      this.tweens.add({ targets: frame, alpha: { from: 0.6, to: 1 }, duration: 760, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })
    );
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
        this.lastPieceWorld.set(piece.pieceId, { x: tx, y: ty });
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
            pieceImg.postFX.addGlow(SELECT, 6, 0, false, 0.2, 12);
          }
        }
        if (isPicked) {
          glow.fillStyle(SELECT, 0.28);
          glow.fillCircle(0, -4, 31);
          glow.lineStyle(5, SELECT, 1);
          glow.strokeCircle(0, -4, 33);
          glow.lineStyle(2, 0xffffff, 0.9);
          glow.strokeCircle(0, -4, 38);
        } else if (isSel) {
          glow.fillStyle(SELECT, 0.2);
          glow.fillCircle(0, -4, 29);
          glow.lineStyle(4, SELECT, 0.98);
          glow.strokeCircle(0, -4, 32);
          glow.lineStyle(2, 0xffffff, 0.75);
          glow.strokeCircle(0, -4, 37);
          this.pulses.push(
            this.tweens.add({
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
        this.tweens.add({
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

  private spawnTrail(x: number, y: number): void {
    const dot = this.add.ellipse(x, y, 16, 5, 0x000000, 0.1);
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

  private createTrimmedMeepleTexture(speciesId: SpeciesId): string {
    const sourceKey = `meeple:${speciesId}`;
    const trimmedKey = `meeple-trimmed:${speciesId}`;
    if (this.textures.exists(trimmedKey)) return trimmedKey;

    const texture = this.textures.get(sourceKey);
    const image = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const width = Math.max(1, Math.floor(image.width ?? 1));
    const height = Math.max(1, Math.floor(image.height ?? 1));
    const scan = document.createElement("canvas");
    scan.width = width;
    scan.height = height;
    const scanCtx = scan.getContext("2d");
    if (!scanCtx) return sourceKey;

    scanCtx.drawImage(image, 0, 0, width, height);
    const pixels = scanCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return sourceKey;

    const sx = Math.max(0, minX - MEEPLE_ALPHA_PADDING);
    const sy = Math.max(0, minY - MEEPLE_ALPHA_PADDING);
    const sw = Math.min(width, maxX + MEEPLE_ALPHA_PADDING + 1) - sx;
    const sh = Math.min(height, maxY + MEEPLE_ALPHA_PADDING + 1) - sy;
    const trimmed = document.createElement("canvas");
    trimmed.width = sw;
    trimmed.height = sh;
    trimmed.getContext("2d")?.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    this.textures.addCanvas(trimmedKey, trimmed);
    return trimmedKey;
  }

  private buildPiece(piece: PieceState): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const shadow = this.add.ellipse(3, 17, 34, 10, 0x000000, 0.18);
    const glow = this.add.graphics();

    const textureKey = this.createTrimmedMeepleTexture(piece.speciesId);
    const tex = this.textures.get(textureKey).getSourceImage();
    const targetH = 44;
    const ww = tex.width || 1;
    const hh = tex.height || 1;
    const img = this.add
      .image(0, -8, textureKey)
      .setDisplaySize((targetH * ww) / hh, targetH)
      .setOrigin(0.5, 0.6);

    c.add([shadow, glow, img]);

    const hit = this.add.circle(0, -5, 22, 0xffffff, 0);
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
    const slots = [
      ...vm.cards,
      ...vm.expansionTargets,
      ...(vm.placementPreview ? [vm.placementPreview.position] : [])
    ];
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
    // Enable multi-touch (mouse + two fingers) for pinch-zoom on phones/tablets.
    this.input.addPointer(2);

    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.userAdjusted = true;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.0012, 0.28, 2));
    });

    let dragging = false;
    let lx = 0;
    let ly = 0;
    let moved = false;
    let pinchDist = 0;

    const touchPointers = (): Phaser.Input.Pointer[] =>
      [this.input.pointer1, this.input.pointer2].filter((p) => p && p.isDown);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const down = touchPointers();
      if (down.length >= 2) {
        // Second finger down: start a pinch, cancel any single-finger pan.
        pinchDist = Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y);
        dragging = false;
        return;
      }
      dragging = true;
      moved = false;
      lx = p.x;
      ly = p.y;
    });

    this.input.on("pointerup", () => {
      const down = touchPointers();
      if (down.length < 2) pinchDist = 0;
      if (down.length === 0) dragging = false;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const down = touchPointers();
      if (down.length >= 2) {
        // Pinch: zoom by the ratio of finger distance between frames.
        const dist = Phaser.Math.Distance.Between(down[0].x, down[0].y, down[1].x, down[1].y);
        if (pinchDist > 0 && dist > 0) {
          this.userAdjusted = true;
          cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dist / pinchDist), 0.28, 2));
        }
        pinchDist = dist;
        dragging = false;
        return;
      }
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

interface AmbientParticle {
  obj: Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  baseAlpha: number;
  twinkleAmp: number;
  twinkleFreq: number;
  twinklePhase: number;
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
    `${vm.rotateFitCardId ?? ""}#${vm.rotateFitTargets.map((t) => `${t.position.x},${t.position.y}:${t.rotation}`).join("|")}`,
    vm.placementPreview
      ? `${vm.placementPreview.cardId}:${vm.placementPreview.position.x},${vm.placementPreview.position.y}:${vm.placementPreview.rotation}`
      : "",
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
