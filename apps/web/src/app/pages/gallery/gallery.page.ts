import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { launchGallery, type LaunchedGallery } from '@td/game';

/** Dev page showing every sprite of the game (Phaser scene from `@td/game`). */
@Component({
  selector: 'td-gallery-page',
  imports: [RouterLink, TranslatePipe, ButtonModule],
  template: `
    <div #container class="canvas"></div>
    <header class="td-panel overlay">
      <p-button
        icon="pi pi-arrow-left"
        [text]="true"
        severity="secondary"
        [ariaLabel]="'nav.back' | translate"
        routerLink="/"
      />
      <div>
        <strong>{{ 'gallery.title' | translate }}</strong>
        <p>{{ 'gallery.hint' | translate }}</p>
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      height: 100dvh;
      overflow: hidden;
    }
    .canvas {
      position: absolute;
      inset: 0;
    }
    .overlay {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem 0.5rem 0.5rem;
    }
    .overlay p {
      margin: 0.15rem 0 0;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPage implements OnDestroy {
  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('container');
  private gallery: LaunchedGallery | null = null;

  constructor() {
    afterNextRender(() => {
      this.gallery = launchGallery({ parent: this.container().nativeElement });
    });
  }

  ngOnDestroy(): void {
    this.gallery?.destroy();
    this.gallery = null;
  }
}
