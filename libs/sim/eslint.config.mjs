import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    // libs/sim is a pure, deterministic simulation: no rendering, networking or UI framework.
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mts',
      '**/*.cts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'phaser',
              message: 'libs/sim must stay engine-agnostic (no Phaser).',
            },
            {
              name: 'colyseus',
              message: 'libs/sim must stay network-agnostic (no Colyseus).',
            },
            {
              name: '@td/game',
              message: 'libs/sim must not depend on @td/game.',
            },
          ],
          patterns: [
            {
              group: ['phaser/*'],
              message: 'libs/sim must stay engine-agnostic (no Phaser).',
            },
            {
              group: ['colyseus/*', '@colyseus/*'],
              message: 'libs/sim must stay network-agnostic (no Colyseus).',
            },
            {
              group: ['@angular/*'],
              message: 'libs/sim must stay framework-agnostic (no Angular).',
            },
            {
              group: ['@td/game/*'],
              message: 'libs/sim must not depend on @td/game.',
            },
          ],
        },
      ],
    },
  },
  {
    // Determinism: no randomness, no clock, no transcendental Math functions (results may differ
    // across JS engines). Only + - * /, Math.sqrt, rounding, min/max/abs and integer bit ops.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...[
          'random',
          'sin',
          'cos',
          'tan',
          'atan',
          'atan2',
          'pow',
          'exp',
          'log',
          'hypot',
        ].map((property) => ({
          object: 'Math',
          property,
          message:
            'libs/sim must be deterministic across JS engines: Math.' +
            property +
            ' is forbidden.',
        })),
        {
          object: 'Date',
          property: 'now',
          message: 'libs/sim must not read a clock.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'performance',
          'setTimeout',
          'setInterval',
          'window',
          'document',
          'console',
        ].map((name) => ({
          name,
          message:
            'libs/sim is a pure deterministic simulation: ' +
            name +
            ' is forbidden.',
        })),
      ],
    },
  },
];
