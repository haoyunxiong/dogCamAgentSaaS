/**
 * 免押海报 Canvas 绘制
 * 输出最新蓝色版「支付宝免押确认」海报 PNG。
 */

import { getDepositDisplaySettings } from '../services/depositSettingsService.js'
import brandLogoUrl from '../assets/brand-dog.jpg'

const POSTER_WIDTH = 1024
const POSTER_HEIGHT = 1536
const BLUE = '#0874e8'
const BLUE_DARK = '#0b5fc8'
const BLUE_SOFT = '#edf6ff'
const BLUE_LINE = '#cfe5ff'
const TEXT = '#101828'
const MUTED = '#667085'
const LIGHT = '#f6faff'
const BORDER = '#d8e5f3'
const WHITE = '#ffffff'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function fillRound(ctx, x, y, w, h, r, fill, stroke = null) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function text(ctx, value, x, y, {
  size = 24,
  weight = '400',
  color = TEXT,
  align = 'left',
  baseline = 'alphabetic',
} = {}) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(String(value || ''), x, y)
}

function fitText(ctx, value, x, y, maxWidth, {
  size = 24,
  minSize = 16,
  weight = '400',
  color = TEXT,
  align = 'left',
  baseline = 'alphabetic',
} = {}) {
  const content = String(value || '')
  let nextSize = size
  ctx.font = `${weight} ${nextSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  while (nextSize > minSize && ctx.measureText(content).width > maxWidth) {
    nextSize -= 1
    ctx.font = `${weight} ${nextSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  }
  text(ctx, content, x, y, { size: nextSize, weight, color, align, baseline })
}

function fmtFee(v) {
  return `¥ ${Number(v || 0).toFixed(2)}`
}

function fmtDate(v) {
  if (!v) return '-'
  return String(v).slice(0, 10).replaceAll('-', '/')
}

