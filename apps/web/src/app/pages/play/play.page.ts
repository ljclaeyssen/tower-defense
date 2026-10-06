import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { GameFacade } from '../../game/game.facade';
import { GameHostComponent } from '../../game/game-host.component';
import { BuildPanel } from '../../game/hud/build-panel.component';
import { GameOverDialog } from '../../game/hud/game-over-dialog.component';
import { HudTopBar } from '../../game/hud/hud-top-bar.component';
import { TowerPanel } from '../../game/hud/tower-panel.component';

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

@Component({
  selector: 'td-play-page',
  imports: [
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    ToastModule,
    GameHostComponent,
    HudTopBar,
    BuildPanel,
    TowerPanel,
    GameOverDialog,
  ],
  // Component-level providers: a fresh facade (and toast channel) per game page instance.
  providers: [GameFacade, MessageService],
  templateUrl: './play.page.html',
  styleUrl: './play.page.scss',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayPage {
  protected readonly facade = inject(GameFacade);

  /** Bound from the `:mode` route parameter. */
  readonly mode = input.required<string>();
  protected readonly isPve = computed(() => this.mode() === 'pve');

  protected onKey(event: KeyboardEvent): void {
    if (
      !this.facade.attached() ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTypingTarget(event.target)
    ) {
      return;
    }
    if (this.handleKey(event.key)) {
      event.preventDefault();
    }
  }

  private handleKey(key: string): boolean {
    if (key === 'Escape') {
      if (this.facade.buildMode() !== null) {
        this.facade.cancelBuild();
      } else {
        this.facade.deselect();
      }
      return true;
    }
    if (key === 'n' || key === 'N') {
      this.facade.startWave();
      return true;
    }
    if (/^[1-9]$/.test(key)) {
      const type = this.facade.buildOptions()[Number(key) - 1]?.type;
      if (type !== undefined) {
        this.facade.toggleBuild(type);
        return true;
      }
    }
    return false;
  }
}
