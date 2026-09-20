import type { IncomingMessage, ServerResponse } from 'node:http'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

export function sendJson(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  })
  res.end(JSON.stringify(data))
}

export function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS })
  res.end(html)
}

export function sendOptions(res: ServerResponse): void {
  res.writeHead(204, CORS_HEADERS)
  res.end()
}