function rentDays(order) {
  if (Number(order.rentDays || 0)) return Number(order.rentDays)
  if (!order.rentStartDate || !order.rentEndDate) return 0
  const s = new Date(`${String(order.rentStartDate).slice(0, 10)}T00:00:00`)
  const e = new Date(`${String(order.rentEndDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

function truncate(ctx, value, maxWidth) {
  const str = String(value || '')
  if (ctx.measureText(str).width <= maxWidth) return str
  let next = str
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1)
  }
  return `${next}...`
}

function multiline(ctx, lines, x, y, lineH, options = {}) {
  lines.forEach((line, index) => text(ctx, line, x, y + index * lineH, options))
}

export async function generateDepositPosterBlob(order) {
  const display = getDepositDisplaySettings()
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_WIDTH
  canvas.height = POSTER_HEIGHT
  const ctx = canvas.getContext('2d')

  drawBackground(ctx)
  drawHeader(ctx, display)
  await drawProductSummary(ctx, order)
  await drawQrSection(ctx, order, display)
  drawProcess(ctx, display)
  drawFooterInfo(ctx, display)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260)
  gradient.addColorStop(0, BLUE)
  gradient.addColorStop(1, '#0d82f3')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)

  fillRound(ctx, 18, 118, POSTER_WIDTH - 36, POSTER_HEIGHT - 136, 68, WHITE)
  ctx.fillStyle = '#e9f5ff'
  ctx.globalAlpha = 0.9
  roundRect(ctx, 18, 118, POSTER_WIDTH - 36, 260, 68)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawHeader(ctx, display) {
  text(ctx, '∞  云上印鉴', POSTER_WIDTH / 2, 58, { size: 40, weight: '800', color: WHITE, align: 'center' })
  text(ctx, '科技赋能 | 助力信任', POSTER_WIDTH / 2, 88, { size: 16, weight: '600', color: '#dceeff', align: 'center' })

  const title = display.posterTitle || '支付宝免押确认'
  fitText(ctx, title, POSTER_WIDTH / 2, 206, 760, { size: 48, minSize: 34, weight: '800', color: TEXT, align: 'center' })
  text(ctx, display.posterSubtitle || '请使用支付宝扫码完成免押授权', POSTER_WIDTH / 2, 266, { size: 30, weight: '500', color: '#1f2937', align: 'center' })
}

async function drawProductSummary(ctx, order) {
  const x = 46
  const y = 318
  const w = 932
  const h = 292
  fillRound(ctx, x, y, w, h, 24, WHITE, '#ebf1f7')

  await drawProductImage(ctx, order, x + 30, y + 30, 150, 170)

  fillRound(ctx, x + 215, y + 38, 98, 42, 14, '#e7f2ff')
  text(ctx, '租赁商品', x + 264, y + 66, { size: 22, weight: '700', color: BLUE, align: 'center' })
  const product = truncate(ctx, order.productName || '租赁商品', 360)
  fitText(ctx, product, x + 330, y + 70, 380, { size: 34, minSize: 24, weight: '700', color: TEXT })

  drawMetric(ctx, x + 215, y + 128, '押金金额', fmtFee(order.depositAmount), '', true, 220)
  drawMetric(ctx, x + 455, y + 128, '租期', `${fmtDate(order.rentStartDate)} ~ ${fmtDate(order.rentEndDate)}`, `共 ${rentDays(order)} 天`, false, 250)
  drawMetric(ctx, x + 735, y + 128, '租金（展示）', fmtFee(order.rentAmount), '仅供展示，不自动扣款', false, 178)

  ctx.strokeStyle = '#e4e7ec'
  ctx.setLineDash([8, 7])
  ctx.beginPath()
  ctx.moveTo(x + 30, y + 244)
  ctx.lineTo(x + w - 30, y + 244)
  ctx.stroke()
  ctx.setLineDash([])
}

async function drawProductImage(ctx, order, x, y, w, h) {
  fillRound(ctx, x, y, w, h, 18, '#f3f7fb')
  try {
    const img = await loadImage(brandLogoUrl)
    drawImageContain(ctx, img, x + 12, y + 12, w - 24, h - 24)
    return
  } catch {
    if (order.productImageUrl) {
      try {
        const img = await loadImage(await resolvePosterImageUrl(order.productImageUrl))
        drawImageContain(ctx, img, x + 10, y + 10, w - 20, h - 20)
        return
      } catch { /* fallback below */ }
    }
  }
  ctx.strokeStyle = BLUE_LINE
  ctx.lineWidth = 4
  fillRound(ctx, x + 48, y + 28, 55, 118, 16, '#1f2937')
  fillRound(ctx, x + 64, y + 44, 24, 24, 12, '#374151')
  fillRound(ctx, x + 60, y + 82, 32, 34, 8, '#111827')
  text(ctx, '设备', x + w / 2, y + h - 20, { size: 20, color: MUTED, align: 'center' })
}

function drawImageContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height)
  const drawW = img.width * scale
  const drawH = img.height * scale
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH)
}

function drawMetric(ctx, x, y, label, value, sub = '', accent = false, maxWidth = 220) {
  text(ctx, label, x, y, { size: 22, weight: '600', color: MUTED })
  fitText(ctx, value, x, y + 58, maxWidth, { size: accent ? 36 : 25, minSize: accent ? 26 : 17, weight: accent ? '900' : '600', color: accent ? BLUE : TEXT })
  if (sub) text(ctx, sub, x, y + 96, { size: 20, color: MUTED })
}

async function drawQrSection(ctx, order, display) {
  const x = 66
  const y = 636
  const w = 892
  const h = 438
  fillRound(ctx, x, y, w, h, 20, BLUE_SOFT, BLUE_LINE)

  text(ctx, `◷ ${display.expiresInLabel || '二维码有效期：24小时'}`, POSTER_WIDTH / 2, y + 44, { size: 26, weight: '800', color: BLUE_DARK, align: 'center' })
  text(ctx, '请在有效期内完成扫码授权，过期后需重新创建免押单', POSTER_WIDTH / 2, y + 86, { size: 18, color: MUTED, align: 'center' })

  const qrSize = 280
  const qrX = POSTER_WIDTH / 2 - qrSize / 2
  const qrY = y + 116
  fillRound(ctx, qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 18, WHITE, '#edf2f7')
  await drawQr(ctx, order.qrImageUrl, qrX, qrY, qrSize, display)
}

async function drawQr(ctx, url, x, y, size, display) {
  if (!url) {
    drawQrFallback(ctx, x, y, size, '二维码加载中')
    return false
  }
  try {
    const img = await loadImage(await resolvePosterImageUrl(url))
    ctx.drawImage(img, x, y, size, size)
    return true
  } catch {
    drawQrFallback(ctx, x, y, size, display.posterQRFallback || '二维码加载失败\n请复制邀约文本')
    return false
  }
}

function drawQrFallback(ctx, x, y, size, label) {
  fillRound(ctx, x, y, size, size, 18, '#f8fafc', '#d0d5dd')
  multiline(ctx, String(label).split('\n'), x + size / 2, y + size / 2 - 16, 34, { size: 24, weight: '700', color: MUTED, align: 'center' })
}

function drawProcess(ctx, display) {
  const x = 46
  const y = 1094
  const w = 932
  const h = 210
  fillRound(ctx, x, y, w, h, 22, WHITE, '#ebf1f7')
  text(ctx, '免押授权流程', x + 26, y + 42, { size: 24, weight: '800' })

  const configuredSteps = Array.isArray(display.processSteps) && display.processSteps.length
    ? display.processSteps
    : ['扫码授权', '核对资料', '信用评估', '完成授权']
  const descriptions = ['打开支付宝扫一扫', '确认商品、押金、租期', '芝麻信用进行评估', '评估通过完成授权']
  const steps = configuredSteps.slice(0, 4).map((label, index) => [String(index + 1), label, descriptions[index] || ''])
  steps.forEach((step, index) => {
    const cx = x + 120 + index * 220
    fillRound(ctx, cx - 36, y + 64, 72, 72, 36, '#eef7ff')
    fillRound(ctx, cx - 16, y + 84, 32, 32, 16, BLUE)
    text(ctx, step[0], cx, y + 107, { size: 18, weight: '800', color: WHITE, align: 'center' })
    text(ctx, step[1], cx, y + 152, { size: 22, weight: '800', align: 'center' })
    text(ctx, step[2], cx, y + 184, { size: 18, color: MUTED, align: 'center' })
    if (index < steps.length - 1) text(ctx, '>', cx + 108, y + 106, { size: 34, weight: '700', color: '#9cc9f6', align: 'center' })
  })
}

function drawFooterInfo(ctx, display) {
  const y = 1340
  fillRound(ctx, 46, y, 932, 132, 20, '#fbfdff', '#e5edf5')
  text(ctx, '温馨提示', 86, y + 34, { size: 23, weight: '800', color: BLUE_DARK })
  const tips = Array.isArray(display.tips) && display.tips.length
    ? display.tips
    : [
        '请使用本人实名支付宝账号完成授权',
        '如扫码后无反应，请使用最新版支付宝重试',
        '本二维码有效期为 24 小时，过期请联系商家重新生成',
        '免押结果将实时同步给商家，请放心使用',
      ]
  multiline(ctx, tips.slice(0, 4), 86, y + 62, 23, { size: 17, color: '#344054' })

  text(ctx, '如有疑问请联系商家', 618, y + 34, { size: 23, weight: '800', color: BLUE_DARK })
  text(ctx, display.merchantName || '小狗相机租赁', 618, y + 68, { size: 21, weight: '700' })
  text(ctx, `微电同号：${display.contactPhones || '19822964925，13060186655'}`, 618, y + 98, { size: 18, color: '#344054' })
  text(ctx, `工作时间：${display.workTime || '09:30-00:30'}`, 618, y + 124, { size: 18, color: '#344054' })

  text(ctx, '由云上印鉴提供技术支持 | 安全 · 可靠 · 合规', POSTER_WIDTH / 2, 1512, { size: 18, color: BLUE_DARK, align: 'center' })
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}

async function resolvePosterImageUrl(url) {
  if (!url || String(url).startsWith('data:') || String(url).startsWith('blob:')) return url
  const fn = window.electronAPI?.depositFetchImageDataUrl
  if (typeof fn !== 'function') return url
  const result = await fn(url)
  return result?.success && result.dataUrl ? result.dataUrl : url
}

export async function downloadDepositPoster(order, filename) {
  try {
    const blob = await generateDepositPosterBlob(order)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `免押单_${order.depositOrderNo}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch (e) {
    console.error('下载海报失败:', e)
    return false
  }
}
