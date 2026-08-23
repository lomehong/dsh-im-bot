// 测试 fixture：最小 stdio MCP 服务器。
// 工具：
//   - ping()：返回 "pong"
//   - add(a, b)：返回两数之和
// 注意：stdio 传输下 stdout 只允许协议消息，任何日志必须走 stderr。
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server({ name: 'fixture-stdio', version: '1.0.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'ping', description: '返回 pong', inputSchema: { type: 'object', properties: {} } },
    { name: 'add', description: '两数求和', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async req => {
  const { name, arguments: args } = req.params
  if (name === 'ping') {
    return { content: [{ type: 'text', text: 'pong' }] }
  }
  if (name === 'add') {
    const sum = Number(args?.a ?? 0) + Number(args?.b ?? 0)
    return { content: [{ type: 'text', text: String(sum) }] }
  }
  throw new Error(`unknown tool: ${name}`)
})

process.stderr.write('[fixture-stdio] starting\n')
await server.connect(new StdioServerTransport())
