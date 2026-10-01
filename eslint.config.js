const fs = require('node:fs');
const path = require('node:path');

const nx = require('@nx/eslint-plugin');
const {
  createTypeScriptImportResolver,
  defaultConditionNames,
  defaultExtensionAlias,
  defaultExtensions,
  defaultMainFields,
} = require('eslint-import-resolver-typescript');
const importX = require('eslint-plugin-import-x');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactHooks = require('eslint-plugin-react-hooks');
const simpleImportSort = require('eslint-plugin-simple-import-sort');

const projectDirs = ['apps', 'libs'].flatMap((group) =>
  fs
    .readdirSync(path.join(__dirname, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(entry.parentPath, entry.name)),
);

// Not a glob: the resolver's glob expansion silently drops the tsconfig in ESLint's cwd.
const tsconfigProjects = projectDirs.flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((file) => /^tsconfig.*\.json$/.test(file))
    .map((file) => path.join(dir, file)),
);

// eslint-import-resolver-typescript forces unrs-resolver's `references: 'auto'`, which hands app
// files to the referenced solution-style lib tsconfigs and drops the app's own `paths`.
const appPathsResolvers = projectDirs
  .filter((dir) => dir.startsWith(path.join(__dirname, 'apps')))
  .map((dir) => ({
    dir: dir + path.sep,
    resolver: importX.createNodeResolver({
      conditionNames: defaultConditionNames,
      extensionAlias: defaultExtensionAlias,
      extensions: defaultExtensions,
      mainFields: defaultMainFields,
      tsconfig: { configFile: path.join(dir, 'tsconfig.json') },
    }),
  }));

const appPathsResolver = {
  interfaceVersion: 3,
  name: 'app-tsconfig-paths',
  resolve: (source, file) =>
    appPathsResolvers
      .find(({ dir }) => file.startsWith(dir))
      ?.resolver.resolve(source, file) ?? { found: false },
};

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc/**',
      '**/.astro/**',
      '**/storybook-static/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // @rainforest-dev/personal-portfolio is deliberately non-buildable — its exports point at
          // .ts/.astro source, not a dist — so importing it carries no stale-artifact hazard.
          // This allow entry unblocks just that edge; enforceBuildableLibDependency still
          // protects every other buildable-lib pair.
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?js$',
            '@rainforest-dev/personal-portfolio/**',
          ],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    plugins: {
      'import-x': importX,
    },
    settings: {
      // import-x only follows edges into files whose extension it knows; .ts is not a default.
      'import-x/extensions': [
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
      ],
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
      'import-x/resolver-next': [
        appPathsResolver,
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: tsconfigProjects,
        }),
      ],
    },
    rules: {
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  // React island surface in libs/portfolio: guardrails against hooks bugs and
  // missing a11y. Scoped to this lib (the ~20 island components) rather than the
  // whole repo to keep the change minimal — a repo-wide rollout is a separate
  // step (it surfaces pre-existing a11y issues in other apps' vendored UI).
  // react-hooks is limited to rules-of-hooks + exhaustive-deps (not v7's
  // aggressive React-Compiler rule set); jsx-a11y uses its recommended config.
  {
    files: ['libs/portfolio/**/*.tsx', 'libs/portfolio/**/*.jsx'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
