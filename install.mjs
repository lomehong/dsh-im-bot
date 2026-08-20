#!/usr/bin/env node
/**
 * dsh-im-bot one-command installer.
 *
 *   curl -fsSL https://raw.githubusercontent.com/lomehong/dsh-im-bot/main/install.mjs | node
 *
 * Idempotent: safe to re-run (e.g. to update). Edits the dsh web profile
 * manifest, then runs pnpm install in the profile directory.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REPO = 'git+https://github.com/lomehong/dsh-im-bot.git#main'
const NPM_TAG = 'latest'
const PKGS = [
  { name: '@dsh-extra/im-channel', path: '/im-channel' },
  { name: '@dsh-extra/dsh-client-ui-settings-im', path: '/ui-settings-im' },
]
// DSH_IM_SOURCE=npm|git 选择安装源；默认 npm（发布后），npm 不存在时自动回退 git。
const SOURCE = process.env.DSH_IM_SOURCE ?? 'npm'
function specFor(pkg) {
  return SOURCE === 'git' ? `${REPO}&path:${pkg.path}` : `${pkg.name}@${NPM_TAG}`
}
const BASE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const profileDir = join(home, 'profiles', 'web')
mkdirSync(profileDir, { recursive: true })

const manifestPath = join(profileDir, 'package.json')
let manifest = {
  name: 'dsh-profile-web',
  private: true,
  dependencies: {},
  dsh: { profile: { bundles: [...BASE_BUNDLES] } },
}
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.error(`[dsh-im-bot] 无法解析 ${manifestPath}：${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
manifest.name ??= 'dsh-profile-web'
manifest.private ??= true
manifest.dependencies ??= {}
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
manifest.dsh.profile.bundles = [...new Set([...(manifest.dsh.profile.bundles ?? []), ...BASE_BUNDLES])]
for (const pkg of PKGS) manifest.dependencies[pkg.name] = specFor(pkg)
manifest.dsh.profile.bundles = [...new Set([...manifest.dsh.profile.bundles, ...PKGS.map(p => p.name)])]
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const wsPath = join(profileDir, 'pnpm-workspace.yaml')
if (!existsSync(wsPath)) {
  writeFileSync(wsPath, 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n')
}

console.log(`[dsh-im-bot] profile 已更新（源：${SOURCE}），开始安装依赖…`)
const installResult = spawnSync('pnpm', ['install'], {
  cwd: profileDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
// Verify by presence: pnpm exits non-zero on advisory policy warnings
// (e.g. unapproved build scripts), which do not affect a working install.
const allInstalled = () => PKGS.every(pkg =>
  existsSync(join(profileDir, 'node_modules', ...pkg.name.split('/'), 'package.json')))
const installFailed = installResult.status !== 0 || !allInstalled()
if (installFailed && SOURCE === 'npm') {
  console.warn('[dsh-im-bot] npm 源安装失败（可能尚未发布），自动回退 GitHub 源重试…')
  for (const pkg of PKGS) manifest.dependencies[pkg.name] = `${REPO}&path:${pkg.path}`
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}
`)
  const retry = spawnSync('pnpm', ['install'], {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (retry.status !== 0 || !allInstalled()) {
    console.error('[dsh-im-bot] 安装失败，请检查上方输出。')
    process.exit(1)
  }
} else if (installFailed) {
  console.error('[dsh-im-bot] 安装失败，请检查上方输出。')
  process.exit(1)
}
console.log('[dsh-im-bot] 安装完成！重启 dsh web 后：设置 → 插件 → 手机连接，扫码即可使用。')
