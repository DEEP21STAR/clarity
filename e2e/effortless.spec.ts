import { test, expect } from '@playwright/test'
import { openApp, VIEWPORTS } from './support/app'

// The everyday "I just spent something" path: as few steps as possible, no hunting for fields.
test.describe('quick add, desktop', () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test('N opens the sheet focused on the amount; Enter saves; Undo reverses', async ({ page }) => {
    await openApp(page, 'upcoming')
    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog', { name: 'Add entry' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Amount ($)')).toBeFocused()
    await page.keyboard.type('12.5')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    const toast = page.getByRole('status').filter({ hasText: 'Added -$12.5' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Undo' }).click()
    await expect(toast).toBeHidden()
  })

  test('the last category used is already selected next time', async ({ page }) => {
    await openApp(page, 'upcoming')
    await page.getByRole('button', { name: /Add an expense or income/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add entry' })
    await dialog.getByRole('button', { name: 'Fuel' }).click()
    await page.keyboard.press('Tab') // leave the chip so typing goes to the amount
    await dialog.getByLabel('Amount ($)').fill('40')
    await dialog.getByRole('button', { name: 'Save expense' }).click()
    await expect(dialog).toBeHidden()
    await page.keyboard.press('n')
    await expect(page.getByRole('dialog', { name: 'Add entry' }).getByRole('button', { name: 'Fuel' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('N does nothing while you are typing in a field', async ({ page }) => {
    await openApp(page, 'transactions')
    const search = page.getByPlaceholder(/Search description or category/)
    await search.click()
    await page.keyboard.type('nn')
    await expect(page.getByRole('dialog', { name: 'Add entry' })).toHaveCount(0)
    await expect(search).toHaveValue('nn')
  })
})

test.describe('quick add, phone', () => {
  test.use({ viewport: VIEWPORTS.phone })
  test('Add on Home opens the sheet ready to type', async ({ page }) => {
    await openApp(page, 'home')
    await page.getByRole('button', { name: 'Add an expense or income' }).click()
    await expect(page.getByRole('dialog', { name: 'Add entry' }).getByLabel('Amount ($)')).toBeFocused()
  })
})
