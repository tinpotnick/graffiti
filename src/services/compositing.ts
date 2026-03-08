import { catBytes } from './ipfs'

/**
 * Decode PNG bytes into an HTMLImageElement.
 * The intermediate blob URL is revoked after decode.
 */
export function loadImageFromBytes(bytes: Uint8Array): Promise<HTMLImageElement> {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

/**
 * Fetch a wall post image by CID. If the post has a wallRef (is a tag/delta),
 * composites the original wall + delta onto a 320×180 canvas.
 * Returns a blob URL suitable for <img src>.
 */
export async function loadWallPostImage(post: {
  cid: string
  bounds?: { x: number; y: number; w: number; h: number }
  wallRef?: string
  wallBounds?: { x: number; y: number; w: number; h: number }
}): Promise<string> {
  if (post.wallRef) {
    const [origBytes, deltaBytes] = await Promise.all([
      catBytes(post.wallRef),
      catBytes(post.cid),
    ])
    const [origImg, deltaImg] = await Promise.all([
      loadImageFromBytes(origBytes),
      loadImageFromBytes(deltaBytes),
    ])

    const oc = document.createElement('canvas')
    oc.width = 320; oc.height = 180
    const ctx = oc.getContext('2d')!
    const ob = post.wallBounds ?? { x: 0, y: 0, w: 320, h: 180 }
    ctx.drawImage(origImg, ob.x, ob.y, ob.w, ob.h)
    const db = post.bounds ?? { x: 0, y: 0, w: 320, h: 180 }
    ctx.drawImage(deltaImg, db.x, db.y, db.w, db.h)

    return new Promise((resolve) => {
      oc.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/png')
    })
  }

  const bytes = await catBytes(post.cid)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
  return URL.createObjectURL(blob)
}

interface Bounded {
  cid: string
  bounds?: { x: number; y: number; w: number; h: number }
}

/**
 * Composite a base wall post + any number of tag layers onto a 320×180 canvas.
 * Loads all images in parallel, draws in order (base first, then tags oldest→newest).
 * Returns a blob URL.
 */
export async function compositeWallState(
  base: Bounded,
  tags: Bounded[],
): Promise<string> {
  // Base image must succeed — let it throw if unavailable
  const baseBytes = await catBytes(base.cid)
  const baseImg = await loadImageFromBytes(baseBytes)

  // Tag images are best-effort — skip any that fail to fetch
  const tagResults = await Promise.all(
    tags.map(async (t) => {
      try {
        const bytes = await catBytes(t.cid)
        const img = await loadImageFromBytes(bytes)
        return { img, bounds: t.bounds }
      } catch {
        return null
      }
    }),
  )

  const oc = document.createElement('canvas')
  oc.width = 320; oc.height = 180
  const ctx = oc.getContext('2d')!

  const bb = base.bounds ?? { x: 0, y: 0, w: 320, h: 180 }
  ctx.drawImage(baseImg, bb.x, bb.y, bb.w, bb.h)

  for (const result of tagResults) {
    if (!result) continue
    const tb = result.bounds ?? { x: 0, y: 0, w: 320, h: 180 }
    ctx.drawImage(result.img, tb.x, tb.y, tb.w, tb.h)
  }

  // Crop to content bounding box (skip transparent edges)
  const id = ctx.getImageData(0, 0, 320, 180)
  const d = id.data
  let top = 180, bottom = 0, left = 320, right = 0
  for (let y = 0; y < 180; y++) {
    for (let x = 0; x < 320; x++) {
      if (d[(y * 320 + x) * 4 + 3] > 0) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  // Fallback: if completely empty, export a 1-row strip
  if (top > bottom) { top = 0; bottom = 0; left = 0; right = 319 }

  const cw = right - left + 1
  const ch = bottom - top + 1
  const cropped = ctx.getImageData(left, top, cw, ch)
  const out = document.createElement('canvas')
  out.width = cw; out.height = ch
  out.getContext('2d')!.putImageData(cropped, 0, 0)

  return new Promise((resolve) => {
    out.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/png')
  })
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
