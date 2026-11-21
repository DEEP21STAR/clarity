/**
 * Passphrase-encrypted backup of the full Clarity state. AES-256-GCM, key from PBKDF2-SHA256
 * (310,000 rounds, random 16-byte salt), random 12-byte IV per file. The file is self-describing
 * JSON so a restore only needs the file and the passphrase. A wrong passphrase or any edited byte
 * fails the GCM check, so a restore never half-applies. verifyBackup() decrypts without applying,
 * which is the "restore test" a user can run on a file straight after saving it.
 * The passphrase is never stored anywhere: lose it and the file cannot be opened.
 */
import type { AppState } from './store'

const ITERATIONS = 310_000
const FORMAT = 'clarity-encrypted-backup'

export interface EncryptedBackupFile {
  format: typeof FORMAT
  version: 1
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string }
  cipher: { name: 'AES-256-GCM'; iv: string }
  /** base64 of ciphertext + GCM tag */
  data: string
  createdAt: string
}

const b64 = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s) }
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptBackup(state: AppState, passphrase: string, iterations = ITERATIONS): Promise<EncryptedBackupFile> {
  if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, iterations)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(JSON.stringify(state))))
  return { format: FORMAT, version: 1, kdf: { name: 'PBKDF2-SHA256', iterations, salt: b64(salt) }, cipher: { name: 'AES-256-GCM', iv: b64(iv) }, data: b64(ct), createdAt: new Date().toISOString() }
}

export function parseBackupFile(text: string): EncryptedBackupFile {
  let f: Partial<EncryptedBackupFile>
  try { f = JSON.parse(text) } catch { throw new Error('This is not a Clarity backup file.') }
  if (f.format !== FORMAT || f.version !== 1 || !f.kdf?.salt || !f.cipher?.iv || !f.data) throw new Error('This is not a Clarity backup file.')
  if (!Number.isInteger(f.kdf.iterations) || f.kdf.iterations < 1000 || f.kdf.iterations > 5_000_000) throw new Error('This backup file is damaged.')
  return f as EncryptedBackupFile
}

/** Decrypts to the saved state, or throws "Wrong passphrase, or the file was changed." Applies nothing. */
export async function decryptBackup(file: EncryptedBackupFile, passphrase: string): Promise<AppState> {
  try {
    const key = await deriveKey(passphrase, unb64(file.kdf.salt), file.kdf.iterations)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv) as BufferSource }, key, unb64(file.data) as BufferSource)
    const state = JSON.parse(new TextDecoder().decode(pt)) as AppState
    if (typeof state !== 'object' || state === null) throw new Error('bad')
    return state
  } catch {
    throw new Error('Wrong passphrase, or the file was changed.')
  }
}

/** The restore test: proves the file opens with this passphrase and says what is inside, without applying it. */
export async function verifyBackup(text: string, passphrase: string): Promise<{ bills: number; accounts: number; transactions: number; createdAt: string }> {
  const file = parseBackupFile(text)
  const s = await decryptBackup(file, passphrase)
  return { bills: s.bills?.length ?? 0, accounts: s.accounts?.length ?? 0, transactions: s.transactions?.length ?? 0, createdAt: file.createdAt }
}
