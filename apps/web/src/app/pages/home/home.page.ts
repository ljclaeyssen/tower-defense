import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, translate } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { AppLang, LocaleService } from '../../core/locale.service';

const HOW_TO_PLAY_KEYS = [
  'home.howToPlay.build',
  'home.howToPlay.path',
  'home.howToPlay.upgrade',
  'home.howToPlay.waves',
] as const;

@Component({
  selector: 'td-home-page',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    SelectModule,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly locale = inject(LocaleService);
  protected readonly howToPlayKeys = HOW_TO_PLAY_KEYS;

  private readonly english = translate('common.english');
  private readonly french = translate('common.french');

  protected readonly languages = computed<{ label: string; value: AppLang }[]>(
    () => [
      { label: String(this.english()), value: 'en' },
      { label: String(this.french()), value: 'fr' },
    ],
  );
}
