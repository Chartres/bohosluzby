// Persona journey (pilgrim witness): a pilgrim opens the local preview, confirms
// she was at the Mass, leaves positive witness chips, and saves — then the
// church detail shows the corroborated ordo line (threshold=1 locally).
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('preview → Ano → witness chips → saved → detail shows the corroborated line', async ({
  page,
}) => {
  await page.clock.install({ time: FIXED_NOW })
  await mockData(page)
  await page.goto('/?feedback=preview')

  // the after-Mass card appears with a demo Mass (no waiting an hour)
  const card = page.getByRole('region', { name: 'Byli jste na této mši?' })
  await expect(card.getByText('Byli jste na této mši?')).toBeVisible()
  const churchId = await card.getAttribute('data-fb-church-id')
  expect(churchId).toBeTruthy()
  await shot(page, 'witness-ask', true)

  // one tap confirms attendance; the optional chips appear
  await card.getByRole('button', { name: 'Ano, byl/a jsem' }).click()
  await card.getByRole('button', { name: 'hluboký prožitek' }).click()
  await card.getByRole('button', { name: 'krásný zpěv' }).click()
  await shot(page, 'witness-chips', true)

  await card.getByRole('button', { name: 'Uložit' }).click()
  await expect(page.getByText('Díky. Zapsáno pro další poutníky.')).toBeVisible()

  // the detail page now shows the plain ordo witness line for that Mass
  await page.goto(`/kostel/${churchId}/`)
  await expect(page.getByText(/často zmiňují/)).toBeVisible()
  await expect(page.getByText('hluboký prožitek')).toBeVisible()
  await expect(page.getByText(/potvrdil/)).toBeVisible()
  // reverent by construction: no stars anywhere near the Mass
  await expect(page.getByText('★')).toHaveCount(0)
  await shot(page, 'witness-detail', true)
})
