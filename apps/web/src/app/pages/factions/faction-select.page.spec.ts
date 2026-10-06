import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import {
  TranslateNoOpLoader,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { FACTION_IDS } from '@td/shared';
import { FACTION_STORAGE_KEY } from '../../core/faction-preference';
import { FactionSelectPage } from './faction-select.page';

describe('FactionSelectPage', () => {
  let fixture: ComponentFixture<FactionSelectPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  const setup = async (
    query: Record<string, string> = {},
  ): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      imports: [FactionSelectPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: provideTranslateLoader(TranslateNoOpLoader),
        }),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(FactionSelectPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  const card = (root: HTMLElement, faction: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(
      `[data-faction="${faction}"]`,
    );
    if (!element) throw new Error(`no card for ${faction}`);
    return element;
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('renders one card with four towers per faction', async () => {
    const root = await setup();
    const cards = root.querySelectorAll('.faction-card');
    expect(cards).toHaveLength(FACTION_IDS.length);
    cards.forEach((element) =>
      expect(element.querySelectorAll('.towers li')).toHaveLength(4),
    );
  });

  it('highlights the remembered faction', async () => {
    localStorage.setItem(FACTION_STORAGE_KEY, 'orcs');
    const root = await setup();
    expect(card(root, 'orcs').classList).toContain('selected');
    expect(card(root, 'elves').classList).not.toContain('selected');
  });

  it('plays the chosen faction and remembers it', async () => {
    const root = await setup({ seed: '42' });
    card(root, 'elves')
      .querySelector<HTMLButtonElement>('.play button')
      ?.click();
    expect(navigate).toHaveBeenCalledWith(['/play', 'pve'], {
      queryParams: { faction: 'elves', seed: '42' },
    });
    expect(localStorage.getItem(FACTION_STORAGE_KEY)).toBe('elves');
  });
});
