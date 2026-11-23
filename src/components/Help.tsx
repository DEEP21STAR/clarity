import { useState } from 'react'
import { StatCard } from './StatCard'
import { ChevronDown, Wallet, Receipt, Plus, Upload, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HelpTopic {
  id: string
  icon: typeof Wallet
  title: string
  steps: string[]
}

const TOPICS: HelpTopic[] = [
  {
    id: 'accounts',
    icon: Wallet,
    title: 'Add your account balances',
    steps: [
      'Go to Upcoming Payments.',
      'Scroll to the Accounts card.',
      'Enter your real HSBC and Overdraft balances — whatever they actually are right now.',
      'Live Funds Available recalculates from these the moment you save.',
    ],
  },
  {
    id: 'bills',
    icon: Receipt,
    title: 'Add a recurring bill',
    steps: [
      'Go to Upcoming Payments → Bills.',
      'Switch to Detailed view if you’re in Snapshot.',
      'Add the name, amount, how often it’s charged, and roughly when it’s due.',
      'Mark it Auto-pay if it’s a direct debit, or leave it as “You pay this” if you pay it yourself — tap the badge to switch either way.',
    ],
  },
  {
    id: 'quicklog',
    icon: Plus,
    title: 'Log a spend (the + button)',
    steps: [
      'On Upcoming Payments, find the Food, Fuel, or Personal tile.',
      'Tap the + on the right of the tile.',
      'Type the amount and press Enter, or tap the check.',
      'It deducts immediately from Live Funds Available — no separate save step.',
      'If it would leave you short for an upcoming bill, you’ll get a warning naming that bill before it commits — you can log it anyway or cancel.',
    ],
  },
  {
    id: 'csv',
    icon: Upload,
    title: 'Import a bank statement',
    steps: [
      'Log into your bank’s website or app.',
      'Look for “Export,” “Download transactions,” or “Statements.”',
      'Choose CSV as the format — not PDF.',
      'Pick the last 30–90 days, then download.',
      'You can try this flow end-to-end in the setup wizard preview (Tools → Support Clarity area has the link, or ask whoever set this up for you).',
    ],
  },
]

/**
 * 2026-09-23 — "Help section which acts as an aid how to setup xyz with screenshots GIF etc"
 * (Deep). Built the real structure and real step text now. Honest gap, said here AND in chat
 * rather than faked: no actual screenshots or GIFs yet — capturing genuine ones of Clarity's
 * own UI needs the Chrome extension connected, which it wasn't when this was built. A fake or
 * generic stock image would be worse than none — this placeholder says so plainly instead of
 * pretending. Real screenshots are a follow-up, not skipped scope.
 */
export function Help() {
  const [open, setOpen] = useState<string | null>('accounts')

  return (
    <StatCard label="Help" glow="cyan" tooltip="Step-by-step guides for the most common setup tasks.">
      <div className="mt-4 space-y-2">
        {TOPICS.map((topic) => {
          const Icon = topic.icon
          const isOpen = open === topic.id
          return (
            <div key={topic.id} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : topic.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                aria-expanded={isOpen}
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <span className="text-xs font-semibold text-white/85 flex-1">{topic.title}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-white/35 transition-transform shrink-0', isOpen && 'rotate-180')} />
              </button>
              <div className="disclosure-body" style={{ maxHeight: isOpen ? 400 : 0, opacity: isOpen ? 1 : 0 }}>
                <div className="px-3.5 pb-3.5 pt-1">
                  <ol className="space-y-1.5 text-[11px] text-white/55 leading-relaxed list-decimal list-inside">
                    {topic.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] text-white/30">
                    <ImageOff className="w-3.5 h-3.5 shrink-0" />
                    Screenshots for this step are coming — not faked with a placeholder image.
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </StatCard>
  )
}
