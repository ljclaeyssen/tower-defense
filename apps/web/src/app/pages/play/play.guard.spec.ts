import { TestBed } from '@angular/core/testing';
import {
  Router,
  convertToParamMap,
  provideRouter,
  type ActivatedRouteSnapshot,
  type Params,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { requireFactionGuard } from './play.guard';

const run = (
  mode: string,
  query: Params,
): ReturnType<typeof requireFactionGuard> => {
  const route = {
    paramMap: convertToParamMap({ mode }),
    queryParamMap: convertToParamMap(query),
  } as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() =>
    requireFactionGuard(route, {} as RouterStateSnapshot),
  );
};

const serialize = (result: unknown): string =>
  TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('requireFactionGuard', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] }),
  );

  it('redirects /play/pve without a faction to /factions', () => {
    expect(serialize(run('pve', {}))).toBe('/factions');
  });

  it('redirects an unknown faction and keeps the seed', () => {
    expect(serialize(run('pve', { faction: 'goblins', seed: '42' }))).toBe(
      '/factions?seed=42',
    );
  });

  it('lets a valid faction through', () => {
    expect(run('pve', { faction: 'elves' })).toBe(true);
  });

  it('does not interfere with other modes', () => {
    expect(run('pvp', {})).toBe(true);
  });
});
