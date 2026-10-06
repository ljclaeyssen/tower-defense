import * as Phaser from 'phaser';
import { TICK_MS, TOWERS, TOWER_FOOTPRINT, getTowerDef } from '@td/shared';
import type {
  CreepState,
  EntityId,
  GameEvent,
  GameState,
  LaneState,
  PlayerId,
  ProjectileState,
  Team,
  TowerState,
  TowerTypeId,
} from '@td/shared';
import { validatePlacement } from '@td/sim';
import type { GameSession } from '../api.js';
import { LocalGameBridge, findLane } from '../bridge/game-bridge.js';
import {
  footprintContains,
  footprintTopLeftForCursor,
  gridToScreen,
  isoRadiusPx,
  laneScreenBounds,
  rectDiamond,
  screenToGrid,
} from '../iso.js';
import {
  hpColor,
  indexById,
  interpolatePos,
  isTypingTarget,
  mixColor,
  numbersEqual,
  rectsOverlap,
  viewToWorld,
} from '../render-math.js';
import type { Rect } from '../render-math.js';
import { getPixelRatio } from '../display.js';
import { groundKindAt } from '../ground.js';
import type { GroundKind } from '../ground.js';
import {
  CameraController,
  MAX_ZOOM,
  MouseButton,
} from './camera-controller.js';
import type { WorldBounds } from './camera-controller.js';
import {
  CREEP_COLOR,
  PARTICLE_SIZE,
  applySpriteRef,
  creepSkin,
  ensureProjectileTexture,
  ensureTextures,
  ensureTowerTexture,
  groundFlashRef,
  groundRef,
  particleRef,
} from './textures.js';
import type { CreepSkin, SpriteRef } from './textures.js';
import { installArt, queueArt } from './art-loader.js';
import { DEFAULT_ASSETS_BASE_URL } from '../visuals/atlas.js';
import {
  CREEP_BODY_Y,
  CREEP_HP_BAR_Y,
  CREEP_SHADOW_Y,
  FLAT_SCALE_Y,
  advanceWalk,
  createWalkState,
  creepExtents,
  groundAngle,
} from '../visuals/creep-motion.js';
import type { CreepExtents, WalkState } from '../visuals/creep-motion.js';
import { modelIdOf } from '../visuals/model-registry.js';
import { resolveProjectile } from '../visuals/projectile-registry.js';
import type { ProjectileDescriptor } from '../visuals/projectile-registry.js';
import {
  BOLT_FADE_MS,
  DueQueue,
  GHOST_POSITION_MS,
  MAX_PENDING_CHAIN_HITS,
  chainHopMs,
  hopArrival,
  orderChainVictims,
} from '../visuals/pierce-chain.js';
import type { ChainVictim } from '../visuals/pierce-chain.js';

export const GAME_SCENE_KEY = 'td-game';

export interface GameSceneData {
  readonly session: GameSession;
  readonly bridge: LocalGameBridge;
  /** Base URL of the art atlas and manifest (default `/assets/`). */
  readonly assetsBaseUrl?: string;
}

// Depth layers. Entities use the screen y of their anchor (a few hundred px at most) as depth.
const DEPTH_GROUND = -1_000_000;
const DEPTH_GROUND_OVERLAY = -900_000;
const DEPTH_DEBUG = -800_000;
const DEPTH_FX = 1_000_000;

/** Height (px) at which projectiles fly above their ground position. */
const PROJECTILE_HEIGHT = 10;
/** Alpha of creeps hidden behind a tower. */
const OCCLUDED_ALPHA = 0.6;
/** Beyond this backlog (e.g. hidden tab) buffered events are dropped instead of animated. */
const MAX_PENDING_EVENTS = 500;
const HP_BAR_WIDTH = 14;
/** Extra world space kept above the map for tower bodies when fitting the camera. */
const FIT_TOP_MARGIN = 48;

/** Steady multiply tint of slowed creeps. */
const SLOW_TINT = 0x9fd8ff;
/** Fill flash colours: hit (white) and slow applied (blue). */
const HIT_FLASH = 0xffffff;
const SLOW_FLASH = 0x6fb8ff;
/** Secondary (pierce/burst splash) damage numbers are smaller and dimmer. */
const SECONDARY_TEXT_SCALE = 0.75;
const SECONDARY_TEXT_ALPHA = 0.7;
const BURST_RING_COLOR = 0xffd27a;
/** Pierce chain: arc height of a hop, trail cadence/fade, lightning jitter, victim spark. */
const CHAIN_ARC_PX = 6;
const CHAIN_TRAIL_INTERVAL_MS = 25;
const CHAIN_TRAIL_FADE_MS = 140;
const BOLT_SEGMENTS = 5;
const BOLT_JITTER_PX = 3;
const SPARK_MS = 120;
/** Streak chains: fade of the line, number of particles shed per hop and their drift. */
const STREAK_FADE_MS = 120;
const STREAK_PARTICLES = 4;
const STREAK_DRIFT_PX = 7;
/** Ripple chains: ring radius/duration and the faint line between victims. */
const RIPPLE_RADIUS_CELLS = 0.6;
const RIPPLE_MS = 300;
const GHOST_LINE_ALPHA = 0.35;
/** Victim impact ring (dust): radius and duration. */
const IMPACT_RING_RADIUS_CELLS = 0.45;
const IMPACT_RING_MS = 260;
/** Trails: spiral copies spin by this much while fading; puffs are larger and slower. */
const SPIRAL_TRAIL_TURN = Math.PI;
const PUFF_TRAIL_MS = 320;
/** Hops start and end at the creep body, slightly above the ground. */
const CHAIN_BODY_OFFSET = 6;

/** Safety cap of the burst projectile bookkeeping (entries normally live a few ticks). */
const MAX_TRACKED_BURSTS = 256;

const GHOST_OK = 0x22c55e;
const GHOST_BAD = 0xef4444;
const SELECTION_COLOR = 0xfacc15;

const DAMAGE_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  fontStyle: 'bold',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 3,
};
const FLOW_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '7px',
  color: '#e5e7eb',
};

/**
 * Text is rasterized at device pixel ratio x the maximum user zoom, so world-space labels stay sharp
 * up to MAX_ZOOM on HiDPI screens.
 */
export function textResolution(scene: Phaser.Scene): number {
  return getPixelRatio(scene) * MAX_ZOOM;
}

const EMPTY: readonly never[] = [];

interface TowerView {
  readonly sprite: Phaser.GameObjects.Image;
  type: TowerTypeId;
  level: number;
  /** Model key currently displayed (re-baked/re-textured when the level changes). */
  modelId: string;
  team: Team;
  /** Display scale of the current sprite (the fire squash is relative to it). */
  scale: number;
  depth: number;
  /** Screen bounds of the sprite, for hit testing and occlusion. */
  readonly bounds: Rect;
  seen: number;
}

interface CreepView {
  readonly container: Phaser.GameObjects.Container;
  /** Rotated in the ground plane (walk cycles) inside a container squashed like the ground. */
  readonly body: Phaser.GameObjects.Image;
  readonly skin: CreepSkin;
  /** Odometer driving the walk cycle. */
  readonly walk: WalkState;
  walkFrame: number;
  /** Ground-plane rotation currently applied to the body. */
  angle: number;
  /** Screen extents relative to the ground position (occlusion). */
  readonly extents: CreepExtents;
  readonly hpFill: Phaser.GameObjects.Rectangle;
  hpRatio: number;
  /** Scene time at which the current fill flash ends (0 = no flash). */
  flashUntil: number;
  /** Tint currently applied to the body. */
  tint: 'none' | 'slow' | 'flash';
  slowed: boolean;
  /** Last known `distanceToExit` (orders pierce chains). */
  distance: number;
  depth: number;
  readonly rect: Rect;
  seen: number;
}

