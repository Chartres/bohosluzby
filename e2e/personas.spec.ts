// Persona journeys from docs/PERSONAS.md — the concrete scripts, one test per
// persona. P1 (Marie) lives in hero.spec.ts; P5/P7 are seasonal manual passes.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
})

test('P2 James: Sunday mass in English → jazyk filter → ICS on his calendar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('kostel Nejsvětějšího Salvátora')).toBeVisible()

  // Saturday-evening planning: tomorrow's full ordo first, then narrow by language
  await page.getByRole('button', { name: 'neděle' }).click()
  await expect(page.getByText('neděle 12. 7.')).toBeVisible()
  await page.getByLabel('Jazyk bohoslužby').selectOption('anglicky')

  // only the English mass remains; the Czech Sunday ordo is gone
  const seznam = page.getByTestId('seznam')
  await expect(seznam.getByText('11:00')).toBeVisible()
  await expect(page.getByText('kostel sv. Tomáše (augustiniáni)')).toBeVisible()
  await expect(seznam.getByText('12:00')).toHaveCount(0) // Salvátor's Czech noon
  await shot(page, 'persona-james-english-sunday')

  // the pick lands on his phone calendar with the address attached
  await page.getByText('kostel sv. Tomáše (augustiniáni)').click()
  await expect(page).toHaveURL(/\/kostel\/7\//) // ?den=nedele rides along — back-safe
  const downloadP = page.waitForEvent('download')
  await page.getByRole('button', { name: 'do kalendáře' }).first().click()
  expect((await downloadP).suggestedFilename()).toMatch(/^bohosluzby-7-.*\.ics$/)
})

test('P3 Tomáš: lunch-window mass — kolem 12:00 fits the 11:45–13:00 box', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('kostel Nejsvětějšího Salvátora')).toBeVisible()

  await page.getByLabel('Kolem času').selectOption('12:00')
  const seznam = page.getByTestId('seznam')
  // Salvátor's daily 12:00 is the answer; the 09:30 and evening masses fall outside ±90 min
  await expect(seznam.getByText('12:00')).toBeVisible()
  await expect(seznam.getByText('09:30')).toHaveCount(0)
  await expect(seznam.getByText('16:30')).toHaveCount(0)
  await shot(page, 'persona-tomas-lunch-window')

  // reliability check before he commits his only window: freshness line on detail
  await page.getByText('kostel Nejsvětějšího Salvátora').click()
  await expect(page.getByText(/naposledy ověřeno/)).toBeVisible()
})

test('P4 Novákovi: driving home — city origin + dnes večer, no walk-distance exclusion', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('seznam')).toBeVisible()

  // decided from the passenger seat: destination city, not "here"
  await page.getByRole('button', { name: 'změnit' }).click()
  await page.getByLabel('Kostel nebo obec').fill('praha')
  await page.getByRole('option', { name: /^Praha/ }).click()
  await expect(page).toHaveURL(/\/mesto\/praha\//)

  await page.getByRole('button', { name: 'dnes' }).click()
  await page.getByRole('button', { name: 'večer' }).click()
  const seznam = page.getByTestId('seznam')
  // tonight's evening line-up: 17:00 liturgie, 18:00 PMS, 19:30 Havel — morning gone
  await expect(seznam.getByText('18:00')).toBeVisible()
  await expect(seznam.getByText('19:30')).toBeVisible()
  await expect(page.getByText('katedrála sv. Víta, Václava a Vojtěcha')).not.toBeVisible()
  await shot(page, 'persona-novakovi-vecer-cesta')
})

test('P6 Věra: is the 10:30 cancelled for summer? The note answers, the list agrees', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('seznam')).toBeVisible()

  // she goes straight to her church by name
  await page.getByRole('button', { name: 'změnit' }).click()
  await page.getByLabel('Kostel nebo obec').fill('havla')
  await page.getByRole('option', { name: /kostel sv\. Havla/ }).click()
  await expect(page).toHaveURL('/kostel/3/')

  // the reason is visible, not just an absent row — and the paused 10:30 is
  // muted with an explicit "nyní se nekoná"
  await expect(page.getByText(/kromě července a srpna/)).toBeVisible()
  await expect(page.locator('div[data-paused]').getByText('10:30')).toBeVisible()
  await expect(page.getByText(/nyní se nekoná/)).toBeVisible()
  await expect(page.getByText(/naposledy ověřeno/)).toBeVisible()
  await shot(page, 'persona-vera-letni-poradek')

  // and the hero list agrees: in July, Havel's next mass is tonight's 19:30, not a 10:30
  await page.getByRole('button', { name: '‹ zpět na seznam' }).click()
  const havel = page.getByTestId('seznam').locator('li', { hasText: 'kostel sv. Havla' })
  await expect(havel.getByText('19:30')).toBeVisible()
  await expect(havel.getByText('10:30')).toHaveCount(0)
})
