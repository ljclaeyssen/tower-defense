import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'td-lobby-page',
  imports: [RouterLink, TranslatePipe, ButtonModule, CardModule],
  template: `
    <p-card [header]="'nav.lobby' | translate">
      <p>{{ 'lobby.comingSoon' | translate }}</p>
      <p-button
        icon="pi pi-arrow-left"
        [label]="'nav.back' | translate"
        routerLink="/"
      />
    </p-card>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 1rem;
      box-sizing: border-box;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyPage {}