/** Last rendered position of a destroyed creep view, kept briefly for pierce chains. */
interface GhostPos {
  x: number;
  y: number;
  distance: number;
  until: number;
}

/** Pierce hits of one projectile gathered while processing a tick's events. */
interface ChainBuild {
  targetId: EntityId | null;
  readonly victims: ChainVictim[];
}

/** A pierce back-travel animation in progress: hop k goes from ids[k - 1] to ids[k]. */
interface ChainAnim {
  desc: ProjectileDescriptor;
  ref: SpriteRef;
  readonly ids: EntityId[];
  start: number;
  hopMs: number;
  /** Hop currently drawn (0 = none yet). */
  hop: number;
  sprite: Phaser.GameObjects.Image | null;
  /** Streak chains: the line of the current hop (redrawn each frame while it stretches). */
  line: Phaser.GameObjects.Graphics | null;
  lastTrail: number;
}

/** Secondary damage number released when its hop arrives. */
interface PendingHit {
  creepId: EntityId;
  damage: number;
  /** Visual of the chain that carries this hit (arrival effects), or null for a plain hit. */
  desc: ProjectileDescriptor | null;
}

interface ProjectileView {
  readonly image: Phaser.GameObjects.Image;
  visual: string;
  /** Elongated visuals are rotated along their flight direction. */
  rotates: boolean;
  /** Spin in rad/s (takes precedence over `rotates`). */
  spin: number;
  seen: number;
}

