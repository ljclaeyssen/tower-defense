import { Route } from '@angular/router';
import { requireFactionGuard } from './pages/play/play.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'factions',
    loadComponent: () =>
      import('./pages/factions/faction-select.page').then(
        (m) => m.FactionSelectPage,
      ),
  },
  {
    path: 'lobby',
    loadComponent: () =>
      import('./pages/lobby/lobby.page').then((m) => m.LobbyPage),
  },
  {
    path: 'play/:mode',
    canActivate: [requireFactionGuard],
    loadComponent: () =>
      import('./pages/play/play.page').then((m) => m.PlayPage),
  },
  {
    path: 'dev/gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery.page').then((m) => m.GalleryPage),
  },
  { path: '**', redirectTo: '' },
];
