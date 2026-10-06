import * as Phaser from 'phaser';
import { PIXEL_RATIO_KEY, getPixelRatio } from '../display.js';
import { fitZoom, scrollForZoomAround } from '../render-math.js';

/**
 * Zoom limits in CSS pixels per world pixel. The canvas works in device pixels (see display.ts), so
 * the camera zoom limits are these values multiplied by the pixel ratio.
 */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
/** Pointer travel (CSS px) after which a press becomes a drag instead of a click. */
export const DRAG_THRESHOLD = 4;
const WHEEL_STEP = 1.15;

/** DOM `MouseEvent.button` values. */
export const MouseButton = { Left: 0, Middle: 1, Right: 2 } as const;
export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];

export interface CameraControllerOptions {
  /** Evaluated on left button press: may a left drag pan the camera? (default: true) */
  readonly canPanWithLeft?: (pointer: Phaser.Input.Pointer) => boolean;
  /** A press released without dragging. */
  readonly onClick?: (
    pointer: Phaser.Input.Pointer,
    button: MouseButton,
  ) => void;
}

export interface WorldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Pan (middle/right drag, or left drag when allowed) and wheel zoom around the cursor for the main
 * camera of a scene. Clicks (press + release without dragging) are reported through `onClick`.
 */
export class CameraController {
  private button: MouseButton | null = null;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private panning = false;
  private canPan = false;
  /** True once the user moved or zoomed the camera; automatic refits stop then. */
  userMoved = false;
  private pixelRatio: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: CameraControllerOptions = {},
  ) {
    this.pixelRatio = getPixelRatio(scene);
    scene.registry.events.on(
      `changedata-${PIXEL_RATIO_KEY}`,
      this.onPixelRatioChanged,
      this,
    );
    const input = scene.input;
    input.mouse?.disableContextMenu();
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUpOutside, this);
    input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  /** True while a drag is panning the camera. */
  isPanning(): boolean {
    return this.panning;
  }

  /** Centers the camera on `bounds` with the largest zoom that shows all of it. */
  fit(bounds: WorldBounds): void {
    const cam = this.scene.cameras.main;
    const zoom = fitZoom(
      cam.width,
      cam.height,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      MIN_ZOOM * this.pixelRatio,
      MAX_ZOOM * this.pixelRatio,
    );
    cam.setZoom(zoom);
    cam.centerOn(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
    );
  }

  destroy(): void {
    this.scene.registry.events.off(
      `changedata-${PIXEL_RATIO_KEY}`,
      this.onPixelRatioChanged,
      this,
    );
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUpOutside, this);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.button !== null) return; // a press is already in progress
    const button = pointer.button;
    if (
      button !== MouseButton.Left &&
      button !== MouseButton.Middle &&
      button !== MouseButton.Right
    )
      return;
    this.button = button;
    this.downX = this.lastX = pointer.x;
    this.downY = this.lastY = pointer.y;
    this.panning = false;
    this.canPan =
      button !== MouseButton.Left ||
      (this.options.canPanWithLeft?.(pointer) ?? true);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.button === null) return;
    if (!this.panning && this.canPan) {
      const dx = pointer.x - this.downX;
      const dy = pointer.y - this.downY;
      const threshold = DRAG_THRESHOLD * this.pixelRatio;
      if (dx * dx + dy * dy > threshold * threshold) {
        this.panning = true;
        this.userMoved = true;
      }
    }
    if (this.panning) {
      const cam = this.scene.cameras.main;
      cam.scrollX -= (pointer.x - this.lastX) / cam.zoom;
      cam.scrollY -= (pointer.y - this.lastY) / cam.zoom;
    }
    this.lastX = pointer.x;
    this.lastY = pointer.y;
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const button = this.button;
    if (button === null || pointer.button !== button) return;
    const wasPanning = this.panning;
    this.reset();
    if (!wasPanning) this.options.onClick?.(pointer, button);
  }

  private onUpOutside(pointer: Phaser.Input.Pointer): void {
    if (this.button !== null && pointer.button === this.button) this.reset();
  }

  private reset(): void {
    this.button = null;
    this.panning = false;
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void {
    if (dy === 0) return;
    const cam = this.scene.cameras.main;
    const target = Phaser.Math.Clamp(
      dy > 0 ? cam.zoom / WHEEL_STEP : cam.zoom * WHEEL_STEP,
      MIN_ZOOM * this.pixelRatio,
      MAX_ZOOM * this.pixelRatio,
    );
    if (target === cam.zoom) return;
    const scroll = scrollForZoomAround(cam, pointer.x, pointer.y, target);
    cam.setZoom(target);
    cam.setScroll(scroll.scrollX, scroll.scrollY);
    this.userMoved = true;
  }

  /** Keeps the apparent zoom (CSS px per world px) and the view center when the pixel ratio changes. */
  private onPixelRatioChanged(_parent: unknown, value: unknown): void {
    if (typeof value !== 'number' || value <= 0 || value === this.pixelRatio)
      return;
    const cam = this.scene.cameras.main;
    const centerX = cam.scrollX + cam.width / 2;
    const centerY = cam.scrollY + cam.height / 2;
    cam.setZoom(cam.zoom * (value / this.pixelRatio));
    this.pixelRatio = value;
    cam.centerOn(centerX, centerY);
  }
}
