'use client'

/**
 * Rasteriza o símbolo SVG da marca Delphi em PNG (com transparência) para uso
 * como marca d'água nos vídeos exportados — FFmpeg WASM não renderiza SVG diretamente.
 */
export async function getDelphiWatermarkPng(sizePx = 256): Promise<Blob> {
  const svgRes = await fetch('/brand/logo-symbol.svg')
  const svgText = await svgRes.text()

  // Força o símbolo para branco (visível sobre qualquer fundo de vídeo)
  const whiteSvg = svgText.replace(/fill="url\(#[^)]+\)"/g, 'fill="#ffffff"').replace(/class="cls-1"/g, '')

  const svgBlob = new Blob([whiteSvg], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao carregar SVG da marca'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, sizePx, sizePx)

  // Centraliza mantendo proporção
  const scale = Math.min(sizePx / img.width, sizePx / img.height) * 0.9
  const w = img.width * scale
  const h = img.height * scale
  ctx.globalAlpha = 0.85
  ctx.drawImage(img, (sizePx - w) / 2, (sizePx - h) / 2, w, h)

  URL.revokeObjectURL(svgUrl)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG'))), 'image/png')
  })
}
