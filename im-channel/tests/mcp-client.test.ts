/**
 * MCP 客户端 e2e：HTTP 与 stdio 双传输，对真实（fixture）服务器做
 * initialize 握手、tools/list、tools/call、isError / structuredContent、
 * headers 透传与 stdio 进程生命周期验证。
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

import { McpClient, McpManager } from '../src/channels/wecom/mcp-client.ts'

const fixturesDir = new URL('./fixtures/', import.meta.url)
const httpFixture = fileURLToPath(new URL('mcp-http-server.mjs', fixturesDir))
const stdioFixture = fileURLToPath(new URL('mcp-stdio-server.mjs', fixturesDir))

const children: ChildProcess[] = []

afterAll(async () => {
  for (const child of children) {
    child.kill()
  }
})

/** 启动 HTTP fixture 并等待其打印 PORT=<n>；token 非空时开启鉴权。 */
async function startHttpFixture(token?: string): Promise<string> {
  const child = spawn(process.execPath, [httpFixture], {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(token !== undefined ? { env: { ...process.env, MCP_FIXTURE_TOKEN: token } } : {}),
  })
  children.push(child)
  return await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTP fixture 启动超时')), 10_000)
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /PORT=(\d+)/.exec(chunk.toString())
      if (match !== null) {
        clearTimeout(timer)
        resolve(`http://127.0.0.1:${match[1]}/mcp`)
      }
    })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`HTTP fixture 提前退出: ${code}`)) })
  })
}

describe('McpClient over streamable HTTP', { timeout: 30_000 }, () => {
  it('lists tools and calls them through a real handshake', async () => {
    const url = await startHttpFixture()
    const client = new McpClient({ name: 'fixture', url })
    try {
      const tools = await client.listTools()
      expect(tools.map(t => t.name).sort()).toEqual(['echo', 'fail', 'structured'])

      const echoed = await client.callTool('echo', { text: '你好 MCP' })
      expect(echoed.isError).toBe(false)
      expect(echoed.text).toBe('你好 MCP')

      const failed = await client.callTool('fail', {})
      expect(failed.isError).toBe(true)
      expect(failed.text).toBe('boom')

      const structured = await client.callTool('structured', {})
      expect(structured.structuredContent).toEqual({ ok: true, value: 42 })
    } finally {
      await client.close()
    }
  })

  it('forwards custom headers (auth token)', async () => {
    const url = await startHttpFixture('s3cret')
    const withoutHeaders = new McpClient({ name: 'no-auth', url })
    try {
      await expect(withoutHeaders.listTools()).rejects.toThrow()
    } finally {
      await withoutHeaders.close()
    }
    const withHeaders = new McpClient({ name: 'auth', url, headers: { Authorization: 'Bearer s3cret' } })
    try {
      const tools = await withHeaders.listTools()
      expect(tools.length).toBe(3)
    } finally {
      await withHeaders.close()
    }
  })
})

describe('McpClient over stdio', { timeout: 30_000 }, () => {
  it('spawns the server process and calls its tools', async () => {
    const client = new McpClient({ name: 'fixture-stdio', command: process.execPath, args: [stdioFixture] })
    try {
      const tools = await client.listTools()
      expect(tools.map(t => t.name).sort()).toEqual(['add', 'ping'])

      const pong = await client.callTool('ping', {})
      expect(pong.text).toBe('pong')

      const sum = await client.callTool('add', { a: 20, b: 22 })
      expect(sum.text).toBe('42')
    } finally {
      await client.close()
    }
  })

  it('reports a friendly error for a missing command', async () => {
    const client = new McpClient({ name: 'missing', command: 'definitely-not-a-real-command-xyz' })
    await expect(client.listTools()).rejects.toThrow()
    await client.close()
  })
})

describe('McpManager', () => {
  it('keeps the same client while the fingerprint is unchanged, replaces on change', () => {
    const manager = new McpManager()
    const first = manager.register({ name: 's', command: process.execPath, args: [stdioFixture] })
    const same = manager.register({ name: 's', command: process.execPath, args: [stdioFixture] })
    expect(same).toBe(first)
    const changed = manager.register({ name: 's', command: process.execPath, args: [stdioFixture, '--changed'] })
    expect(changed).not.toBe(first)
    void manager.closeAll()
  })
})
