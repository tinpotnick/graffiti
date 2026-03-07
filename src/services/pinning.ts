/**
 * Pinning service — remote content persistence via Pinata.
 *
 * All operations are fire-and-forget. If no JWT is configured, calls are
 * silently skipped with a console warning.
 */

const PINATA_API = 'https://api.pinata.cloud'
const JWT_KEY = 'graffiti:pinata-jwt'

function _getJwt(): string | null {
  try { return localStorage.getItem(JWT_KEY) } catch { return null }
}

export function hasPinataJwt(): boolean {
  return !!_getJwt()
}

export function setPinataJwt(jwt: string): void {
  try { localStorage.setItem(JWT_KEY, jwt) } catch { /* unavailable */ }
}

export function clearPinataJwt(): void {
  try { localStorage.removeItem(JWT_KEY) } catch { /* unavailable */ }
}

/**
 * Pin a CID on Pinata so content stays available when the app is offline.
 * No-ops silently if JWT is not configured.
 */
export async function pinCid(cid: string, name?: string): Promise<void> {
  const jwt = _getJwt()
  if (!jwt) {
    console.warn('[pinning] Pinata JWT not configured — skipping pin for', cid)
    return
  }

  const res = await fetch(`${PINATA_API}/pinning/pinByHash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      hashToPin: cid,
      pinataMetadata: { name: name ?? cid },
    }),
  })

  if (!res.ok) {
    console.warn('[pinning] Pinata pin failed:', res.status, await res.text())
  }
}
