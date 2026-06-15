import Phaser from "phaser";

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

export class ForestAmbientMotes {
  private particles: AmbientParticle[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container
  ) {}

  // Per-frame drift for the ambient motes. Cheap: no tweens, just integrate a
  // slow upward velocity, a sine sway, and a sine twinkle. Particles that drift
  // off the top wrap back in at the bottom.
  update(delta: number): void {
    if (this.particles.length === 0) return;
    const dt = Math.min(delta, 50) / 1000;
    const t = this.scene.time.now / 1000;
    const w = this.scene.scale.gameSize.width || this.scene.cameras.main.width;
    const h = this.scene.scale.gameSize.height || this.scene.cameras.main.height;

    for (const particle of this.particles) {
      particle.y += particle.vy * dt;
      particle.x += Math.sin(t * particle.swayFreq + particle.swayPhase) * particle.swayAmp * dt;
      if (particle.y < -16) {
        particle.y = h + 16;
        particle.x = Math.random() * w;
      }
      if (particle.x < -16) particle.x = w + 16;
      else if (particle.x > w + 16) particle.x = -16;
      const alpha =
        particle.baseAlpha + Math.sin(t * particle.twinkleFreq + particle.twinklePhase) * particle.twinkleAmp;
      particle.obj.setPosition(particle.x, particle.y);
      particle.obj.setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
    }
  }

  spawn(): void {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const w = this.scene.scale.gameSize.width || this.scene.cameras.main.width || 1280;
    const h = this.scene.scale.gameSize.height || this.scene.cameras.main.height || 720;
    // Keep it sparse: roughly one mote per 56k px², clamped so it never clutters.
    const count = Phaser.Math.Clamp(Math.round((w * h) / 56000), 14, 28);

    for (let i = 0; i < count; i += 1) {
      // ~1 in 3 motes is a warm firefly; the rest are spores or tiny leaf flecks.
      const firefly = i % 3 === 0;
      this.particles.push(this.buildParticle(firefly, w, h));
    }
  }

  // Pull any motes that ended up outside the new viewport back into view.
  reflow(): void {
    const w = this.scene.scale.gameSize.width || this.scene.cameras.main.width;
    const h = this.scene.scale.gameSize.height || this.scene.cameras.main.height;
    if (w < 4 || h < 4) return;
    for (const particle of this.particles) {
      if (particle.x < -16 || particle.x > w + 16) particle.x = Math.random() * w;
      if (particle.y < -16 || particle.y > h + 16) particle.y = Math.random() * h;
    }
  }

  private buildParticle(firefly: boolean, w: number, h: number): AmbientParticle {
    const x = Math.random() * w;
    const y = Math.random() * h;

    let obj: Phaser.GameObjects.Arc | Phaser.GameObjects.Ellipse;
    let baseAlpha: number;
    let twinkleAmp: number;

    const leafFleck = !firefly && Math.random() < 0.28;

    if (firefly) {
      const r = Phaser.Math.FloatBetween(2.4, 3.8);
      obj = this.scene.add.circle(x, y, r, 0xffe39a, 1).setBlendMode(Phaser.BlendModes.ADD);
      baseAlpha = 0.34;
      twinkleAmp = 0.24;
    } else if (leafFleck) {
      const size = Phaser.Math.FloatBetween(5, 9);
      obj = this.scene.add.ellipse(
        x,
        y,
        size,
        size * 0.42,
        Phaser.Math.RND.pick([0x6f8f53, 0x7a6a3f, 0x4d764a]),
        1
      );
      obj.setAngle(Phaser.Math.FloatBetween(0, 360));
      baseAlpha = 0.16;
      twinkleAmp = 0.04;
    } else {
      const r = Phaser.Math.FloatBetween(2, 3.2);
      obj = this.scene.add.ellipse(x, y, r * 2, r * 1.4, 0xbcd9a4, 1);
      obj.setAngle(Phaser.Math.FloatBetween(0, 360));
      baseAlpha = 0.24;
      twinkleAmp = 0.08;
    }

    obj.setAlpha(baseAlpha);
    this.layer.add(obj);

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
}
