import esbuild from 'esbuild';
import process from 'node:process';
import builtins from 'builtin-modules';

const banner = `/* THIS FILE IS AUTO-GENERATED */
`;

const prod = (process.argv[2] === 'production');

esbuild.build({
  banner: {
    js: banner,
  },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/closebrackets',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/comment',
    '@codemirror/fold',
    '@codemirror/gutter',
    '@codemirror/history',
    '@codemirror/lint',
    '@codemirror/matchbrackets',
    '@codemirror/panel',
    '@codemirror/placeholder',
    '@codemirror/rectangular-selection',
    '@codemirror/search',
    '@codemirror/sel',
    '@codemirror/state',
    '@codemirror/text-selection',
    '@codemirror/transactions',
    '@codemirror/view',
  ].concat(builtins.filter(m => !m.startsWith('node:') && !m.startsWith('crypto'))),
  format: 'cjs',
  target: 'es2020',
  logLevel: "info",
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  platform: 'browser',
}).catch(() => process.exit(1));
