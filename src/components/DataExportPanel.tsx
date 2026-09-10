import { useState } from 'react'
import { StatCard } from './StatCard'
import { useStore } from '@/lib/store'
import { buildFullExportJson, attemptDownload } from '@/lib/dataExport'
import { buildAccountantCsv } from '@/lib/logic'
import { Download, Copy, CheckCircle2, AlertTriangle, Printer } from 'lucide-react'

/**
 * Data export — feature 14 (full JSON for the separate local desktop agent)
 * and feature 15 (accountant-ready CSV + a print-optimized summary that
 * doubles as the "PDF" path via the browser's native print/Save-as-PDF).
 *
 * IMPORTANT PLATFORM CONSTRAINT, disclosed honestly rather than silently
 * failing: a published claude.ai artifact runs inside a sandboxed viewer
 * that blocks page-initiated file downloads for EVERY viewer, including the
 * artifact's own owner. The download buttons below still attempt a real
 * browser download (works if this page is ever opened outside that sandbox,
 * e.g. a self-hosted copy) — but the reliable path inside the sandbox is the
 * "Copy to clipboard" button, then paste into a new file by hand.
 */
export function DataExportPanel() {
  const { state, setLastExportedAt } = useStore()
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedCsv, setCopiedCsv] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [showPrintSummary, setShowPrintSummary] = useState(false)

  const doExportJson = () => {
    const json = JSON.stringify(buildFullExportJson(state), null, 2)
    attemptDownload('clarity-export.json', json, 'application/json')
    setLastExportedAt(new Date().toISOString())
    return json
  }

  const copyJson = async () => {
    const json = doExportJson()
    try {
      await navigator.clipboard.writeText(json)
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2500)
    } catch {
      setShowJsonPreview(true) // clipboard blocked too — fall back to select-all-manually
    }
  }

  const csv = buildAccountantCsv(state.transactions, state.mode, 'All time')
  const copyCsv = async () => {
    attemptDownload('clarity-accountant-summary.csv', csv, 'text/csv')
    try {
      await navigator.clipboard.writeText(csv)
      setCopiedCsv(true)
      setTimeout(() => setCopiedCsv(false), 2500)
    } catch {
      // ignore — CSV textarea below still lets Deep copy manually
    }
  }

  return (
    <>
      <StatCard label="Data Export" glow="cyan" tilt={false}>
        <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Data last exported: {state.lastExportedAt ? new Date(state.lastExportedAt).toLocaleString('en-NZ') : 'never'}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Published artifacts can't reliably trigger a real file download — use "Copy to clipboard" below, then paste into a new file.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={copyJson} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black text-sm font-semibold hover:opacity-90">
            {copiedJson ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiedJson ? 'Copied!' : 'Copy full JSON export'}
          </button>
          <button onClick={() => setShowJsonPreview((v) => !v)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white">
            <Download className="w-4 h-4" /> {showJsonPreview ? 'Hide' : 'Preview'} JSON
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

      <StatCard label="Accountant-Ready Export" glow="purple" tilt={false}>
        <p className="mt-4 text-xs text-white/40">Categorised totals for {state.mode === 'personal' ? 'Personal' : 'Business'} transactions — respects the Personal/Business toggle.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copyCsv} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 text-black text-sm font-semibold hover:opacity-90">
            {copiedCsv ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiedCsv ? 'Copied!' : 'Copy accountant CSV'}
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

function PrintSummaryModal({ csv, mode, onClose }: { csv: string; mode: string; onClose: () => void }) {
  const rows = csv.split('\n')
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 print:bg-white print:p-0" id="print-summary-root">
      <div className="bg-white text-black rounded-2xl max-w-lg w-full p-8 print:rounded-none print:max-w-none print:shadow-none">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h3 className="text-lg font-bold">Accountant Summary — {mode}</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-black">Close</button>
        </div>
        <pre className="text-sm whitespace-pre-wrap font-mono">{rows.join('\n')}</pre>
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
