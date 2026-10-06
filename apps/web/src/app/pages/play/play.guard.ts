import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { parseFaction } from '../../core/faction-preference';

/** `/play/pve` needs a valid `?faction=`; without one, send the player to the selection page (keeping `?seed=`). */
export const requireFactionGuard: CanActivateFn = (route) => {
  if (
    route.paramMap.get('mode') !== 'pve' ||
    parseFaction(route.queryParamMap.get('faction'))
  ) {
    return true;
  }
  const seed = route.queryParamMap.get('seed');
  return inject(Router).createUrlTree(['/factions'], {
    queryParams: seed === null ? {} : { seed },
  });
};
