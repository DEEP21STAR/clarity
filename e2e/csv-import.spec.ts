import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

const csv = (rows: string[]) => ({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(['Date,Description,Amount', ...rows].join('\n') + '\n') })

test.describe('bank CSV import', () => {
  test('preview, bad rows, add, then re-import adds nothing', async ({ page }) => {
    await openApp(page, 'transactions')
    const file = csv(['21/11/2026,COUNTDOWN WELLINGTON,-84.20', '21/11/2026,"Rent, week 47",-400.00', '22/11/2026,SALARY ACME LTD,1850.50', 'bad date,Mystery,-5.00', '23/11/2026,No amount here,'])
    await page.locator('input[type=file]').setInputFiles(file)
    const preview = page.getByTestId('csv-preview')
    await expect(preview).toContainText('3 new transactions to add')
    await expect(preview).toContainText('2 rows could not be read')
    await expect(preview).toContainText('In $1,850.50')
    await page.getByRole('button', { name: /^Add 3$/ }).click()
    await expect(page.getByText('COUNTDOWN WELLINGTON').first()).toBeVisible()
    await page.locator('input[type=file]').setInputFiles(file)
    await expect(page.getByTestId('csv-preview')).toContainText('0 new transactions')
    await expect(page.getByTestId('csv-preview')).toContainText('3 already in your ledger')
  })

  test('uncategorised rows can be fixed per merchant before adding', async ({ page }) => {
    await openApp(page, 'transactions')
    await page.locator('input[type=file]').setInputFiles(csv(['01/11/2026,ZZ CORNER DAIRY 123,-5.00', '02/11/2026,ZZ CORNER DAIRY 456,-6.00', '03/11/2026,OTHER SHOP,-7.00']))
    const cats = page.getByTestId('csv-preview-categories')
    await expect(cats).toContainText('uncategorised · 3')
    const box = page.getByLabel(/Category for ZZ CORNER DAIRY 123/)
    await box.fill('Groceries')
    await box.press('Enter')
    await expect(cats).toContainText('Groceries · 2')
    await expect(cats).toContainText('uncategorised · 1')
  })

  test('a later import reuses how you filed the merchant', async ({ page }) => {
    await openApp(page, 'transactions')
    await page.locator('input[type=file]').setInputFiles(csv(['01/11/2026,ZZ CORNER DAIRY 123,-5.00']))
    const box = page.getByLabel(/Category for ZZ CORNER DAIRY 123/)
    await box.fill('Corner dairy')
    await box.press('Enter')
    await page.getByRole('button', { name: /^Add 1$/ }).click()
    await page.locator('input[type=file]').setInputFiles(csv(['20/11/2026,ZZ CORNER DAIRY 999,-8.50']))
    await expect(page.getByTestId('csv-preview')).toContainText('1 categorised from how you already filed the same merchant')
    await expect(page.getByTestId('csv-preview-categories')).toContainText('Corner dairy · 1')
  })
})
