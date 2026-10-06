import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  createLocalSession,
  launchGame,
  type GameSession,
  type LaunchedGame,
} from '@td/game';
import { DEFAULT_PVE_CONFIG } from '@td/shared';
import { GameFacade } from './game.facade';

/** `?seed=123` makes a game reproducible; anything else falls back to a time-based seed. */
export const resolveSeed = (raw: string | null): number =>
  raw !== null && /^\d+$/.test(raw) ? Number(raw) >>> 0 : Date.now() >>> 0;

/** Hosts the Phaser canvas of a local PvE game and wires its bridge into the `GameFacade`. */
@Component({
  selector: 'td-game-host',
  template: `<div #container class="canvas"></div>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .canvas {
      position: absolute;
      inset: 0;
    }
  `,
  host: { class: 'td-game-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameHostComponent implements OnDestroy {
  private readonly facade = inject(GameFacade);
  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly seed = signal(
    resolveSeed(inject(ActivatedRoute).snapshot.queryParamMap.get('seed')),
  );

  private session: GameSession | null = null;
  private launched: LaunchedGame | null = null;

  constructor() {
    // Browser only: the canvas needs a laid-out parent.
    afterNextRender(() => this.start());
  }

  ngOnDestroy(): void {
    this.facade.detach();
    this.launched?.destroy();
    this.session?.destroy();
    this.launched = null;
    this.session = null;
  }

  private start(): void {
    this.session = createLocalSession({
      config: DEFAULT_PVE_CONFIG,
      seed: this.seed(),
    });
    this.launched = launchGame({
      parent: this.container().nativeElement,
      session: this.session,
    });
    this.facade.attach(this.launched.bridge);
    this.session.start();
  }
}
