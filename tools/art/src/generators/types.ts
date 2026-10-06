import type { FactionId, Team } from '@td/shared';

/** Output of every generator: an SVG document of `width` × `height` logical px. */
export interface Sprite {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** Anchor in logical px from the top-left corner. */
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface TowerParams {
  readonly faction: FactionId;
  /** 1-based level. */
  readonly level: number;
  readonly team: Team;
}

export type TowerGenerator = (params: TowerParams) => Sprite;

export interface CreepParams {
  /** Walk frame 0..3. */
  readonly frame: number;
  /** Optional team markings; the atlas frames are team-less. */
  readonly team?: Team;
}

export interface CreepGenerator {
  readonly walk: (params: CreepParams) => Sprite;
  readonly shadow: () => Sprite;
}
