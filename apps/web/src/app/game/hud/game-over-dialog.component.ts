import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { GameFacade } from '../game.facade';

const RESULT_ICONS = {
  victory: 'pi pi-trophy',
  defeat: 'pi pi-heart',
  draw: 'pi pi-flag',
} as const;

@Component({
  selector: 'td-game-over-dialog',
  imports: [TranslatePipe, ButtonModule, DialogModule],
  template: `
    <p-dialog
      [visible]="result() !== null"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [header]="'gameover.title' | translate"
    >
      @if (result(); as result) {
        <p class="message">
          <i [class]="icons[result]" aria-hidden="true"></i>
          {{ 'gameover.' + result | translate }}
        </p>
      }
      <ng-template #footer>
        <p-button
          severity="secondary"
          [outlined]="true"
          icon="pi pi-home"
          [label]="'gameover.backToMenu' | translate"
          (onClick)="backToMenu()"
        />
        <p-button
          icon="pi pi-refresh"
          [label]="'gameover.playAgain' | translate"
          (onClick)="playAgain()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      font-size: 1.1rem;
    }
    .message i {
      font-size: 1.75rem;
      color: var(--td-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameOverDialog {
  private readonly facade = inject(GameFacade);
  private readonly router = inject(Router);

  protected readonly icons = RESULT_ICONS;
  protected readonly result = computed(() =>
    this.facade.phase() === 'ended' ? this.facade.result() : null,
  );

  /**
   * Starts a fresh game with a new seed. Going through `/` (without touching the address bar)
   * guarantees the play page, its facade and the Phaser game are all recreated.
   */
  protected async playAgain(): Promise<void> {
    const seed = Date.now() >>> 0;
    await this.router.navigateByUrl('/', { skipLocationChange: true });
    await this.router.navigate(['/play', 'pve'], { queryParams: { seed } });
  }

  protected backToMenu(): void {
    void this.router.navigateByUrl('/');
  }
}
