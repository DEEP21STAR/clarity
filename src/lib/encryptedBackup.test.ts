import { describe, expect, it } from 'vitest'
import type { AppState } from './store'
import { decryptBackup, encryptBackup, parseBackupFile, verifyBackup } from './encryptedBackup'

const state = { bills: [{ id: 'b1', name: 'Power' }], accounts: [{ id: 'a1' }, { id: 'a2' }], transactions: [], note: 'Ā ünï' } as unknown as AppState
const FAST = 1000

describe('encrypted backup', () => {
  it('round-trips the state exactly, including non-ASCII text', async () => {
    const f = await encryptBackup(state, 'correct horse', FAST)
    expect(await decryptBackup(f, 'correct horse')).toEqual(state)
  })
  it('the file never contains the plain data', async () => {
    const f = await encryptBackup(state, 'correct horse', FAST)
    expect(JSON.stringify(f)).not.toContain('Power')
  })
  it('wrong passphrase fails cleanly', async () => {
    const f = await encryptBackup(state, 'correct horse', FAST)
    await expect(decryptBackup(f, 'wrong horse!!')).rejects.toThrow('Wrong passphrase')
  })
  it('a single changed byte fails the integrity check', async () => {
    const f = await encryptBackup(state, 'correct horse', FAST)
    const raw = atob(f.data); const flipped = String.fromCharCode(raw.charCodeAt(5) ^ 1)
    await expect(decryptBackup({ ...f, data: btoa(raw.slice(0, 5) + flipped + raw.slice(6)) }, 'correct horse')).rejects.toThrow('changed')
  })
  it('two backups of the same data differ (fresh salt and IV)', async () => {
    const a = await encryptBackup(state, 'correct horse', FAST); const b = await encryptBackup(state, 'correct horse', FAST)
    expect(a.data).not.toBe(b.data); expect(a.kdf.salt).not.toBe(b.kdf.salt)
  })
  it('rejects a short passphrase and non-backup files', async () => {
    await expect(encryptBackup(state, 'short', FAST)).rejects.toThrow('8 characters')
    expect(() => parseBackupFile('{"hello":1}')).toThrow('not a Clarity backup')
    expect(() => parseBackupFile('nope')).toThrow('not a Clarity backup')
    expect(() => parseBackupFile(JSON.stringify({ format: 'clarity-encrypted-backup', version: 1, kdf: { salt: 'x', iterations: 2 }, cipher: { iv: 'y' }, data: 'z' }))).toThrow('damaged')
  })
  it('verifyBackup reports what is inside without applying it', async () => {
    const f = await encryptBackup(state, 'correct horse', FAST)
    expect(await verifyBackup(JSON.stringify(f), 'correct horse')).toMatchObject({ bills: 1, accounts: 2, transactions: 0 })
  })
})
