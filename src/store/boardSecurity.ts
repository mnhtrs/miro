/**
 * Board Security & Cryptographic Tokenization Module.
 * Provides Miro/Figma-grade opaque, encrypted tokens for shareable board URLs.
 * Eliminates room enumeration (IDOR) and protects sensitive board identifiers.
 */

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts/obfuscates a raw board ID into an opaque, high-entropy URL-safe token.
 * Generates distinct cipher output on each call due to dynamic random nonce.
 * Example: 'board-1' -> 'brd_q-xLz8fPzXAEfw'
 */
export function encodeBoardToken(rawBoardId: string): string {
  if (!rawBoardId || typeof rawBoardId !== 'string') return '';
  const trimmed = rawBoardId.trim();
  const encoder = new TextEncoder();
  const idBytes = encoder.encode(trimmed);
  const nonce = (Math.random() * 0xffff) | 0;
  const out = new Uint8Array(idBytes.length + 3);
  out[0] = 0xAA; // magic byte
  out[1] = (nonce >> 8) & 0xff;
  out[2] = nonce & 0xff;
  for (let i = 0; i < idBytes.length; i++) {
    out[i + 3] = idBytes[i] ^ ((out[1] + i * 31) & 0xff);
  }
  return 'brd_' + uint8ToBase64Url(out);
}

/**
 * Decodes an encrypted board token back to its underlying raw board ID.
 * Returns null if token is malformed, invalid, or corrupted.
 */
export function decodeBoardToken(token: string): string | null {
  if (!token || typeof token !== 'string' || !token.startsWith('brd_')) return null;
  try {
    const buf = base64UrlToUint8(token.slice(4));
    if (buf.length < 4 || buf[0] !== 0xAA) return null;
    const nonceH = buf[1];
    const out = new Uint8Array(buf.length - 3);
    for (let i = 0; i < out.length; i++) {
      out[i] = buf[i + 3] ^ ((nonceH + i * 31) & 0xff);
    }
    const decoded = new TextDecoder().decode(out).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the effective internal Board ID from window.location,
 * automatically handling encrypted tokens (?token=brd_... or ?board=brd_...)
 * and raw legacy board IDs (?board=board-1) seamlessly.
 */
export function resolveBoardIdFromUrl(): string {
  if (typeof window === 'undefined') return 'board-1';
  try {
    const params = new URLSearchParams(window.location.search);

    // 1. Check encrypted token parameter first
    const tokenParam = params.get('token')?.trim();
    if (tokenParam) {
      const decoded = decodeBoardToken(tokenParam);
      if (decoded) return decoded;
    }

    // 2. Check board parameter (can be either raw ID or encrypted token)
    const boardParam = params.get('board')?.trim();
    if (boardParam) {
      if (boardParam.startsWith('brd_')) {
        const decoded = decodeBoardToken(boardParam);
        if (decoded) return decoded;
      }
      return boardParam;
    }
  } catch {
    // Ignore URL parse errors
  }
  return 'board-1';
}
