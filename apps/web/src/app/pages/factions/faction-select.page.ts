import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import {
  FACTION_IDS,
  getFactionDef,
  getFactionTowers,
  getTowerDef,
  getTowerLevel,
  type FactionId,
} from '@td/shared';
import { FactionPreference } from '../../core/faction-preference';
import { keyStat } from '../../core/tower-stats';

/** Static view model built once from the balance data. */
const FACTION_CARDS = FACTION_IDS.map((id) => {
  const faction = getFactionDef(id);
  return {
    id,
    nameKey: faction.nameKey,
    descKey: faction.descKey,
    color: faction.color,
    towers: getFactionTowers(id).map((type) => {
      const tower = getTowerDef(type);
      const level1 = getTowerLevel(type, 1);
      return {
        type,
        roleKey: `roles.${tower.role}`,
        nameKey: tower.nameKey,
        descKey: tower.descKey,
        cost: level1.cost,
        stat: keyStat(level1),
      };
    }),
  };
});

@Component({
  selector: 'td-faction-select-page',
  imports: [RouterLink, TranslatePipe, ButtonModule, CardModule],
  templateUrl: './faction-select.page.html',
  styleUrl: './faction-select.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactionSelectPage {
  private readonly router = inject(Router);
  private readonly seed =
    inject(ActivatedRoute).snapshot.queryParamMap.get('seed');
  protected readonly preference = inject(FactionPreference);
  protected readonly factions = FACTION_CARDS;

  protected play(faction: FactionId): void {
    this.preference.remember(faction);
    void this.router.navigate(['/play', 'pve'], {
      queryParams:
        this.seed === null ? { faction } : { faction, seed: this.seed },
    });
  }
}
