import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  outDir: '../../dist/module',
  rollup: {
    output: {
      // Runtime files live alongside module.mjs in the published package.
      paths: (id: string) => id.endsWith('/runtime/utils/media.js') ? './runtime/utils/media.js' : id,
    },
  },
  externals: [
    './runtime/utils/media.js',
    'ufo',
    'defu',
    'destr',
    'unstorage',
    'unstorage/drivers/fs',
    'chokidar',
    'anymatch',
    'readdirp',
    'picomatch',
    'normalize-path',
    'postcss',
    'nuxt-component-meta',
    'untyped',
  ],
  entries: [
    './src/module',
    {
      input: './src/runtime/',
      outDir: `../../dist/module/runtime`,
      addRelativeDeclarationExtensions: true,
      ext: 'js',
      pattern: [
        '**',
        '!**/*.stories.{js,cts,mts,ts,jsx,tsx}', // ignore storybook files
        '!**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}', // ignore tests
      ],
      esbuild: {
        jsxImportSource: 'vue',
        jsx: 'automatic',
        jsxFactory: 'h',
      },
    },
  ],
})
