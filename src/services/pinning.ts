/**
 * Pinning service — remote content persistence via Pinata.
 *
 * Uploads actual bytes to Pinata's pinFileToIPFS endpoint so content is
 * available on the IPFS network even when the browser node is offline.
 *
 * All operations are fire-and-forget. If no JWT is configured, calls are
 * silently skipped with a console warning.
 */

const PINATA_API = 'https://api.pinata.cloud'
const JWT_KEY = 'graffiti:pinata-jwt'
const GATEWAY_KEY = 'graffiti:pinata-gateway'

console.info('[pinning] module loaded — using pinFileToIPFS upload')

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

/** Pinata dedicated gateway URL, e.g. "https://mygateway.mypinata.cloud" */
export function getPinataGateway(): string | null {
  try { return localStorage.getItem(GATEWAY_KEY) } catch { return null }
}

export function setPinataGateway(url: string): void {
  // Strip trailing slash for consistent URL building
  try { localStorage.setItem(GATEWAY_KEY, url.replace(/\/+$/, '')) } catch { /* unavailable */ }
}

export function clearPinataGateway(): void {
  try { localStorage.removeItem(GATEWAY_KEY) } catch { /* unavailable */ }
}

/**
 * Upload a single file to Pinata so content stays available when the app is offline.
 * Uses cidVersion 1 to match Helia's default CID format.
 * No-ops silently if JWT is not configured.
 */
export async function pinFile(data: Uint8Array, name?: string, expectedCid?: string): Promise<void> {
  const jwt = _getJwt()
  if (!jwt) {
    console.warn('[pinning] Pinata JWT not configured — skipping pin for', name)
    return
  }

  const formData = new FormData()
  formData.append('file', new Blob([data]), name ?? 'file')
  formData.append('pinataMetadata', JSON.stringify({ name: name ?? 'graffiti-file' }))
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}` },
    body: formData,
  })

  if (!res.ok) {
    console.warn('[pinning] Pinata upload failed:', res.status, await res.text())
  } else {
    const result = await res.json()
    const pinataCid = result.IpfsHash
    console.info('[pinning] Pinned file', name, '→', pinataCid)
    if (expectedCid && pinataCid !== expectedCid) {
      console.warn('[pinning] CID MISMATCH! Helia:', expectedCid, 'Pinata:', pinataCid)
    }
  }
}