/**
 * Renders the lane of the local player: ground, towers, creeps, projectiles, build ghost, selection
 * and event effects. Reads the session state every frame (interpolated with `session.alpha()`), and
 * sends commands through the bridge.
 */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private bridge!: LocalGameBridge;
  private playerId: PlayerId = 0;
  private assetsBaseUrl = DEFAULT_ASSETS_BASE_URL;
  /** Particle sprite and the scale that displays it PARTICLE_SIZE px wide. */
  private particle!: SpriteRef;
  private particleScale = 1;
  private readonly creepSkins = new Map<string, CreepSkin>();

  private readonly towers = new Map<EntityId, TowerView>();
  private readonly creeps = new Map<EntityId, CreepView>();
  private readonly projectiles = new Map<EntityId, ProjectileView>();
  private readonly prevCreeps = new Map<EntityId, CreepState>();
  private readonly prevProjectiles = new Map<EntityId, ProjectileState>();
  private frame = 0;

  private pendingEvents: GameEvent[] = [];
  private readonly unsubscribers: (() => void)[] = [];
  private cameraController: CameraController | null = null;
  private cleanedUp = false;

  private groundBuilt = false;
  private mapBounds: WorldBounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  private exitFlash: Phaser.GameObjects.Image | null = null;

  private ghost!: Phaser.GameObjects.Graphics;
  private ghostRange!: Phaser.GameObjects.Graphics;
  private ghostType: TowerTypeId | null = null;
  private ghostX = 0;
  private ghostY = 0;
  private ghostState: GameState | null = null;

  private selection!: Phaser.GameObjects.Graphics;
  private selectionRange!: Phaser.GameObjects.Graphics;
  private selectionKey = -1;
  private highlighted: Phaser.GameObjects.Image | null = null;

  private flowVisible = false;
  private flowGraphics: Phaser.GameObjects.Graphics | null = null;
  private flowTexts: Phaser.GameObjects.Text[] = [];
  private flowDist: readonly number[] | null = null;
  private flowNext: readonly number[] | null = null;

  private readonly damageTextPool: Phaser.GameObjects.Text[] = [];
  private readonly ringPool: Phaser.GameObjects.Graphics[] = [];
  /** Burst projectiles in flight: projectile id -> source tower id (for the impact ring radius). */
  private readonly burstSources = new Map<EntityId, EntityId>();

  // Pierce back-travel (all pooled).
  /** Pierce projectiles in flight: projectile id -> visual key, until their hits are processed. */
  private readonly pierceVisuals = new Map<EntityId, string>();
  private readonly chainBuilds = new Map<EntityId, ChainBuild>();
  private readonly chainBuildPool: ChainBuild[] = [];
  private readonly victimPool: ChainVictim[] = [];
  private readonly chains: ChainAnim[] = [];
  private readonly chainPool: ChainAnim[] = [];
  private readonly pendingHits = new DueQueue<PendingHit>();
  private readonly pendingHitPool: PendingHit[] = [];
  private readonly ghosts = new Map<EntityId, GhostPos>();
  private readonly ghostPool: GhostPos[] = [];
  private readonly hopSpritePool: Phaser.GameObjects.Image[] = [];
  private readonly trailPool: Phaser.GameObjects.Image[] = [];
  /** Graphics for lightning, streaks and ghost lines. */
  private readonly linePool: Phaser.GameObjects.Graphics[] = [];
  /** Small particle images (sparks, leaves, puffs). */
  private readonly sparkPool: Phaser.GameObjects.Image[] = [];
  private readonly boltJitter = new Float64Array(BOLT_SEGMENTS + 1);
  /** Scene time of the current frame (for pooled callbacks). */
  private nowMs = 0;
  private readonly distanceOf = (creepId: EntityId): number | undefined =>
    this.creeps.get(creepId)?.distance ?? this.ghosts.get(creepId)?.distance;
  private readonly releaseHit = (hit: PendingHit): void => {
    this.showSecondaryHit(hit.creepId, hit.damage, hit.desc);
    this.pendingHitPool.push(hit);
  };
  private readonly discardHit = (hit: PendingHit): void => {
    this.pendingHitPool.push(hit);
  };

  private pointerX = 0;
  private pointerY = 0;
  private pointerInside = false;

  // Scratch objects reused every frame.
  private readonly tmpGrid = { x: 0, y: 0 };
  private readonly tmpScreen = { x: 0, y: 0 };
  private readonly tmpWorld = { x: 0, y: 0 };
  private readonly tmpPrev = { x: 0, y: 0 };
  private readonly tmpFrom = { x: 0, y: 0 };
  private readonly tmpTo = { x: 0, y: 0 };
  private readonly tmpDir = { x: 0, y: 0 };

  constructor() {
    super({ key: GAME_SCENE_KEY });
  }

  init(data: GameSceneData): void {
    this.session = data.session;
    this.bridge = data.bridge;
    this.playerId = data.session.playerId;
    this.assetsBaseUrl = data.assetsBaseUrl ?? DEFAULT_ASSETS_BASE_URL;
    this.cleanedUp = false;
  }

  /** Loads the art atlas (a missing atlas only means procedural placeholders). */
  preload(): void {
    queueArt(this, this.assetsBaseUrl, { manifest: false });
  }

  create(): void {
    installArt(this);
    ensureTextures(this);
    this.particle = particleRef(this);
    this.particleScale =
      (this.particle.displayScale * PARTICLE_SIZE) / this.particle.width;

    // The footprint ghost is drawn above everything so it stays readable over existing towers.
    this.ghost = this.add
      .graphics()
      .setDepth(DEPTH_FX - 10)
      .setVisible(false);
    this.ghostRange = this.add
      .graphics()
      .setDepth(DEPTH_GROUND_OVERLAY + 1)
      .setScale(1, 0.5)
      .setVisible(false);
    this.selection = this.add
      .graphics()
      .setDepth(DEPTH_GROUND_OVERLAY + 2)
      .setVisible(false);
    this.selectionRange = this.add
      .graphics()
      .setDepth(DEPTH_GROUND_OVERLAY + 1)
      .setScale(1, 0.5)
      .setVisible(false);

    this.cameraController = new CameraController(this, {
      canPanWithLeft: (pointer) =>
        this.bridge.getBuildMode() === null &&
        this.towerAtPointer(pointer) === null,
      onClick: (pointer, button) => this.handleClick(pointer, button),
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ESC', this.onEscape, this);
    keyboard?.on('keydown-F', this.onToggleFlowField, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.unsubscribers.push(
      this.bridge.onEvents((events) => {
        for (const e of events) this.pendingEvents.push(e);
      }),
    );

    const lane = findLane(this.session.getState(), this.playerId);
    if (lane) this.buildGround(lane);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  override update(time: number): void {
    this.syncCameraSize();
    const state = this.session.getState();
    const lane = findLane(state, this.playerId);
    if (!lane) return;
    if (!this.groundBuilt) this.buildGround(lane);
    const prevLane = findLane(this.session.getPreviousState(), this.playerId);
    const alpha = this.session.alpha();
    this.frame++;

    // Effects first: views of entities removed this tick still exist at their last rendered position.
    this.processEvents(time);
    this.syncTowers(state, lane);
    this.syncCreeps(lane, prevLane, alpha, time);
    this.advanceChains(time);
    this.syncProjectiles(lane, prevLane, alpha);
    this.applyOcclusion();
    this.updateGhost(state);
    this.updateSelection(lane);
    this.updateFlowField(lane);
  }

  // ---- Ground & camera --------------------------------------------------------------------------

  private buildGround(lane: LaneState): void {
    this.groundBuilt = true;
    const refs = new Map<GroundKind, SpriteRef>();
    for (let y = 0; y < lane.height; y++) {
      for (let x = 0; x < lane.width; x++) {
        const kind = groundKindAt(lane, x, y);
        let ref = refs.get(kind);
        if (!ref) {
          ref = groundRef(this, kind);
          refs.set(kind, ref);
        }
        const p = gridToScreen(x + 0.5, y + 0.5, this.tmpScreen);
        // Back to front, so tile overhangs overlap correctly.
        applySpriteRef(
          this.add.image(p.x, p.y, ref.key, ref.frame),
          ref,
        ).setDepth(DEPTH_GROUND + p.y);
      }
    }
    const exit = gridToScreen(
      lane.exit.x + 0.5,
      lane.exit.y + 0.5,
      this.tmpScreen,
    );
    const flash = groundFlashRef(this);
    this.exitFlash = applySpriteRef(
      this.add.image(exit.x, exit.y, flash.key, flash.frame),
      flash,
    )
      .setTint(0xff2a2a)
      .setAlpha(0)
      .setDepth(DEPTH_GROUND_OVERLAY);

    const b = laneScreenBounds(lane.width, lane.height);
    this.mapBounds = {
      minX: b.minX,
      maxX: b.maxX,
      minY: b.minY - FIT_TOP_MARGIN,
      maxY: b.maxY,
    };
    this.cameraController?.fit(this.mapBounds);
  }

  private onResize(): void {
    this.syncCameraSize(true);
  }

  /**
   * Keeps the main camera the size of the canvas and refits it until the user takes control.
   * Phaser only auto-resizes cameras that still match the previous game size, so a canvas that was
   * created while its parent had no layout yet (hidden tab, pane being resized) would otherwise keep
   * a stale camera: wrong fit and wrong pointer-to-world mapping.
   */
  private syncCameraSize(refit = false): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    const changed = cam.width !== width || cam.height !== height;
    if (changed) cam.setSize(width, height);
    if (
      (changed || refit) &&
      this.groundBuilt &&
      this.cameraController &&
      !this.cameraController.userMoved
    )
      this.cameraController.fit(this.mapBounds);
  }

  // ---- Entities ---------------------------------------------------------------------------------

  private teamOf(state: GameState, playerId: PlayerId): Team {
    for (const p of state.players) if (p.id === playerId) return p.team;
    return 'blue';
  }

  private syncTowers(state: GameState, lane: LaneState): void {
    const frame = this.frame;
    for (const tower of lane.towers) {
      const team = this.teamOf(state, tower.playerId);
      let view = this.towers.get(tower.id);
      if (!view) {
        const anchor = gridToScreen(
          tower.pos.x + TOWER_FOOTPRINT / 2,
          tower.pos.y + TOWER_FOOTPRINT / 2,
          this.tmpScreen,
        );
        const sprite = this.add.image(anchor.x, anchor.y, '__DEFAULT');
        view = {
          sprite,
          type: tower.type,
          level: 0,
          modelId: '',
          team,
          scale: 1,
          depth: anchor.y,
          bounds: { left: 0, top: 0, right: 0, bottom: 0 },
          seen: 0,
        };
        sprite.setDepth(anchor.y);
        this.towers.set(tower.id, view);
      }
      view.type = tower.type;
      view.level = tower.level;
      const modelId = modelIdOf(tower.type, tower.level);
      if (view.modelId !== modelId || view.team !== team) {
        view.modelId = modelId;
        view.team = team;
        const info = ensureTowerTexture(this, modelId, team);
        this.tweens.killTweensOf(view.sprite);
        applySpriteRef(view.sprite, info);
        view.scale = info.displayScale;
        const { x, y } = view.sprite;
        view.bounds.left = x - info.width * info.originX;
        view.bounds.right = view.bounds.left + info.width;
        view.bounds.top = y - info.height * info.originY;
        view.bounds.bottom = view.bounds.top + info.height;
      }
      view.seen = frame;
    }
    for (const [id, view] of this.towers) {
      if (view.seen === frame) continue;
      if (this.highlighted === view.sprite) this.highlighted = null;
      this.tweens.killTweensOf(view.sprite);
      view.sprite.destroy();
      this.towers.delete(id);
    }
  }

  private skinOf(type: string): CreepSkin {
    let skin = this.creepSkins.get(type);
    if (!skin) {
      skin = creepSkin(this, type);
      this.creepSkins.set(type, skin);
    }
    return skin;
  }

  private createCreepView(type: string): CreepView {
    const skin = this.skinOf(type);
    const shadow = applySpriteRef(
      this.add.image(0, CREEP_SHADOW_Y, skin.shadow.key, skin.shadow.frame),
      skin.shadow,
    ).setAlpha(skin.shadowAlpha);
    const body = applySpriteRef(
      this.add.image(0, 0, skin.body.key, skin.body.frame),
      skin.body,
    );
    // Walk cycles are seen from above: the body turns in the ground plane, then the whole is
    // squashed like the ground (flat-object rule). The procedural blob is already drawn in iso.
    const flat = this.add
      .container(0, CREEP_BODY_Y, [body])
      .setScale(1, skin.walk ? FLAT_SCALE_Y : 1);
    const hpBg = this.add
      .rectangle(-HP_BAR_WIDTH / 2, CREEP_HP_BAR_Y, HP_BAR_WIDTH, 2, 0x111111)
      .setOrigin(0, 0.5);
    const hpFill = this.add
      .rectangle(-HP_BAR_WIDTH / 2, CREEP_HP_BAR_Y, HP_BAR_WIDTH, 2, hpColor(1))
      .setOrigin(0, 0.5);
    const container = this.add.container(0, 0, [shadow, flat, hpBg, hpFill]);
    return {
      container,
      body,
      skin,
      walk: createWalkState(),
      walkFrame: 0,
      angle: 0,
      extents: creepExtents(skin.body, skin.shadow, skin.walk !== null),
      hpFill,
      hpRatio: 1,
      flashUntil: 0,
      tint: 'none',
      slowed: false,
      distance: 0,
      depth: 0,
      rect: { left: 0, top: 0, right: 0, bottom: 0 },
      seen: 0,
    };
  }

  private syncCreeps(
    lane: LaneState,
    prevLane: LaneState | undefined,
    alpha: number,
    time: number,
  ): void {
    const frame = this.frame;
    indexById(prevLane?.creeps ?? EMPTY, this.prevCreeps);
    for (const creep of lane.creeps) {
      let view = this.creeps.get(creep.id);
      if (!view) {
        view = this.createCreepView(creep.type);
        this.creeps.set(creep.id, view);
      }
      const prev = this.prevCreeps.get(creep.id);
      const g = interpolatePos(prev?.pos, creep.pos, alpha, this.tmpGrid);
      this.animateCreep(view, g.x, g.y, prev, creep, alpha);
      const p = gridToScreen(g.x, g.y, this.tmpScreen);
      view.container.setPosition(p.x, p.y);
      if (view.depth !== p.y) {
        view.depth = p.y;
        view.container.setDepth(p.y);
      }
      const ratio = creep.maxHp > 0 ? Math.max(0, creep.hp / creep.maxHp) : 0;
      if (ratio !== view.hpRatio) {
        view.hpRatio = ratio;
        view.hpFill.setScale(ratio, 1);
        view.hpFill.setFillStyle(hpColor(ratio));
      }
      view.slowed = creep.slowFactor < 1;
      view.distance = creep.distanceToExit;
      this.refreshCreepTint(view, time);
      view.seen = frame;
    }
    for (const [id, view] of this.creeps) {
      if (view.seen === frame) continue;
      this.rememberGhost(id, view, time);
      this.tweens.killTweensOf(view.body);
      view.container.destroy();
      this.creeps.delete(id);
    }
  }

  /**
   * Walk cycle and facing of a creep with an atlas walk cycle: one frame per WALK_CELLS_PER_FRAME of
   * distance travelled (interpolated positions, never time), body turned in the ground plane along
   * the interpolated movement direction (smooth turns at corners; kept when the direction is zero).
   */
  private animateCreep(
    view: CreepView,
    gx: number,
    gy: number,
    prev: CreepState | undefined,
    creep: CreepState,
    alpha: number,
  ): void {
    const walk = view.skin.walk;
    if (!walk) return;
    const n = advanceWalk(view.walk, gx, gy, walk.length);
    const ref = walk[n];
    if (n !== view.walkFrame && ref) {
      view.walkFrame = n;
      view.body.setTexture(ref.key, ref.frame);
    }
    const d = interpolatePos(prev?.dir, creep.dir, alpha, this.tmpDir);
    const angle = groundAngle(d.x, d.y);
    if (angle !== null && angle !== view.angle) {
      view.angle = angle;
      view.body.setRotation(angle);
    }
  }

  /** Applies the steady tint (slowed or none) once a flash is over or when the slow state changes. */
  private refreshCreepTint(view: CreepView, time: number): void {
    if (view.tint === 'flash') {
      if (time < view.flashUntil) return;
      view.flashUntil = 0;
    } else if (view.tint === (view.slowed ? 'slow' : 'none')) {
      return;
    }
    if (view.slowed) {
      view.body.setTint(SLOW_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
      view.tint = 'slow';
    } else {
      view.body.clearTint(); // also resets the tint mode to MULTIPLY
      view.tint = 'none';
    }
  }

  /** Fill flash of `color` on a creep body for two ticks. */
  private flashCreep(view: CreepView, color: number, time: number): void {
    view.body.setTint(color).setTintMode(Phaser.TintModes.FILL);
    view.tint = 'flash';
    view.flashUntil = time + 2 * TICK_MS;
  }

  private syncProjectiles(
    lane: LaneState,
    prevLane: LaneState | undefined,
    alpha: number,
  ): void {
    const frame = this.frame;
    indexById(prevLane?.projectiles ?? EMPTY, this.prevProjectiles);
    for (const projectile of lane.projectiles) {
      let view = this.projectiles.get(projectile.id);
      if (!view) {
        view = {
          image: this.add.image(0, 0, '__DEFAULT'),
          visual: '',
          rotates: false,
          spin: 0,
          seen: 0,
        };
        this.projectiles.set(projectile.id, view);
      }
      if (view.visual !== projectile.visual) {
        view.visual = projectile.visual;
        const desc = resolveProjectile(projectile.visual);
        view.rotates = desc.orient;
        view.spin = desc.spin;
        applySpriteRef(
          view.image,
          ensureProjectileTexture(this, projectile.visual),
        );
      }
      const prevPos = this.prevProjectiles.get(projectile.id)?.pos;
      const g = interpolatePos(prevPos, projectile.pos, alpha, this.tmpGrid);
      const p = gridToScreen(g.x, g.y, this.tmpScreen);
      view.image.setPosition(p.x, p.y - PROJECTILE_HEIGHT).setDepth(p.y + 1);
      if (view.spin !== 0) {
        view.image.setRotation((this.nowMs / 1000) * view.spin);
      } else if (view.rotates && prevPos) {
        const from = gridToScreen(prevPos.x, prevPos.y, this.tmpPrev);
        const to = gridToScreen(
          projectile.pos.x,
          projectile.pos.y,
          this.tmpWorld,
        );
        if (from.x !== to.x || from.y !== to.y) {
          view.image.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
        }
      }
      view.seen = frame;
    }
    for (const [id, view] of this.projectiles) {
      if (view.seen === frame) continue;
      view.image.destroy();
      this.projectiles.delete(id);
      this.burstSources.delete(id);
      this.pierceVisuals.delete(id);
    }
  }

  /** Creeps behind a tower (lower depth, overlapping its screen bounds) are drawn translucent. */
  private applyOcclusion(): void {
    for (const view of this.creeps.values()) {
      const { x, y } = view.container;
      const r = view.rect;
      const e = view.extents;
      r.left = x + e.left;
      r.right = x + e.right;
      r.top = y + e.top;
      r.bottom = y + e.bottom;
      let occluded = false;
      for (const tower of this.towers.values()) {
        if (view.depth < tower.depth && rectsOverlap(r, tower.bounds)) {
          occluded = true;
          break;
        }
      }
      const a = occluded ? OCCLUDED_ALPHA : 1;
      if (view.container.alpha !== a) view.container.setAlpha(a);
    }
  }

  // ---- Events & effects -------------------------------------------------------------------------

  private processEvents(time: number): void {
    if (this.pendingEvents.length === 0) return;
    const events = this.pendingEvents;
    this.pendingEvents = [];
    if (events.length > MAX_PENDING_EVENTS) return; // stale backlog: state sync is enough
    for (const event of events) {
      switch (event.type) {
        case 'CreepHit':
          if (this.pierceVisuals.has(event.projectileId)) {
            // Pierce: the primary hit is immediate, secondaries wait for the back-travel hops.
            const build = this.chainBuildFor(event.projectileId);
            if (event.primary) {
              build.targetId = event.creepId;
              const visual = this.pierceVisuals.get(event.projectileId);
              this.onCreepHit(
                event.creepId,
                event.projectileId,
                event.damage,
                true,
                time,
                visual === undefined
                  ? HIT_FLASH
                  : resolveProjectile(visual).hitFlash,
              );
            } else {
              const victim = this.victimPool.pop() ?? { creepId: 0, damage: 0 };
              victim.creepId = event.creepId;
              victim.damage = event.damage;
              build.victims.push(victim);
            }
          } else {
            this.onCreepHit(
              event.creepId,
              event.projectileId,
              event.damage,
              event.primary,
              time,
            );
          }
          break;
        case 'CreepSlowed': {
          const view = this.creeps.get(event.creepId);
          if (view) this.flashCreep(view, SLOW_FLASH, time);
          break;
        }
        case 'CreepKilled':
          this.onCreepKilled(event.creepId);
          break;
        case 'ProjectileFired':
          this.onProjectileFired(event.projectile.sourceTowerId);
          if (event.projectile.kind === 'pierce') {
            if (this.pierceVisuals.size >= MAX_TRACKED_BURSTS)
              this.pierceVisuals.clear();
            this.pierceVisuals.set(
              event.projectile.id,
              event.projectile.visual,
            );
          }
          if (event.projectile.kind === 'burst') {
            if (this.burstSources.size >= MAX_TRACKED_BURSTS)
              this.burstSources.clear();
            this.burstSources.set(
              event.projectile.id,
              event.projectile.sourceTowerId,
            );
          }
          break;
        case 'LifeLost':
          if (event.playerId === this.playerId) this.flashExit();
          break;
        default:
          break;
      }
    }
    if (this.chainBuilds.size > 0) this.startChains(time);
  }

  // ---- Pierce back-travel -----------------------------------------------------------------------

  private chainBuildFor(projectileId: EntityId): ChainBuild {
    let build = this.chainBuilds.get(projectileId);
    if (!build) {
      build = this.chainBuildPool.pop() ?? { targetId: null, victims: [] };
      build.targetId = null;
      this.chainBuilds.set(projectileId, build);
    }
    return build;
  }

  /** Turns the pierce hits gathered this frame into chains (or immediate numbers under backlog). */
  private startChains(time: number): void {
    for (const [projectileId, build] of this.chainBuilds) {
      const visual = this.pierceVisuals.get(projectileId);
      this.pierceVisuals.delete(projectileId);
      const victims = build.victims;
      if (victims.length > 0) {
        orderChainVictims(victims, this.distanceOf);
        const desc = visual === undefined ? null : resolveProjectile(visual);
        const animate =
          this.pendingHits.size + victims.length <= MAX_PENDING_CHAIN_HITS;
        if (animate && build.targetId !== null && visual !== undefined) {
          this.startChain(time, build.targetId, victims, visual);
        } else {
          for (const v of victims)
            this.showSecondaryHit(v.creepId, v.damage, desc);
        }
      }
      for (const v of victims) this.victimPool.push(v);
      victims.length = 0;
      this.chainBuildPool.push(build);
    }
    this.chainBuilds.clear();
  }

  private startChain(
    time: number,
    targetId: EntityId,
    victims: readonly ChainVictim[],
    visual: string,
  ): void {
    const desc = resolveProjectile(visual);
    const ref = ensureProjectileTexture(this, visual);
    const chain: ChainAnim = this.chainPool.pop() ?? {
      desc,
      ref,
      ids: [],
      start: 0,
      hopMs: 0,
      hop: 0,
      sprite: null,
      line: null,
      lastTrail: 0,
    };
    chain.desc = desc;
    chain.ref = ref;
    chain.start = time;
    chain.hopMs = chainHopMs(victims.length);
    chain.hop = 0;
    chain.lastTrail = -Infinity;
    chain.ids.length = 0;
    chain.ids.push(targetId);
    for (let k = 0; k < victims.length; k++) {
      const v = victims[k];
      if (!v) continue;
      chain.ids.push(v.creepId);
      const hit = this.pendingHitPool.pop() ?? {
        creepId: 0,
        damage: 0,
        desc: null,
      };
      hit.creepId = v.creepId;
      hit.damage = v.damage;
      hit.desc = desc;
      this.pendingHits.push(hopArrival(time, k + 1, chain.hopMs), hit);
    }
    if (desc.chain === 'arc') {
      chain.sprite =
        this.hopSpritePool.pop()?.setActive(true) ??
        this.add.image(0, 0, ref.key, ref.frame);
      applySpriteRef(chain.sprite, ref)
        .setVisible(false)
        .setDepth(DEPTH_FX - 4)
        .setRotation(0);
    } else {
      chain.sprite = null;
    }
    this.chains.push(chain);
  }

  /** Per frame: expire ghosts, release due secondary hits, animate chains. */
  private advanceChains(time: number): void {
    this.nowMs = time;
    if (this.ghosts.size > 0) {
      for (const [id, ghost] of this.ghosts) {
        if (ghost.until > time) continue;
        this.ghosts.delete(id);
        this.ghostPool.push(ghost);
      }
    }
    if (this.pendingHits.size > 0)
      this.pendingHits.popDue(time, this.releaseHit);
    for (let i = this.chains.length - 1; i >= 0; i--) {
      const chain = this.chains[i];
      if (!chain || this.stepChain(chain, time)) continue;
      this.releaseChain(chain);
      const last = this.chains.pop();
      if (last && last !== chain) this.chains[i] = last;
    }
  }

  /** Draws the current hop of `chain` with the renderer of its style; false once the chain is over. */
  private stepChain(chain: ChainAnim, time: number): boolean {
    const hops = chain.ids.length - 1;
    const elapsed = time - chain.start;
    if (hops <= 0 || elapsed >= hops * chain.hopMs) return false;
    const k = Math.min(hops, Math.floor(elapsed / chain.hopMs) + 1);
    const from = this.creepPoint(chain.ids[k - 1], this.tmpFrom);
    const to = this.creepPoint(chain.ids[k], this.tmpTo);
    if (k !== chain.hop) {
      const first = chain.hop === 0;
      this.endHop(chain);
      chain.hop = k;
      if (from && to) this.startHop(chain, from, to, first);
    }
    const t = (elapsed - (k - 1) * chain.hopMs) / chain.hopMs;
    switch (chain.desc.chain) {
      case 'arc':
        this.drawArcHop(chain, from, to, t, time);
        break;
      case 'streak':
        this.drawStreakHop(chain, from, to, t);
        break;
      default:
        // bolt and ripple are drawn once, when the hop starts.
        break;
    }
    return true;
  }

  /** One-shot effects of a new hop. */
  private startHop(
    chain: ChainAnim,
    from: { x: number; y: number },
    to: { x: number; y: number },
    first: boolean,
  ): void {
    const { desc } = chain;
    switch (desc.chain) {
      case 'bolt':
        this.spawnBolt(from, to, desc.color);
        break;
      case 'streak': {
        chain.line =
          this.linePool.pop()?.setActive(true).setVisible(true) ??
          this.add.graphics();
        chain.line
          .clear()
          .setAlpha(1)
          .setDepth(DEPTH_FX - 3);
        const leaf = mixColor(desc.color, 0x2f8f3a, 0.55);
        for (let i = 0; i < STREAK_PARTICLES; i++) {
          const t = (i + 0.5) / STREAK_PARTICLES;
          this.spawnParticle(
            from.x + (to.x - from.x) * t,
            from.y + (to.y - from.y) * t,
            leaf,
            0.9,
            0.4,
            300,
            (Math.random() * 2 - 1) * STREAK_DRIFT_PX,
            -Math.random() * STREAK_DRIFT_PX,
          );
        }
        break;
      }
      case 'ripple':
        if (first)
          this.spawnRing(
            from.x,
            from.y + CHAIN_BODY_OFFSET,
            isoRadiusPx(RIPPLE_RADIUS_CELLS),
            desc.color,
            0.12,
            0.6,
            RIPPLE_MS,
          );
        this.spawnLine(
          from,
          to,
          desc.color,
          GHOST_LINE_ALPHA,
          1.5,
          chain.hopMs * 2,
        );
        break;
      default:
        break;
    }
  }

  /** Streak chains: the finished hop's line fades out. */
  private endHop(chain: ChainAnim): void {
    const line = chain.line;
    if (!line) return;
    chain.line = null;
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: STREAK_FADE_MS,
      onComplete: () => {
        line.setActive(false).setVisible(false);
        this.linePool.push(line);
      },
    });
  }

  /** Arc chains: the projectile sprite flies along a slight arc and leaves its trail. */
  private drawArcHop(
    chain: ChainAnim,
    from: { x: number; y: number } | null,
    to: { x: number; y: number } | null,
    t: number,
    time: number,
  ): void {
    const sprite = chain.sprite;
    if (!sprite) return;
    if (!from || !to) {
      sprite.setVisible(false);
      return;
    }
    const { desc } = chain;
    const x = from.x + (to.x - from.x) * t;
    const y =
      from.y + (to.y - from.y) * t - CHAIN_ARC_PX * Math.sin(Math.PI * t);
    sprite.setVisible(true).setPosition(x, y);
    if (desc.spin !== 0) sprite.setRotation((time / 1000) * desc.spin);
    else if (desc.orient)
      sprite.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    if (
      desc.trail !== 'none' &&
      time - chain.lastTrail >= CHAIN_TRAIL_INTERVAL_MS
    ) {
      chain.lastTrail = time;
      if (desc.trail === 'puff') {
        this.spawnParticle(x, y, desc.color, 2.5, 4, PUFF_TRAIL_MS, 0, -2);
      } else {
        this.spawnTrail(
          x,
          y,
          chain.ref,
          sprite.rotation,
          desc.trail === 'spiral',
        );
      }
    }
  }

  /** Streak chains: a bright line stretching from the previous victim toward the next one. */
  private drawStreakHop(
    chain: ChainAnim,
    from: { x: number; y: number } | null,
    to: { x: number; y: number } | null,
    t: number,
  ): void {
    const line = chain.line;
    if (!line || !from || !to) return;
    const x = from.x + (to.x - from.x) * Math.min(1, t * 1.6);
    const y = from.y + (to.y - from.y) * Math.min(1, t * 1.6);
    line.clear();
    line.lineStyle(4, chain.desc.color, 0.45);
    line.lineBetween(from.x, from.y, x, y);
    line.lineStyle(1.5, 0xffffff, 1);
    line.lineBetween(from.x, from.y, x, y);
  }

  private releaseChain(chain: ChainAnim): void {
    this.endHop(chain);
    if (chain.sprite) {
      chain.sprite.setVisible(false).setActive(false);
      this.hopSpritePool.push(chain.sprite);
      chain.sprite = null;
    }
    chain.ids.length = 0;
    this.chainPool.push(chain);
  }

  /** Body position of a creep (live view, else its recent ghost), or null. */
  private creepPoint(
    creepId: EntityId | undefined,
    out: { x: number; y: number },
  ): { x: number; y: number } | null {
    if (creepId === undefined) return null;
    const view = this.creeps.get(creepId);
    const source = view ? view.container : this.ghosts.get(creepId);
    if (!source) return null;
    out.x = source.x;
    out.y = source.y - CHAIN_BODY_OFFSET;
    return out;
  }

  private rememberGhost(id: EntityId, view: CreepView, time: number): void {
    const ghost = this.ghosts.get(id) ??
      this.ghostPool.pop() ?? { x: 0, y: 0, distance: 0, until: 0 };
    ghost.x = view.container.x;
    ghost.y = view.container.y;
    ghost.distance = view.distance;
    ghost.until = time + GHOST_POSITION_MS;
    this.ghosts.set(id, ghost);
  }

  /**
   * Delayed secondary hit (its hop arrived): dim damage number and flash at the victim, plus the
   * arrival effect of the chain visual (spark, ripple ring, dust ring).
   */
  private showSecondaryHit(
    creepId: EntityId,
    damage: number,
    desc: ProjectileDescriptor | null,
  ): void {
    const view = this.creeps.get(creepId);
    const source = view ? view.container : this.ghosts.get(creepId);
    if (!source) return;
    if (view) this.flashCreep(view, desc?.hitFlash ?? HIT_FLASH, this.nowMs);
    this.spawnDamageText(source.x, source.y - 14, damage, false);
    if (!desc) return;
    if (desc.chain === 'bolt')
      this.spawnParticle(
        source.x,
        source.y - CHAIN_BODY_OFFSET,
        desc.color,
        2.2,
        0.4,
        SPARK_MS,
        0,
        0,
      );
    if (desc.chain === 'ripple')
      this.spawnRing(
        source.x,
        source.y,
        isoRadiusPx(RIPPLE_RADIUS_CELLS),
        desc.color,
        0.12,
        0.6,
        RIPPLE_MS,
      );
    if (desc.impact === 'ring')
      this.spawnRing(
        source.x,
        source.y,
        isoRadiusPx(IMPACT_RING_RADIUS_CELLS),
        desc.color,
        0.25,
        0.75,
        IMPACT_RING_MS,
      );
  }

  /** Fading copy of a travelling sprite; `spiral` copies also spin while they fade. */
  private spawnTrail(
    x: number,
    y: number,
    ref: SpriteRef,
    rotation: number,
    spiral: boolean,
  ): void {
    const trail =
      this.trailPool.pop()?.setActive(true).setVisible(true) ??
      this.add.image(0, 0, ref.key, ref.frame);
    applySpriteRef(trail, ref, spiral ? 0.55 : 0.7)
      .setPosition(x, y)
      .setRotation(rotation)
      .setAlpha(0.5)
      .setDepth(DEPTH_FX - 5);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scale: (spiral ? 0.2 : 0.3) * ref.displayScale,
      rotation: rotation + (spiral ? SPIRAL_TRAIL_TURN : 0),
      duration: spiral ? 220 : CHAIN_TRAIL_FADE_MS,
      onComplete: () => {
        trail.setActive(false).setVisible(false);
        this.trailPool.push(trail);
      },
    });
  }

  /** Jagged lightning between two points: accent glow under a white core, fading out. */
  private spawnBolt(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
  ): void {
    const g =
      this.linePool.pop()?.setActive(true).setVisible(true) ??
      this.add.graphics();
    g.clear()
      .setAlpha(1)
      .setDepth(DEPTH_FX - 3);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const jitter = this.boltJitter;
    for (let i = 0; i <= BOLT_SEGMENTS; i++) {
      jitter[i] =
        i === 0 || i === BOLT_SEGMENTS
          ? 0
          : (Math.random() * 2 - 1) * BOLT_JITTER_PX;
    }
    const stroke = (width: number, colour: number, alpha: number): void => {
      g.lineStyle(width, colour, alpha);
      g.beginPath();
      for (let i = 0; i <= BOLT_SEGMENTS; i++) {
        const t = i / BOLT_SEGMENTS;
        const j = jitter[i] ?? 0;
        const px = from.x + dx * t + nx * j;
        const py = from.y + dy * t + ny * j;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    };
    stroke(4, color, 0.55);
    stroke(2, 0xffffff, 1);
    this.fadeLine(g, BOLT_FADE_MS);
  }

  /** Faint straight line between two points, fading out (ripple chains). */
  private spawnLine(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
    alpha: number,
    width: number,
    duration: number,
  ): void {
    const g =
      this.linePool.pop()?.setActive(true).setVisible(true) ??
      this.add.graphics();
    g.clear()
      .setAlpha(1)
      .setDepth(DEPTH_FX - 3);
    g.lineStyle(width * 2.5, color, alpha * 0.4);
    g.lineBetween(from.x, from.y, to.x, to.y);
    g.lineStyle(width, color, alpha);
    g.lineBetween(from.x, from.y, to.x, to.y);
    this.fadeLine(g, duration);
  }

  private fadeLine(g: Phaser.GameObjects.Graphics, duration: number): void {
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration,
      onComplete: () => {
        g.setActive(false).setVisible(false);
        this.linePool.push(g);
      },
    });
  }

  /** New particle image (origin and texture of the particle sprite). */
  private addParticle(x: number, y: number): Phaser.GameObjects.Image {
    const p = this.particle;
    return applySpriteRef(this.add.image(x, y, p.key, p.frame), p);
  }

  /**
   * Small tinted particle (spark, leaf, dust puff) scaling and drifting while it fades. Sizes are
   * multiples of PARTICLE_SIZE.
   */
  private spawnParticle(
    x: number,
    y: number,
    color: number,
    sizeFrom: number,
    sizeTo: number,
    duration: number,
    driftX: number,
    driftY: number,
  ): void {
    const particle =
      this.sparkPool.pop()?.setActive(true).setVisible(true) ??
      this.addParticle(0, 0);
    particle
      .setPosition(x, y)
      .setTint(color)
      .setScale(sizeFrom * this.particleScale)
      .setAlpha(0.85)
      .setDepth(DEPTH_FX - 2);
    this.tweens.add({
      targets: particle,
      x: x + driftX,
      y: y + driftY,
      scale: sizeTo * this.particleScale,
      alpha: 0,
      duration,
      onComplete: () => {
        particle.setActive(false).setVisible(false);
        this.sparkPool.push(particle);
      },
    });
  }

  private onCreepHit(
    creepId: EntityId,
    projectileId: EntityId,
    damage: number,
    primary: boolean,
    time: number,
    flash = HIT_FLASH,
  ): void {
    const view = this.creeps.get(creepId);
    if (primary) {
      const towerId = this.burstSources.get(projectileId);
      if (towerId !== undefined) {
        this.burstSources.delete(projectileId);
        if (view)
          this.spawnBurstRing(
            view.container.x,
            view.container.y,
            this.burstRadiusOf(towerId),
          );
      }
    }
    if (!view) return;
    this.flashCreep(view, flash, time);
    this.spawnDamageText(
      view.container.x,
      view.container.y - 14,
      damage,
      primary,
    );
  }

  /** Splash radius (cells) of the source tower's current level; 1 when unknown. */
  private burstRadiusOf(towerId: EntityId): number {
    const tower = this.towers.get(towerId);
    const attack = tower
      ? TOWERS[tower.type].levels[tower.level - 1]?.attack
      : undefined;
    return attack?.kind === 'burst' ? attack.splashRadius : 1;
  }

  /** Short expanding iso ring on the ground (pooled Graphics). */
  private spawnBurstRing(x: number, y: number, radiusCells: number): void {
    this.spawnRing(
      x,
      y,
      isoRadiusPx(radiusCells),
      BURST_RING_COLOR,
      0.15,
      0.9,
      320,
    );
  }

  /** Short expanding iso ring on the ground (pooled Graphics, scaleY 0.5). */
  private spawnRing(
    x: number,
    y: number,
    radiusPx: number,
    color: number,
    fillAlpha: number,
    lineAlpha: number,
    duration: number,
  ): void {
    const ring =
      this.ringPool.pop()?.setActive(true).setVisible(true) ??
      this.add.graphics().setDepth(DEPTH_FX - 2);
    ring.clear();
    ring.fillStyle(color, fillAlpha).fillCircle(0, 0, radiusPx);
    ring.lineStyle(2, color, lineAlpha).strokeCircle(0, 0, radiusPx);
    ring.setPosition(x, y).setScale(0.3, 0.15).setAlpha(1);
    this.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 0.5,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ring.setActive(false).setVisible(false);
        this.ringPool.push(ring);
      },
    });
  }

  private spawnDamageText(
    x: number,
    y: number,
    damage: number,
    primary: boolean,
  ): void {
    const text =
      this.damageTextPool.pop()?.setActive(true).setVisible(true) ??
      this.add
        .text(0, 0, '', {
          ...DAMAGE_TEXT_STYLE,
          resolution: textResolution(this),
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH_FX);
    text
      .setText(String(Math.round(damage)))
      .setPosition(x, y)
      .setScale(primary ? 1 : SECONDARY_TEXT_SCALE)
      .setAlpha(primary ? 1 : SECONDARY_TEXT_ALPHA);
    this.tweens.add({
      targets: text,
      y: y - 24,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.setActive(false).setVisible(false);
        this.damageTextPool.push(text);
      },
    });
  }

  private onCreepKilled(creepId: EntityId): void {
    const view = this.creeps.get(creepId);
    if (!view) return;
    const { x } = view.container;
    const y = view.container.y - 4;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 10 + Math.random() * 6;
      const particle = this.addParticle(x, y)
        .setScale(this.particleScale)
        .setTint(CREEP_COLOR)
        .setDepth(DEPTH_FX - 1);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist * 0.5,
        alpha: 0,
        scale: 0.4 * this.particleScale,
        duration: 380,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private onProjectileFired(towerId: EntityId): void {
    const view = this.towers.get(towerId);
    if (!view || this.tweens.isTweening(view.sprite)) return;
    this.tweens.add({
      targets: view.sprite,
      scaleX: 1.04 * view.scale,
      scaleY: 0.94 * view.scale,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private flashExit(): void {
    const flash = this.exitFlash;
    if (!flash) return;
    this.tweens.killTweensOf(flash);
    flash.setAlpha(0.85);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeIn',
    });
  }

  // ---- Build ghost & selection ------------------------------------------------------------------

  private updateGhost(state: GameState): void {
    const type = this.bridge.getBuildMode();
    if (type === null || !this.pointerInside) {
      if (this.ghostType !== null || this.ghost.visible) {
        this.ghost.setVisible(false);
        this.ghostRange.setVisible(false);
        this.ghostType = null;
      }
      return;
    }
    const world = viewToWorld(
      this.cameras.main,
      this.pointerX,
      this.pointerY,
      this.tmpWorld,
    );
    const g = screenToGrid(world.x, world.y, this.tmpGrid);
    const pos = footprintTopLeftForCursor(g.x, g.y);
    if (
      type === this.ghostType &&
      pos.x === this.ghostX &&
      pos.y === this.ghostY &&
      state === this.ghostState
    )
      return;

    const typeChanged = type !== this.ghostType;
    this.ghostType = type;
    this.ghostX = pos.x;
    this.ghostY = pos.y;
    this.ghostState = state;

    const valid = validatePlacement(state, this.playerId, type, pos) === null;
    const color = valid ? GHOST_OK : GHOST_BAD;
    this.ghost.clear();
    this.diamond(this.ghost, pos.x, pos.y, TOWER_FOOTPRINT);
    this.ghost.fillStyle(color, 0.35).fillPath();
    this.ghost.lineStyle(1.5, color, 0.95).strokePath();
    this.ghost.setVisible(true);

    if (typeChanged) {
      const range = getTowerDef(type).levels[0]?.range ?? 0;
      this.drawRange(this.ghostRange, range, 0xffffff);
    }
    const anchor = gridToScreen(
      pos.x + TOWER_FOOTPRINT / 2,
      pos.y + TOWER_FOOTPRINT / 2,
      this.tmpScreen,
    );
    this.ghostRange.setPosition(anchor.x, anchor.y).setVisible(true);
  }

  private updateSelection(lane: LaneState): void {
    const id = this.bridge.getSelectedTowerId();
    let tower: TowerState | null = null;
    if (id !== null) {
      for (const t of lane.towers) {
        if (t.id === id) {
          tower = t;
          break;
        }
      }
    }
    const key = tower ? tower.id * 1000 + tower.level : -1;
    if (key === this.selectionKey) return;
    this.selectionKey = key;

    this.highlighted?.clearTint();
    this.highlighted = null;
    this.selection.clear().setVisible(tower !== null);
    this.selectionRange.clear().setVisible(tower !== null);
    if (!tower) return;

    this.diamond(this.selection, tower.pos.x, tower.pos.y, TOWER_FOOTPRINT);
    this.selection.fillStyle(SELECTION_COLOR, 0.2).fillPath();
    this.selection.lineStyle(1.5, SELECTION_COLOR, 1).strokePath();

    const range = getTowerDef(tower.type).levels[tower.level - 1]?.range ?? 0;
    this.drawRange(this.selectionRange, range, SELECTION_COLOR);
    const anchor = gridToScreen(
      tower.pos.x + TOWER_FOOTPRINT / 2,
      tower.pos.y + TOWER_FOOTPRINT / 2,
      this.tmpScreen,
    );
    this.selectionRange.setPosition(anchor.x, anchor.y);

    const sprite = this.towers.get(tower.id)?.sprite ?? null;
    sprite?.setTint(0xfff1b8);
    this.highlighted = sprite;
  }

  /** Grid-aligned square of `size` cells at (x, y), as a closed path on `g` (world coordinates). */
  private diamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
  ): void {
    const [a, b, c, d] = rectDiamond(x, y, size, size);
    if (!a || !b || !c || !d) return;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
  }

  /** Range circle in local coordinates; the Graphics object is scaled by 0.5 vertically (iso). */
  private drawRange(
    g: Phaser.GameObjects.Graphics,
    range: number,
    color: number,
  ): void {
    const r = isoRadiusPx(range);
    g.clear();
    g.fillStyle(color, 0.08).fillCircle(0, 0, r);
    g.lineStyle(2, color, 0.7).strokeCircle(0, 0, r);
  }

  // ---- Input ------------------------------------------------------------------------------------

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
    this.pointerInside = true;
  }

  private onGameOut(): void {
    this.pointerInside = false;
  }

  private handleClick(
    pointer: Phaser.Input.Pointer,
    button: MouseButton,
  ): void {
    if (button === MouseButton.Right) {
      this.bridge.setBuildMode(null);
      return;
    }
    if (button !== MouseButton.Left) return;
    const buildMode = this.bridge.getBuildMode();
    if (buildMode !== null) {
      const world = viewToWorld(
        this.cameras.main,
        pointer.x,
        pointer.y,
        this.tmpWorld,
      );
      const g = screenToGrid(world.x, world.y, this.tmpGrid);
      // Build mode stays active after a placement (repeat placement, WC3 style).
      this.bridge.issue({
        type: 'PlaceTower',
        towerType: buildMode,
        pos: footprintTopLeftForCursor(g.x, g.y),
      });
      return;
    }
    this.bridge.select(this.towerAtPointer(pointer));
  }

  /** Tower under the pointer: footprint cell first, then the sprite bounds (front-most wins). */
  private towerAtPointer(pointer: Phaser.Input.Pointer): EntityId | null {
    const lane = findLane(this.session.getState(), this.playerId);
    if (!lane) return null;
    const world = viewToWorld(
      this.cameras.main,
      pointer.x,
      pointer.y,
      this.tmpWorld,
    );
    const g = screenToGrid(world.x, world.y, this.tmpGrid);
    const cx = Math.floor(g.x);
    const cy = Math.floor(g.y);
    for (const t of lane.towers)
      if (footprintContains(t.pos, cx, cy)) return t.id;

    let best: EntityId | null = null;
    let bestDepth = -Infinity;
    for (const [id, view] of this.towers) {
      const b = view.bounds;
      if (
        world.x >= b.left &&
        world.x <= b.right &&
        world.y >= b.top &&
        world.y <= b.bottom &&
        view.depth > bestDepth
      ) {
        best = id;
        bestDepth = view.depth;
      }
    }
    return best;
  }

  private onEscape(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;
    if (this.bridge.getBuildMode() !== null) this.bridge.setBuildMode(null);
    else this.bridge.deselect();
  }

  // ---- Dev overlay: flow field ------------------------------------------------------------------

  private onToggleFlowField(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;
    this.flowVisible = !this.flowVisible;
    if (!this.flowVisible) this.clearFlowField();
  }

  private clearFlowField(): void {
    for (const t of this.flowTexts) t.destroy();
    this.flowTexts = [];
    this.flowGraphics?.clear();
    this.flowDist = null;
    this.flowNext = null;
  }

  private updateFlowField(lane: LaneState): void {
    if (!this.flowVisible) return;
    const { dist, next } = lane.flowField;
    if (
      this.flowDist &&
      this.flowNext &&
      numbersEqual(this.flowDist, dist) &&
      numbersEqual(this.flowNext, next)
    ) {
      return;
    }
    this.clearFlowField();
    this.flowDist = dist;
    this.flowNext = next;
    const g = (this.flowGraphics ??= this.add.graphics().setDepth(DEPTH_DEBUG));
    g.lineStyle(1, 0xffffff, 0.55);
    const w = lane.width;
    const style = { ...FLOW_TEXT_STYLE, resolution: textResolution(this) };
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i] ?? -1;
      if (d < 0) continue;
      const x = i % w;
      const y = (i - x) / w;
      const c = gridToScreen(x + 0.5, y + 0.5);
      this.flowTexts.push(
        this.add
          .text(c.x, c.y - 2, String(d), style)
          .setOrigin(0.5)
          .setDepth(DEPTH_DEBUG + 1),
      );
      const n = next[i] ?? -1;
      if (n < 0) continue;
      const nx = n % w;
      const t = gridToScreen(nx + 0.5, (n - nx) / w + 0.5);
      const ex = c.x + (t.x - c.x) * 0.45;
      const ey = c.y + (t.y - c.y) * 0.45;
      g.lineBetween(c.x, c.y + 3, ex, ey + 3);
      g.fillStyle(0xffffff, 0.8).fillCircle(ex, ey + 3, 1);
    }
  }

  // ---- Teardown ---------------------------------------------------------------------------------

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.cameraController?.destroy();
    this.cameraController = null;
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    this.input.keyboard?.off('keydown-ESC', this.onEscape, this);
    this.input.keyboard?.off('keydown-F', this.onToggleFlowField, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.towers.clear();
    this.creeps.clear();
    this.creepSkins.clear();
    this.projectiles.clear();
    this.prevCreeps.clear();
    this.prevProjectiles.clear();
    this.pendingEvents = [];
    this.damageTextPool.length = 0;
    this.ringPool.length = 0;
    this.burstSources.clear();
    this.pierceVisuals.clear();
    this.chainBuilds.clear();
    this.chains.length = 0;
    this.chainPool.length = 0;
    this.pendingHits.flush(this.discardHit);
    this.ghosts.clear();
    this.hopSpritePool.length = 0;
    this.trailPool.length = 0;
    this.linePool.length = 0;
    this.sparkPool.length = 0;
    this.flowTexts = [];
    this.flowGraphics = null;
    this.exitFlash = null;
    this.highlighted = null;
    this.groundBuilt = false;
  }
}
