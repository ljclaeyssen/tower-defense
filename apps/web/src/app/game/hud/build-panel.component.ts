import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { getFactionDef, getTowerDef } from '@td/shared';
import { GameFacade } from '../game.facade';

/** Build buttons for the towers of the player's faction, straight from `HudSnapshot.buildOptions`. */
@Component({
  selector: 'td-build-panel',
  imports: [TranslatePipe, ButtonModule, TooltipModule],
  template: `
    <div class="td-panel panel">
      <header class="head">
        <span class="title">{{ 'hud.build' | translate }}</span>
        @if (faction(); as faction) {
          <span
            class="faction"
            [style.color]="faction.color"
            [pTooltip]="'hud.faction' | translate"
            tooltipPosition="top"
            >{{ faction.nameKey | translate }}</span
          >
        }
      </header>
      <div class="options">
        @for (option of options(); track option.type) {
          @let active = facade.buildMode() === option.type;
          <p-button
            [outlined]="!active"
            [severity]="active ? 'warn' : 'secondary'"
            [disabled]="!active && facade.gold() < option.cost"
            [pTooltip]="option.descKey | translate"
            tooltipPosition="top"
            (onClick)="facade.toggleBuild(option.type)"
          >
            <span class="option">
              <kbd>{{ option.hotkey }}</kbd>
              <span class="label">
                <small class="role">{{ option.roleKey | translate }}</small>
                <span>{{ option.nameKey | translate }}</span>
              </span>
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
    .head {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .title {
      color: var(--td-gold);
    }
    .faction {
      font-weight: 700;
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
    .label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
    }
    .role {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.7;
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

  protected readonly faction = computed(() => {
    const faction = this.facade.faction();
    return faction === null ? null : getFactionDef(faction);
  });

  protected readonly options = computed(() =>
    this.facade.buildOptions().map((option) => {
      const tower = getTowerDef(option.type);
      return {
        ...option,
        nameKey: tower.nameKey,
        descKey: tower.descKey,
        roleKey: `roles.${option.role}`,
      };
    }),
  );
}
