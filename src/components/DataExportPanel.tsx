import { useState } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { buildFullExportJson } from '@/lib/dataExport'
import { buildAccountantCsv } from '@/lib/logic'
import { saveFile } from '@/lib/downloads'
import { Download, Copy, CheckCircle2, AlertTriangle, Printer } from 'lucide-react'

/**
 * Data export — feature 14 (full JSON for the separate local desktop agent)
 * and feature 15 (accountant-ready CSV + a print-optimized summary that
 * doubles as the "PDF" path via the browser's native print/Save-as-PDF).
 *
 * Real file-saving goes through the `downloads` runtime capability
 * (declared on this artifact) via `saveFile()` in `src/lib/downloads.ts` —
 * an earlier `<a download>` approach was confirmed dead in the artifact
 * viewer sandbox and has been removed. If `downloads` isn't available in a
 * given view (older contract, capability not granted, etc), this falls back
 * to a real clipboard copy so Deep can still get the data out by hand.
 */
export function DataExportPanel() {
  const { state, setLastExportedAt } = useStore()
  const [jsonStatus, setJsonStatus] = useState<'idle' | 'saved' | 'copied' | 'declined'>('idle')
  const [csvStatus, setCsvStatus] = useState<'idle' | 'saved' | 'copied' | 'declined'>('idle')
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [showPrintSummary, setShowPrintSummary] = useState(false)

  const exportJson = async () => {
    const json = JSON.stringify(buildFullExportJson(state), null, 2)
    const outcome = await saveFile('clarity-export.json', json)
    setLastExportedAt(new Date().toISOString())
    if (outcome === 'saved') {
      setJsonStatus('saved')
    } else if (outcome === 'declined') {
      setJsonStatus('declined')
    } else {
      try {
        await navigator.clipboard.writeText(json)
        setJsonStatus('copied')
      } catch {
        setShowJsonPreview(true) // clipboard blocked too — fall back to select-all-manually
      }
    }
    setTimeout(() => setJsonStatus('idle'), 3000)
  }

  const csv = buildAccountantCsv(state.transactions, state.mode, 'All time')
  const exportCsv = async () => {
    const outcome = await saveFile('clarity-accountant-summary.csv', csv)
    if (outcome === 'saved') {
      setCsvStatus('saved')
    } else if (outcome === 'declined') {
      setCsvStatus('declined')
    } else {
      try {
        await navigator.clipboard.writeText(csv)
        setCsvStatus('copied')
      } catch {
        // ignore — CSV textarea below still lets Deep copy manually
      }
    }
    setTimeout(() => setCsvStatus('idle'), 3000)
  }

  const jsonLabel = jsonStatus === 'saved' ? 'Saved!' : jsonStatus === 'copied' ? 'Copied to clipboard!' : jsonStatus === 'declined' ? 'Save cancelled' : 'Save full JSON export'
  const csvLabel = csvStatus === 'saved' ? 'Saved!' : csvStatus === 'copied' ? 'Copied to clipboard!' : csvStatus === 'declined' ? 'Save cancelled' : 'Save accountant CSV'

  return (
    <>
      <StatCard label="Data Export" glow="cyan">
        <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Data last exported: {state.lastExportedAt ? new Date(state.lastExportedAt).toLocaleString('en-NZ') : 'never'}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Save asks for your confirmation each time. If it's ever unavailable in your view, the button falls back to copying the data to your clipboard instead.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-sm font-semibold hover:opacity-90">
            {jsonStatus !== 'idle' ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />} {jsonLabel}
          </button>
          <button onClick={() => setShowJsonPreview((v) => !v)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white">
            <Copy className="w-4 h-4" /> {showJsonPreview ? 'Hide' : 'Preview'} JSON
          </button>
        </div>

        {showJsonPreview && (
          <textarea
            readOnly
            value={JSON.stringify(buildFullExportJson(state), null, 2)}
            className="mt-3 w-full h-40 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-white/70 outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        )}
        <p className="text-[11px] text-white/30 mt-2">
          Shape documented in <code>EXPORT_SCHEMA.md</code> at the project root, for the separate local-desktop agent consuming this file.
        </p>
      </StatCard>

      <StatCard label="Accountant-Ready Export" glow="purple">
        <p className="mt-4 text-xs text-white/40">Categorised totals for {state.mode === 'personal' ? 'Personal' : 'Business'} transactions — respects the Personal/Business toggle.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 text-black text-sm font-semibold hover:opacity-90">
            {csvStatus !== 'idle' ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />} {csvLabel}
          </button>
          <button onClick={() => setShowPrintSummary(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white">
            <Printer className="w-4 h-4" /> Print summary (Save as PDF)
          </button>
        </div>
        <textarea readOnly value={csv} className="mt-3 w-full h-28 bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] font-mono text-white/70 outline-none" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
      </StatCard>

      {showPrintSummary && (
        <PrintSummaryModal
          csv={csv}
          mode={state.mode}
          onClose={() => setShowPrintSummary(false)}
        />
      )}
    </>
  )
}

/**
 * #46 — a real print-optimized layout for the accountant PDF export,
 * separate from the on-screen cinematic UI: parses the CSV into two proper
 * HTML tables (category breakdown + summary) instead of dumping a monospace
 * CSV blob, with `@page`/serif-font print rules in index.css so the printed
 * (or Saved-as-PDF) document reads like a real accountant document.
 */
function PrintSummaryModal({ csv, mode, onClose }: { csv: string; mode: string; onClose: () => void }) {
  const lines = csv.split('\n')
  const titleLine = lines[0] ?? ''
  const [, , periodLabel] = titleLine.split(',')
  const catStart = lines.indexOf('Category,Total') + 1
  const catRows: [string, string][] = []
  let i = catStart
  while (i < lines.length && lines[i] !== '') {
    const [cat, total] = lines[i].split(',')
    catRows.push([cat, total])
    i++
  }
  const summaryStart = lines.indexOf('Summary,') + 1
  const summaryRows: [string, string][] = []
  for (let j = summaryStart; j < lines.length; j++) {
    if (!lines[j]) continue
    const [label, val] = lines[j].split(',')
    summaryRows.push([label, val])
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 print:bg-white print:p-0" id="print-summary-root">
      <div className="print-doc bg-white text-black rounded-2xl max-w-lg w-full p-8 print:rounded-none print:max-w-none print:shadow-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h3 className="text-lg font-bold">Accountant Summary — {mode}</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-black">Close</button>
        </div>

        <header className="print-doc-header">
          <h1>Clarity — Accountant Summary</h1>
          <p>{mode === 'personal' ? 'Personal' : 'Business'} · {periodLabel} · generated {new Date().toLocaleDateString('en-NZ')}</p>
        </header>

        <h2 className="print-doc-h2">Category Breakdown</h2>
        <table className="print-doc-table">
          <thead><tr><th>Category</th><th className="print-doc-num">Total</th></tr></thead>
          <tbody>
            {catRows.map(([cat, total]) => (
              <tr key={cat}><td className="capitalize">{cat}</td><td className="print-doc-num">${total}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="print-doc-h2">Summary</h2>
        <table className="print-doc-table">
          <tbody>
            {summaryRows.map(([label, val]) => (
              <tr key={label} className={label === 'Net' ? 'print-doc-total-row' : undefined}>
                <td>{label}</td><td className="print-doc-num">${val}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={() => window.print()}
          className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold print:hidden"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  )
}
