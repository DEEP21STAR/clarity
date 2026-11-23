import { useState } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { saveFile } from '@/lib/downloads'
import { decryptBackup, encryptBackup, parseBackupFile, verifyBackup } from '@/lib/encryptedBackup'
import { todayIso } from '@/lib/utils'

/** Encrypted full backup, restore test, and restore. The passphrase is never stored; losing it loses the file. */
export function EncryptedBackupPanel() {
  const { state, restoreState, setLastExportedAt } = useStore()
  const [pass, setPass] = useState('')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try { setMsg({ ok: true, text: await fn() }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const save = () => run(async () => {
    const file = JSON.stringify(await encryptBackup(state, pass))
    // test the file we are about to hand over, so a bad save is never discovered at restore time
    await verifyBackup(file, pass)
    setText(file)
    const outcome = await saveFile(`clarity-backup-${todayIso()}.clarity-backup`, file)
    setLastExportedAt(new Date().toISOString())
    if (outcome === 'saved') return 'Saved, and tested: the file opens with this passphrase.'
    try { await navigator.clipboard.writeText(file); return 'Copied to the clipboard (and tested). Paste it into a file you keep.' } catch { return 'Encrypted below (tested). Copy it into a file you keep.' }
  })
  const test = () => run(async () => {
    const r = await verifyBackup(text, pass)
    return `Opens fine: ${r.bills} bills, ${r.accounts} accounts, ${r.transactions} transactions, saved ${new Date(r.createdAt).toLocaleString('en-NZ')}. Nothing was changed.`
  })
  const restore = () => run(async () => {
    const s = await decryptBackup(parseBackupFile(text), pass)
    restoreState(s)
    setArmed(false)
    return 'Restored. Everything on this device now matches the backup.'
  })
  const ready = pass.length >= 8
  return (
    <StatCard label="Encrypted Backup" glow="cyan">
      <p className="mt-4 text-xs text-white/55 flex items-start gap-2"><Lock className="w-4 h-4 shrink-0" />
        Locks everything with a passphrase (AES-256). The passphrase is not stored anywhere: if you lose it, the file cannot be opened.</p>
      <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase (8+ characters)" autoComplete="off"
        className="mt-3 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" data-testid="backup-pass" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!ready || busy} onClick={save} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-sm font-semibold disabled:opacity-40">Save encrypted backup</button>
        <button disabled={!ready || busy || !text} onClick={test} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/80 disabled:opacity-40"><ShieldCheck className="w-4 h-4" />Test it</button>
        <button disabled={!ready || busy || !text} onClick={() => (armed ? restore() : setArmed(true))} className="px-4 py-2 rounded-lg border border-amber-400/40 text-sm text-amber-200 disabled:opacity-40">{armed ? 'Click again: replaces ALL current data' : 'Restore from it'}</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="To test or restore a saved backup, paste its contents here" className="mt-3 w-full h-20 bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/70 outline-none" />
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </StatCard>
  )
}
