import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { getFactionDef } from '@td/shared';
import { GameFacade } from '../game.facade';

@Component({
  selector: 'td-hud-top-bar',
  imports: [TranslatePipe, ButtonModule, TooltipModule],
  template: `
    <div class="td-panel bar">
      <p-button
        icon="pi pi-arrow-left"
        [text]="true"
        severity="secondary"
        [ariaLabel]="'gameover.backToMenu' | translate"
        [pTooltip]="'gameover.backToMenu' | translate"
        tooltipPosition="bottom"
        (onClick)="backToMenu()"
      />
      <span
        class="stat"
        [pTooltip]="'hud.gold' | translate"
        tooltipPosition="bottom"
      >
        <i class="pi pi-circle-fill coin" aria-hidden="true"></i>
        <span class="sr-only">{{ 'hud.gold' | translate }}</span>
        {{ facade.gold() }}
      </span>
      <span
        class="stat"
        [pTooltip]="'hud.lives' | translate"
        tooltipPosition="bottom"
      >
        <i class="pi pi-heart-fill heart" aria-hidden="true"></i>
        <span class="sr-only">{{ 'hud.lives' | translate }}</span>
        {{ facade.lives() }}
      </span>
      <span
        class="stat"
        [pTooltip]="'hud.income' | translate"
        tooltipPosition="bottom"
      >
        <i class="pi pi-chart-line" aria-hidden="true"></i>
        <span class="sr-only">{{ 'hud.income' | translate }}</span>
        +{{ facade.income() }}
      </span>
      @if (waveLabel(); as wave) {
        <span class="stat">
          <i class="pi pi-flag-fill" aria-hidden="true"></i>
          {{ 'hud.waveOf' | translate: wave }}
        </span>
      }
      @let seconds = facade.secondsToNextWave();
      <p-button
        size="small"
        icon="pi pi-step-forward"
        [label]="
          seconds === null
            ? ('hud.nextWave' | translate)
            : ('hud.nextWaveIn' | translate: { seconds: seconds })
        "
        [disabled]="!facade.canStartWave()"
        [pTooltip]="'N'"
        tooltipPosition="bottom"
        (onClick)="facade.startWave()"
      />
    </div>
    @if (seed() !== null) {
      <span class="seed">
        @if (factionNameKey(); as nameKey) {
          {{ nameKey | translate }} &middot;
        }
        {{ 'hud.seed' | translate }} {{ seed() }}</span
      >
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      padding: 0.25rem 0.75rem;
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .coin {
      color: var(--td-gold);
    }
    .heart {
      color: #e5484d;
    }
    .seed {
      font-size: 0.7rem;
      opacity: 0.6;
      pointer-events: auto;
      user-select: all;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudTopBar {
  protected readonly facade = inject(GameFacade);
  private readonly router = inject(Router);

  readonly seed = input<number | null>(null);

  protected readonly waveLabel = computed(() => {
    const wave = this.facade.wave();
    return wave === null
      ? null
      : { current: Math.max(0, wave.index + 1), total: wave.total };
  });

  protected readonly factionNameKey = computed(() => {
    const faction = this.facade.faction();
    return faction === null ? null : getFactionDef(faction).nameKey;
  });

  protected backToMenu(): void {
    void this.router.navigateByUrl('/');
  }
}
