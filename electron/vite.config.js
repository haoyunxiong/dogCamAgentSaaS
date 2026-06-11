import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const workspaceRoot = path.resolve(__dirname, '..')
const alternateWorkspaceRoots = [
  '/Users/lishuangshuang/Downloads/闲鱼Agent/XianyuAgentPro',
]
const gatewayHost = process.env.XIANYU_MOBILE_GATEWAY_HOST || '127.0.0.1'
const gatewayPort = process.env.XIANYU_MOBILE_GATEWAY_PORT || process.env.GATEWAY_PORT || '8787'
const gatewayTarget = `http://${gatewayHost}:${gatewayPort}`

export default defineConfig({
  plugins: [vue()],
  root: 'renderer',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5177,
    allowedHosts: ['kitlend.natapp1.cc'],
    proxy: {
      '/mobile': {
        target: gatewayTarget,
        changeOrigin: false,
        xfwd: true,
      },
      '/api/mobile': {
        target: gatewayTarget,
        changeOrigin: false,
        xfwd: true,
      },
      '/api/feishu': {
        target: gatewayTarget,
        changeOrigin: false,
        xfwd: true,
      },
    },
    fs: {
      allow: [
        workspaceRoot,
        __dirname,
        ...alternateWorkspaceRoots,
      ],
    },
  },
})
