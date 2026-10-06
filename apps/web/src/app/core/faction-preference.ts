import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { isFactionId, type FactionId } from '@td/shared';

export const FACTION_STORAGE_KEY = 'td.faction';

/** Validates a raw `?faction=` value. */
export const parseFaction = (
  raw: string | null | undefined,
): FactionId | null => (raw != null && isFactionId(raw) ? raw : null);

/** Remembers the last faction picked on the selection page (localStorage `td.faction`). */
@Injectable({ providedIn: 'root' })
export class FactionPreference {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;
  private readonly _last = signal<FactionId | null>(this.read());

  readonly last = this._last.asReadonly();

  remember(faction: FactionId): void {
    this._last.set(faction);
    try {
      this.storage?.setItem(FACTION_STORAGE_KEY, faction);
    } catch {
      // Storage unavailable: the choice simply is not remembered.
    }
  }

  private read(): FactionId | null {
    try {
      return parseFaction(this.storage?.getItem(FACTION_STORAGE_KEY));
    } catch {
      return null;
    }
  }
}
