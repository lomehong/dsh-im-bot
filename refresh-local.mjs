#!/usr/bin/env node
/**
 * Local-dev refresh: rebuild im-channel from source and push the artifacts
 * into the dsh web profile's installed copy, bypassing pnpm's file:/injected
 * caching (which does not re-pack unchanged-version local packages).
 *
 *   node refresh-local.mjs
 *
 * Restart `dsh web` afterwards. Idempotent.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = dirname(fileURLToPath(import.meta.url))
const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const profileDir = join(home, 'profiles', 'web')

const targets = [
  { name: '@dsh-extra/im-channel', src: join(repo, 'im-channel') },
  { name: '@dsh-extra/dsh-client-ui-settings-im', src: join(repo, 'ui-settings-im') },
]

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`[dsh-im-bot] 命令失败: ${command} ${args.join(' ')}（exit ${result.status}）`)
    process.exit(1)
  }
}

for (const target of targets) {
  const dest = join(profileDir, 'node_modules', ...target.name.split('/'))
  if (!existsSync(dest)) {
    console.error(`[dsh-im-bot] ${target.name} 尚未安装到 profile（${dest} 不存在）。先运行 install.mjs 或手动 pnpm add file:${target.src}`)
    process.exit(1)
  }
}

console.log('[dsh-im-bot] 构建 im-channel…')
run('npx', ['tsc', '-p', 'tsconfig.json'], join(repo, 'im-channel'))

console.log('[dsh-im-bot] 构建 ui-settings-im…')
run('npx', ['tsc', '-b', 'tsconfig.json'], join(repo, 'ui-settings-im'))
run('npx', ['tsc', '-b', 'tsconfig.build.json'], join(repo, 'ui-settings-im'))
run('node', ['scripts/build-client.mjs'], join(repo, 'ui-settings-im'))

for (const target of targets) {
  const srcLib = join(target.src, 'lib')
  if (!existsSync(srcLib)) {
    console.log(`[dsh-im-bot] 跳过 ${target.name}（无构建产物）`)
    continue
  }
  const dest = join(profileDir, 'node_modules', ...target.name.split('/'))
  rmSync(join(dest, 'lib'), { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(srcLib, join(dest, 'lib'), { recursive: true })
  console.log(`[dsh-im-bot] 已同步 ${target.name}/lib → profile`)
}

console.log('[dsh-im-bot] 完成。重启 dsh web 后生效。')
