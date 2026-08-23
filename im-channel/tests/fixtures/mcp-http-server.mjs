// 测试 fixture：最小 Streamable HTTP MCP 服务器（无状态模式）。
// 启动后向 stdout 打印一行 `PORT=<n>`，供测试读取。
// 设置环境变量 MCP_FIXTURE_TOKEN 时，要求携带 `Authorization: Bearer <token>`，
// 用于验证客户端 headers 透传。
//
// 工具：
//   - echo(text)：原样返回文本
//   - fail()：返回 isError 结果
//   - structured()：返回 structuredContent
import { createServer } from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const token = process.env.MCP_FIXTURE_TOKEN

function buildServer() {
  const server = new Server({ name: 'fixture-http', version: '1.0.0' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'echo', description: '原样返回文本', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
      { name: 'fail', description: '始终失败', inputSchema: { type: 'object', properties: {} } },
      { name: 'structured', description: '返回结构化内容', inputSchema: { type: 'object', properties: {} } },
    ],
  }))
  server.setRequestHandler(CallToolRequestSchema, async req => {
    const { name, arguments: args } = req.params
    if (name === 'echo') {
      return { content: [{ type: 'text', text: String(args?.text ?? '') }] }
    }
    if (name === 'fail') {
      return { isError: true, content: [{ type: 'text', text: 'boom' }] }
    }
    if (name === 'structured') {
      return {
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: { ok: true, value: 42 },
      }
    }
    throw new Error(`unknown tool: ${name}`)
  })
  return server
}

const httpServer = createServer(async (req, res) => {
  if (req.method === 'POST') {
    if (token !== undefined && req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    try {
      // 无状态模式：每请求新建 server + transport（JSON 响应，无会话）
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      const server = buildServer()
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(error) }))
    }
    return
  }
  res.writeHead(405).end()
})

httpServer.listen(0, '127.0.0.1', () => {
  const address = httpServer.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  process.stdout.write(`PORT=${port}\n`)
})
