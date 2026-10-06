import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TOWER_TYPE_IDS, getTowerDef } from '@td/shared';
import { GameFacade } from '../game.facade';

interface BuildOption {
  readonly type: (typeof TOWER_TYPE_IDS)[number];
  readonly nameKey: string;
  readonly cost: number;
  readonly hotkey: number;
}

const BUILD_OPTIONS: readonly BuildOption[] = TOWER_TYPE_IDS.map(
  (type, index) => {
    const def = getTowerDef(type);
    return {
      type,
      nameKey: def.nameKey,
      cost: def.levels[0]?.cost ?? 0,
      hotkey: index + 1,
    };
  },
);

@Component({
  selector: 'td-build-panel',
  imports: [TranslatePipe, ButtonModule, TooltipModule],
  template: `
    <div class="td-panel panel">
      <span class="title">{{ 'hud.build' | translate }}</span>
      <div class="options">
        @for (option of options; track option.type) {
          @let active = facade.buildMode() === option.type;
          <p-button
            [outlined]="!active"
            [severity]="active ? 'warn' : 'secondary'"
            [disabled]="!active && facade.gold() < option.cost"
            [pTooltip]="'hud.selectTowerHint' | translate"
            tooltipPosition="top"
            (onClick)="facade.toggleBuild(option.type)"
          >
            <span class="option">
              <kbd>{{ option.hotkey }}</kbd>
              <span>{{ option.nameKey | translate }}</span>
              <span class="cost"
                ><i class="pi pi-circle-fill" aria-hidden="true"></i
                >{{ option.cost }}</span
              >
            </span>
          </p-button>
        }
        @if (facade.buildMode() !== null) {
          <p-button
            icon="pi pi-times"
            [text]="true"
            severity="secondary"
            [label]="'hud.cancel' | translate"
            [pTooltip]="'Esc'"
            tooltipPosition="top"
            (onClick)="facade.cancelBuild()"
          />
        }
      </div>
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
    }
    .title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--td-gold);
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .option {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .cost {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-variant-numeric: tabular-nums;
    }
    .cost i {
      font-size: 0.7rem;
      color: var(--td-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildPanel {
  protected readonly facade = inject(GameFacade);
  protected readonly options = BUILD_OPTIONS;
}
