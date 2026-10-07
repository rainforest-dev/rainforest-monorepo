import baseConfig from '../../eslint.config.js';

const TSL_ONLY = [
  'src/components/views/study/three/kitTsl.ts',
  'src/components/views/study/three/studyMaterial.ts',
  'src/components/views/study/three/studyMaterial.test.ts',
];

export default [
  ...baseConfig,
  {
    ignores: ['**/.next', '**/dist'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: TSL_ONLY,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: ['three/webgpu', 'three/tsl'].map((name) => ({
            name,
            allowTypeImports: true,
            message:
              'Only the TSL kit (kitTsl.ts, studyMaterial.ts) loads three/webgpu and three/tsl; shared Study code reaches the renderer through StudyKit.',
          })),
        },
      ],
    },
  },
];
