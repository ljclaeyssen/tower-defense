import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const AMBER_SCALE = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

/** Aura with a gold (amber) primary colour to match the dark fantasy palette. */
export const TdPreset = definePreset(Aura, {
  semantic: {
    primary: Object.fromEntries(
      AMBER_SCALE.map((shade) => [shade, `{amber.${shade}}`]),
    ),
  },
});
