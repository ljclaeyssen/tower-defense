import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { getTowerDef, secondsFromTicks } from '@td/shared';
import { attackStat } from '../../core/tower-stats';
import { GameFacade } from '../game.facade';

/** Details and actions for the selected tower. Rendered only while a tower is selected. */
@Component({
  selector: 'td-tower-panel',
  imports: [TranslatePipe, DecimalPipe, ButtonModule, TagModule],
  template: `
    @if (view(); as v) {
      <div class="td-panel panel">
        <header class="head">
          <span class="title">
            <small class="role">{{ v.roleKey | translate }}</small>
            <strong>{{ v.nameKey | translate }}</strong>
          </span>
          <p-tag
            severity="warn"
            [value]="'hud.level' | translate: { level: v.level }"
          />
          <p-button
            icon="pi pi-times"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            size="small"
            [ariaLabel]="'hud.close' | translate"
            (onClick)="facade.deselect()"
          />
        </header>
        <dl class="stats">
          <dt>{{ 'hud.damage' | translate }}</dt>
          <dd>{{ v.damage }}</dd>
          <dt>{{ 'hud.range' | translate }}</dt>
          <dd>{{ v.range | number: '1.0-1' }}</dd>
          <dt>{{ 'hud.cooldown' | translate }}</dt>
          <dd>{{ v.cooldownSeconds | number: '1.0-2' }} s</dd>
        </dl>
        @if (v.roleStat; as stat) {
          <p class="role-stat">{{ stat.key | translate: stat.params }}</p>
        }
        <div class="actions">
          @let upgradeCost = facade.upgradeCost();
          <p-button
            icon="pi pi-arrow-up"
            size="small"
            [label]="
              upgradeCost === null
                ? ('hud.max' | translate)
                : ('hud.upgrade' | translate) + ' (' + upgradeCost + ')'
            "
            [disabled]="upgradeCost === null || facade.gold() < upgradeCost"
            (onClick)="facade.upgrade()"
          />
          <p-button
            icon="pi pi-wallet"
            size="small"
            severity="danger"
            [outlined]="true"
            [label]="
              ('hud.sell' | translate) +
              ' (+' +
              (facade.sellRefund() ?? 0) +
              ')'
            "
            (onClick)="facade.sell()"
          />
        </div>
        @if (v.nextDamage !== null) {
          <small class="next">{{
            'hud.nextDamage' | translate: { damage: v.nextDamage }
          }}</small>
        }
      </div>
    }
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      min-width: 15rem;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .title {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .role {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.7;
    }
    .stats {
      display: grid;
      grid-template-columns: auto auto;
      gap: 0.2rem 1rem;
      margin: 0;
    }
    dt {
      opacity: 0.7;
    }
    dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .role-stat {
      margin: 0;
      color: var(--td-gold);
      font-size: 0.85rem;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .next {
      opacity: 0.7;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TowerPanel {
  protected readonly facade = inject(GameFacade);

  protected readonly view = computed(() => {
    const tower = this.facade.selectedTower();
    const level = this.facade.selectedLevel();
    if (tower === null || level === null) {
      return null;
    }
    const def = getTowerDef(tower.type);
    return {
      nameKey: def.nameKey,
      roleKey: `roles.${def.role}`,
      level: tower.level,
      damage: level.damage,
      range: level.range,
      cooldownSeconds: secondsFromTicks(level.cooldownTicks),
      roleStat: attackStat(level.attack),
      nextDamage: this.facade.nextLevel()?.damage ?? null,
    };
  });
}
