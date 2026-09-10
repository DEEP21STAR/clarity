# Clarity Data Export — Schema Reference

This document describes the exact JSON shape produced by Clarity's "Copy full
JSON export" button (Tools tab), built by `buildFullExportJson()` in
`src/lib/dataExport.ts`. It exists specifically so a **separate, independently
running agent** (a free local-LLM query tool and desktop bar-widget on Deep's
machine) can consume this file with **no shared context or prior knowledge**
of how Clarity itself is built. Keep this document in sync with
`src/lib/dataExport.ts` if the export shape ever changes — bump
`schemaVersion` when you do.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-10T09:15:00.000Z",
  "mode": "personal",
  "country": "NZ",
  "grossAnnualIncome": 65000,
  "accounts": [ /* Account[] */ ],
  "recurringBills": [ /* RecurringBill[] */ ],
  "periodicBills": [ /* PeriodicBill[] */ ],
  "sinkingFunds": [ /* SinkingFund[] */ ],
  "savingsGoals": [ /* SavingsGoal[] */ ],
  "creditCards": [ /* CreditCardAccount[] */ ],
  "deviceRepayments": [ /* DeviceRepayment[] */ ],
  "debts": [ /* Debt[] */ ],
  "transactions": [ /* Transaction[] */ ],
  "oneOffEntries": [ /* OneOffEntry[] */ ],
  "netWorthHistory": [ /* NetWorthSnapshot[] */ ],
  "householdView": "combined",
  "streak": { "current": 0, "best": 0, "lastCheckedDate": "", "milestonesHit": [] }
}
```

All monetary values are plain JavaScript numbers in NZD or AUD (whichever
`country` is set to) — **not** cents, **not** strings. All dates are ISO
`YYYY-MM-DD` strings unless noted as a full ISO datetime.

## Field reference

### `mode`: `"personal" | "business"`
Which set of transactions/exports the app was showing when exported.

### `country`: `"NZ" | "AU"`
Which tax jurisdiction's brackets/GST/levies apply.

### `grossAnnualIncome`: number
Editable gross annual income used to derive net income on the Dashboard.

### `accounts`: Account[]
```ts
{
  id: string            // e.g. "hsbc", "overdraft", "savings", "asset-car"
  name: string           // e.g. "HSBC", "Car"
  type: "liquid" | "asset"  // liquid = real bank balance; asset = manually-maintained non-liquid value
  value: number
  countsTowardLiveFunds: boolean  // true only for HSBC + Overdraft
  note?: string
}
```
**"asset" accounts (Car, Home, Other) are manually entered by Deep — there is
no live market valuation behind these numbers.** Treat them as his own
estimate, not an authoritative current value.

### `recurringBills`: RecurringBill[]
```ts
{
  id: string
  name: string
  amount: number
  frequency: "weekly" | "fortnightly" | "monthly"
  dueDay: number              // day-of-month, 1-31, only meaningful when frequency === "monthly"
  dueDayIsEstimate: boolean   // true = placeholder due-day, not confirmed
  category: "housing" | "utilities" | "insurance" | "subscription" | "debt" | "other"
  active: boolean
  note?: string
  owner: "deep" | "mimi" | "shared"
  sharedSplitDeepPercent?: number  // when owner === "shared", % of the bill attributed to Deep (rest to Mimi); default 50
  previousAmount?: number     // the amount before the most recent edit, if the bill was ever price-changed
}
```

### `periodicBills`: PeriodicBill[]
Usage-metered bills (power/gas style) with a real billing period and
optional credit balance.
```ts
{
  id: string
  name: string
  pendingBill?: { amount: number; dueDate: string; periodStart: string; periodEnd: string }  // an already-billed lump sum currently due, if any
  gaugePeriodStart: string    // the in-progress billing period start
  gaugePeriodEnd: string      // the in-progress billing period end
  projectedCharge: number     // projected charge for the in-progress period
  inCredit: boolean
  creditAmount: number        // only meaningful when inCredit is true
  smoothingEnabled: boolean   // when false, this bill is informational only — its smoothed amount does NOT reduce Live Funds Available
  owner: "deep" | "mimi" | "shared"
  sharedSplitDeepPercent?: number
}
```

### `sinkingFunds`: SinkingFund[]
Generalised irregular/lump-sum expenses (car WOF/rego, Christmas, annual
subscriptions) smoothed into fortnightly set-asides — same math as periodic
bills, no billing-period semantics.
```ts
{ id: string; name: string; targetAmount: number; targetDate: string; currentSaved: number }
```

### `savingsGoals`: SavingsGoal[]
```ts
{ id: string; name: string; targetAmount: number; targetDate?: string; contributedAmount: number; fundedThisPeriod: number }
```
`fundedThisPeriod` is deducted from Live Funds Available each Upcoming
Payments period until Deep clicks "Log this period's contribution" (which
moves it into `contributedAmount`).

### `creditCards`: CreditCardAccount[]
```ts
{
  id: string
  name: string
  balance: number
  creditLimit?: number
  availableToSpend: number
  minPayment: number
  minPaymentDueDate?: string   // ISO date, absent if no minimum is currently required
  rates: { purchase: number; cashAdvance: number; interestFreePlan: number; expiredPlanRate: number }  // all decimal APR, e.g. 0.2899 = 28.99%
  plans: InstallmentPlan[]
  owner: "deep" | "mimi" | "shared"
}
```
`InstallmentPlan`:
```ts
{
  id: string
  name: string
  total: number
  remaining: number       // can EXCEED `total` if interest accrued post-expiry — never clamped
  monthsTotal: number
  monthsRemaining: number
  expired: boolean         // true = actively accruing rates.expiredPlanRate right now
}
```

### `deviceRepayments`: DeviceRepayment[]
```ts
{ id: string; name: string; monthlyAmount: number; remaining: number; paymentsTotal: number; paymentsRemaining: number; owner: "deep" | "mimi" | "shared" }
```
Plain repayments — no interest.

### `debts`: Debt[]
```ts
{ id: string; name: string; balance: number; apr: number; minPayment: number }
```

### `transactions`: Transaction[]
```ts
{ id: string; date: string; description: string; amount: number; category: string; mode: "personal" | "business" }
```
`amount` is signed: negative = expense, positive = income.

### `oneOffEntries`: OneOffEntry[]
```ts
{ id: string; date: string; description: string; amount: number }
```
Signed the same way as transactions. Feeds the cash-flow projection chart only — not part of the transaction ledger.

### `netWorthHistory`: NetWorthSnapshot[]
```ts
{ date: string; netWorth: number; totalAssets: number; totalLiabilities: number }
```
At most one entry per calendar day.

### `householdView`: `"deep" | "mimi" | "combined"`
Whichever view was selected in the app at export time — informational only, doesn't change what's included in the export (the export always contains everything, unfiltered).

### `streak`: StreakState
```ts
{ current: number; best: number; lastCheckedDate: string; milestonesHit: number[] }
```
Days without exceeding the Food/Fuel/Personal spend allocation, checked once per real calendar day the app is opened (not a true background daily job — there is no backend).

## What this export deliberately does NOT include

- The 6-digit PIN (never exported).
- Any derived/computed values (Live Funds Available, health score, projected balances) — the consuming agent should recompute these from the raw data above using its own logic, since Clarity's exact formulas may evolve. The health-score formula, if you want to replicate it exactly, is documented in a comment on `calcFinancialHealthScore()` in `src/lib/logic.ts` in the Clarity source repo (`~/clarity-dashboard-source`).
