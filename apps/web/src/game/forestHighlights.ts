import Phaser from "phaser";
import { gridPositionKey as key } from "@oikos/shared";
import type { GridPosition, SpeciesId } from "@oikos/shared";
import type { ForestSceneCallbacks, ForestViewModel } from "./ForestPhaserScene";

interface ForestHighlightRendererOptions {
  scene: Phaser.Scene;
  vm: ForestViewModel;
  layer: Phaser.GameObjects.Container;
  pulses: Phaser.Tweens.Tween[];
  callbacks: ForestSceneCallbacks;
  worldOf: (position: GridPosition) => { x: number; y: number };
  dashedRoundRect: (
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => void;
  createRoundPortraitTexture: (speciesId: SpeciesId) => string | null;
  cardSize: number;
  radius: number;
  selectColor: number;
}

export function drawForestHighlights(options: ForestHighlightRendererOptions): void {
  const { scene, vm, layer, pulses, callbacks, worldOf, dashedRoundRect, createRoundPortraitTexture } = options;
  const CARD = options.cardSize;
  const RADIUS = options.radius;
  const SELECT = options.selectColor;

  for (const target of vm.expansionTargets) {
    const occupied = vm.cards.some((card) => key(card) === key(target));
    const accent = occupied ? 0xd66060 : 0xf2c14e;
    const w = worldOf(target);
    const slot = scene.add.container(w.x, w.y);

    const glow = scene.add.graphics();
    glow.fillStyle(accent, 0.08);
    glow.fillRoundedRect(-CARD / 2 - 6, -CARD / 2 - 6, CARD + 12, CARD + 12, RADIUS + 5);

    const graphics = scene.add.graphics();
    graphics.fillStyle(accent, occupied ? 0.12 : 0.1);
    graphics.fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
    graphics.lineStyle(3.5, accent, 0.95);
    dashedRoundRect(graphics, -CARD / 2, -CARD / 2, CARD, CARD, RADIUS);
    const plus = scene.add
      .text(0, -14, occupied ? "!" : "+", {
        fontFamily: "Outfit, sans-serif",
        fontSize: "46px",
        fontStyle: "300",
        color: occupied ? "#ffb6a9" : "#f2c14e"
      })
      .setOrigin(0.5);
    const label = scene.add
      .text(0, 26, occupied ? "SUBSTITUIR CARTA" : "COLOCAR CARTA", {
        fontFamily: "Outfit, sans-serif",
        fontSize: "12px",
        fontStyle: "700",
        color: occupied ? "#ffb6a9" : "#f2c14e"
      })
      .setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, CARD, CARD, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      callbacks.onExpansionTargetClick?.({ x: target.x, y: target.y });
    });
    hit.on("pointerover", () => scene.tweens.add({ targets: slot, scale: 1.06, duration: 130, ease: "Back.easeOut" }));
    hit.on("pointerout", () => scene.tweens.add({ targets: slot, scale: 1, duration: 130 }));
    slot.add([glow, graphics, plus, label, hit]);
    layer.add(slot);
    pulses.push(
      scene.tweens.add({ targets: [plus, label], alpha: { from: 0.5, to: 1 }, duration: 820, yoyo: true, repeat: -1 })
    );
    pulses.push(
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.25, to: 0.6 },
        scale: { from: 0.98, to: 1.02 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    );
  }

  const ringFor = (positions: GridPosition[], color: number) => {
    for (const position of positions) {
      const w = worldOf(position);
      const ring = scene.add.graphics();
      ring.lineStyle(4, color, 1);
      ring.strokeRoundedRect(-CARD / 2 - 4, -CARD / 2 - 4, CARD + 8, CARD + 8, RADIUS + 4);
      const cont = scene.add.container(w.x, w.y, [ring]);
      layer.add(cont);
      pulses.push(
        scene.tweens.add({
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
    const w = worldOf(item.position);
    const half = CARD / 2;

    const halo = scene.add.graphics();
    halo.fillStyle(item.color, 0.16);
    halo.fillRoundedRect(-half - 12, -half - 12, CARD + 24, CARD + 24, RADIUS + 12);
    const haloCont = scene.add.container(w.x, w.y, [halo]);
    haloCont.setDepth(78);

    const frame = scene.add.graphics();
    frame.fillStyle(item.color, 0.1);
    frame.fillRoundedRect(-half - 6, -half - 6, CARD + 12, CARD + 12, RADIUS + 6);
    frame.lineStyle(7, 0x06110d, 0.8);
    frame.strokeRoundedRect(-half - 6, -half - 6, CARD + 12, CARD + 12, RADIUS + 6);
    frame.lineStyle(3.5, item.color, 1);
    frame.strokeRoundedRect(-half - 6, -half - 6, CARD + 12, CARD + 12, RADIUS + 6);

    const corners = scene.add.graphics();
    corners.lineStyle(4, item.color, 1);
    const o = half + 6;
    const arm = 16;
    const drawCorner = (cx: number, cy: number, sx: number, sy: number) => {
      corners.beginPath();
      corners.moveTo(cx, cy + sy * arm);
      corners.lineTo(cx, cy);
      corners.lineTo(cx + sx * arm, cy);
      corners.strokePath();
    };
    drawCorner(-o, -o, 1, 1);
    drawCorner(o, -o, -1, 1);
    drawCorner(-o, o, 1, -1);
    drawCorner(o, o, -1, -1);

    const speciesIcons = (item.speciesIds ?? []).filter(
      (id) => scene.textures.exists(`portrait:${id}`) || scene.textures.exists(`meeple:${id}`)
    );
    let bw: number;
    if (speciesIcons.length > 0) {
      const ICON = 44;
      const gap = 8;
      const padX = 12;
      const bh = ICON + 14;
      bw = Math.max(ICON + padX * 2, speciesIcons.length * (ICON + gap) - gap + padX * 2);
      const badge = scene.add.container(0, -half - bh / 2 - 8);
      const shadow = scene.add.graphics();
      shadow.fillStyle(0x000000, 0.34);
      shadow.fillRoundedRect(-bw / 2, -bh / 2 + 5, bw, bh, bh / 2);
      const bg = scene.add.graphics();
      bg.fillStyle(0x06110d, 0.94);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
      bg.lineStyle(2, item.color, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
      badge.add([shadow, bg]);
      const rowW = speciesIcons.length * (ICON + gap) - gap;
      let cx = -rowW / 2 + ICON / 2;
      for (const id of speciesIcons) {
        const r = ICON / 2;
        const disc = scene.add.graphics();
        disc.fillStyle(0x12211a, 1);
        disc.fillCircle(cx, 0, r);
        badge.add(disc);
        const roundKey = createRoundPortraitTexture(id);
        if (roundKey) {
          const img = scene.add.image(cx, 0, roundKey).setDisplaySize(ICON, ICON);
          badge.add(img);
        }
        const ring = scene.add.graphics();
        ring.lineStyle(2.5, item.color, 1);
        ring.strokeCircle(cx, 0, r);
        badge.add(ring);
        cx += ICON + gap;
      }
      badge.setDepth(93);
      const cont = scene.add.container(w.x, w.y, [frame, corners, badge]);
      cont.setDepth(80);
      layer.add([haloCont, cont]);
      pulses.push(
        scene.tweens.add({
          targets: haloCont,
          scale: { from: 0.96, to: 1.05 },
          alpha: { from: 0.6, to: 1 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        })
      );
      pulses.push(
        scene.tweens.add({
          targets: badge,
          scale: { from: 0.97, to: 1.04 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        })
      );
      continue;
    }

    const badge = scene.add.container(0, -half - 26);
    const hasResourceIcon = Boolean(item.resource && scene.textures.exists(`res:${item.resource}`));
    bw = hasResourceIcon ? Math.max(52, item.label.length * 8 + 58) : Math.max(44, item.label.length * 8 + 30);
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-bw / 2, -11, bw, 32, 16);
    const bg = scene.add.graphics();
    bg.fillStyle(0x06110d, 0.94);
    bg.fillRoundedRect(-bw / 2, -16, bw, 32, 16);
    bg.lineStyle(2, item.color, 1);
    bg.strokeRoundedRect(-bw / 2, -16, bw, 32, 16);
    const dot = scene.add.graphics();
    dot.fillStyle(item.color, 1);
    dot.fillCircle(-bw / 2 + 13, 0, 3.5);
    badge.add([shadow, bg, dot]);
    if (hasResourceIcon && item.resource) {
      const textWidth = item.label.length * 7;
      if (item.label) {
        badge.add(
          scene.add
            .text(-12, 0, item.label, {
              fontFamily: "Outfit, sans-serif",
              fontSize: "14px",
              fontStyle: "800",
              color: "#f4fbf6"
            })
            .setOrigin(0.5)
        );
      }
      badge.add(scene.add.image(item.label ? textWidth / 2 + 10 : 3, 0, `res:${item.resource}`).setDisplaySize(24, 24));
    } else {
      badge.add(
        scene.add
          .text(6, 0, item.label, {
            fontFamily: "Outfit, sans-serif",
            fontSize: "14px",
            fontStyle: "800",
            color: "#f4fbf6"
          })
          .setOrigin(0.5)
      );
    }

    const cont = scene.add.container(w.x, w.y, [frame, corners, badge]);
    cont.setDepth(80);
    layer.add([haloCont, cont]);

    pulses.push(
      scene.tweens.add({
        targets: haloCont,
        scale: { from: 0.96, to: 1.05 },
        alpha: { from: 0.6, to: 1 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    );
    pulses.push(
      scene.tweens.add({
        targets: badge,
        scale: { from: 0.95, to: 1.06 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    );
  }

  for (const item of vm.scoringLineHighlights) {
    if (item.positions.length < 2) continue;
    const points = item.positions.map((position) => {
      const w = worldOf(position);
      return { x: w.x, y: w.y + 28 };
    });

    const strokeAll = (graphics: Phaser.GameObjects.Graphics) => {
      for (let i = 1; i < points.length; i += 1) {
        graphics.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      }
    };

    const glow = scene.add.graphics();
    glow.lineStyle(20, item.color, 0.12);
    strokeAll(glow);
    glow.lineStyle(13, item.color, 0.2);
    strokeAll(glow);
    glow.setDepth(88);

    const casing = scene.add.graphics();
    casing.lineStyle(11, 0x06110d, 0.82);
    strokeAll(casing);
    casing.setDepth(89);

    const core = scene.add.graphics();
    core.lineStyle(5, item.color, 1);
    strokeAll(core);
    core.setDepth(90);

    const nodes = scene.add.graphics();
    points.forEach((point, idx) => {
      const endpoint = idx === 0 || idx === points.length - 1;
      nodes.fillStyle(0x06110d, 0.85);
      nodes.fillCircle(point.x, point.y, endpoint ? 9 : 5.5);
      nodes.fillStyle(item.color, 1);
      nodes.fillCircle(point.x, point.y, endpoint ? 6.5 : 3.4);
      if (endpoint) {
        nodes.fillStyle(0xffffff, 0.92);
        nodes.fillCircle(point.x, point.y, 2.4);
      }
    });
    nodes.setDepth(90);

    const segs: { ax: number; ay: number; bx: number; by: number; len: number }[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len });
      total += len;
    }
    const spark = scene.add.graphics();
    spark.setDepth(92);
    const drawSpark = (x: number, y: number) => {
      spark.clear();
      spark.fillStyle(item.color, 0.35);
      spark.fillCircle(x, y, 9);
      spark.fillStyle(0xffffff, 0.95);
      spark.fillCircle(x, y, 4);
    };
    drawSpark(points[0].x, points[0].y);
    const progress = { t: 0 };
    pulses.push(
      scene.tweens.add({
        targets: progress,
        t: 1,
        duration: Math.max(900, total * 2.4),
        repeat: -1,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          let dist = progress.t * total;
          for (const segment of segs) {
            if (dist <= segment.len) {
              const r = dist / segment.len;
              drawSpark(segment.ax + (segment.bx - segment.ax) * r, segment.ay + (segment.by - segment.ay) * r);
              return;
            }
            dist -= segment.len;
          }
          const last = points[points.length - 1];
          drawSpark(last.x, last.y);
        }
      })
    );

    const mid = points[Math.floor(points.length / 2)];
    const badge = scene.add.container(mid.x, mid.y - 64);
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(-31, -13, 62, 38, 19);
    const bg = scene.add.graphics();
    bg.fillStyle(0x06110d, 0.94);
    bg.fillRoundedRect(-31, -18, 62, 36, 18);
    bg.lineStyle(2, item.color, 1);
    bg.strokeRoundedRect(-31, -18, 62, 36, 18);
    const dot = scene.add.graphics();
    dot.fillStyle(item.color, 1);
    dot.fillCircle(-15, 0, 4);
    const text = scene.add
      .text(5, 0, item.label, {
        fontFamily: "Outfit, sans-serif",
        fontSize: "17px",
        fontStyle: "900",
        color: "#f4fbf6"
      })
      .setOrigin(0.5);
    badge.add([shadow, bg, dot, text]);
    badge.setDepth(93);

    layer.add([glow, casing, core, nodes, spark, badge]);
    pulses.push(
      scene.tweens.add({
        targets: badge,
        scale: { from: 0.94, to: 1.06 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      })
    );
    pulses.push(
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.55, to: 1 },
        duration: 1100,
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
      const w = worldOf(card);
      const ring = scene.add.graphics();
      ring.lineStyle(5, 0xffd479, 1);
      ring.strokeRoundedRect(-CARD / 2 - 6, -CARD / 2 - 6, CARD + 12, CARD + 12, RADIUS + 6);
      const glow = scene.add.graphics();
      glow.fillStyle(0xffd479, 0.18);
      glow.fillRoundedRect(-CARD / 2 - 6, -CARD / 2 - 6, CARD + 12, CARD + 12, RADIUS + 6);
      const cont = scene.add.container(w.x, w.y, [glow, ring]);
      cont.setDepth(50);
      layer.add(cont);
      pulses.push(
        scene.tweens.add({
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
