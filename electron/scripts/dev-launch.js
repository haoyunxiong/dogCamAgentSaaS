const { spawn } = require('child_process')
const http = require('http')
const net = require('net')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const basePort = Number(process.env.VITE_PORT || 5177)
const host = '127.0.0.1'

let viteProc = null
let electronProc = null
let shuttingDown = false

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ port, host }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`未找到可用端口（起始端口 ${startPort}）`)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function probeHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    if (await probeHttp(url)) return true
    await wait(500)
  }
  return false
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (electronProc && !electronProc.killed) electronProc.kill('SIGTERM')
  if (viteProc && !viteProc.killed) viteProc.kill('SIGTERM')
  setTimeout(() => process.exit(code), 100)
}

async function main() {
  const vitePort = await findAvailablePort(basePort)
  const viteUrl = `http://localhost:${vitePort}`

  if (vitePort !== basePort) {
    console.log(`[dev-launch] 端口 ${basePort} 已占用，改用 ${vitePort}`)
  }

  viteProc = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', '--config', 'vite.config.js', '--port', String(vitePort), '--host', host],
    {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: 'inherit',
    },
  )

  viteProc.on('exit', (code) => {
    if (shuttingDown) return
    console.error(`[dev-launch] Vite 已退出，code=${code ?? 'null'}`)
    shutdown(code || 1)
  })

  const ready = await waitForServer(viteUrl)
  if (!ready) {
    throw new Error(`Vite 未在预期时间内启动：${viteUrl}`)
  }

  electronProc = spawn(
    process.execPath,
    ['./node_modules/electron/cli.js', '.'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: viteUrl,
      },
      stdio: 'inherit',
    },
  )

  electronProc.on('exit', (code) => {
    if (shuttingDown) return
    shutdown(code || 0)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('uncaughtException', (error) => {
  console.error('[dev-launch] uncaughtException:', error)
  shutdown(1)
})
process.on('unhandledRejection', (error) => {
  console.error('[dev-launch] unhandledRejection:', error)
  shutdown(1)
})

main().catch((error) => {
  console.error('[dev-launch] startup failed:', error)
  shutdown(1)
})
