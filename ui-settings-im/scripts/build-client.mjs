#!/usr/bin/env node
/**
 * Standalone client bundle builder for @dsh-extra/dsh-client-ui-settings-im.
 *
 * Uses esbuild directly (no tsdown/dsh-internal deps) to produce the
 * `window.__ModuleLoader__.load({ id, factory })` wrapper expected by the
 * dsh client-modules runtime. CSS modules are inlined as a style-injecting
 * JS module (same pattern as the original tsdown dsh-css loader).
 *
 *   node scripts/build-client.mjs
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Resolve esbuild through normal Node resolution (this package's own
// node_modules first); no machine-specific absolute paths.
const { build } = require('esbuild')
import { readFileSync } from 'node:fs'
import { resolve, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgName = '@dsh-extra/dsh-client-ui-settings-im'

const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-api-remotes/client',
]

const cssModulesCache = []

const cssModulesPlugin = {
  name: 'dsh-css-modules',
  setup(b) {
    b.onLoad({ filter: /\.module\.css$/ }, async (args) => {
      const css = readFileSync(args.path, 'utf8')
      const source = basename(args.path, extname(args.path))
      const tagId = `${pkgName}/${source}.module.css`

      const scopedName = 'eiGEEq'
      const classNames = {}
      const escaped = css.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => {
        const scoped = `${scopedName}_${name}`
        if (!(name in classNames)) classNames[name] = scoped
        return `.${scoped}`
      })

      cssModulesCache.push({ tagId, css: escaped })

      const mapping = Object.entries(classNames)
        .map(([name, scoped]) => `"${name}": "${scoped}"`)
        .join(', ')

      const allCss = cssModulesCache.map(c => c.css).join('\n')
      const allTags = cssModulesCache.map(c => `"${c.tagId}"`).join(', ')

      const code = `
const css = ${JSON.stringify(allCss)};
const tagIds = [${allTags}];
if (typeof document !== "undefined") {
  for (const tagId of tagIds) {
    if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = ${JSON.stringify(pkgName)};
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }
  }
}
export default { ${mapping} };
`
      return { contents: code, loader: 'js' }
    })
  },
}

const banner = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkgName)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;`

const footer = `		return module.exports;
	}
});`

console.log('[build-client] bundling src/client/index.ts → lib/client.js …')
const result = await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
	external: EXTERNALS,
	banner: { js: banner },
  footer: { js: footer },
  outfile: resolve(root, 'lib/client.js'),
  sourcemap: true,
  plugins: [cssModulesPlugin],
  logLevel: 'info',
  legalComments: 'none',
})
console.log('[build-client] done.')
