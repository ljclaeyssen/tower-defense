import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'lobby',
    loadComponent: () =>
      import('./pages/lobby/lobby.page').then((m) => m.LobbyPage),
  },
  {
    path: 'play/:mode',
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
