import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LANG_STORAGE_KEY, LocaleService } from './locale.service';

describe('LocaleService', () => {
  let use: ReturnType<typeof vi.fn>;

  const create = (): LocaleService => {
    use = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { use } }],
    });
    return TestBed.inject(LocaleService);
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults to English', () => {
    const service = create();
    expect(service.lang()).toBe('en');
    expect(use).toHaveBeenCalledWith('en');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('en');
  });

  it('ignores an unsupported stored value', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'de');
    expect(create().lang()).toBe('en');
  });

  it('restores the persisted language', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'fr');
    const service = create();
    expect(service.lang()).toBe('fr');
    expect(use).toHaveBeenCalledWith('fr');
  });

  it('persists and applies a new language', () => {
    const service = create();
    service.setLang('fr');
    expect(service.lang()).toBe('fr');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('fr');
    expect(use).toHaveBeenLastCalledWith('fr');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('fr');
  });
});
