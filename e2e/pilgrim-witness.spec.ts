// Persona journey (pilgrim witness): a pilgrim opens the local preview, confirms
// she was at the Mass, leaves positive witness chips, and saves — then the
// church detail shows the corroborated line (3 seeded witnesses = CORROBORATION_MIN).
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

  // The preview card never writes (App.onCardSubmit), and a tag needs
  // CORROBORATION_MIN (3) witnesses — so three earlier pilgrims are seeded.
  await page.evaluate((id) => {
    const prior = ['p1', 'p2', 'p3'].map((deviceId) => ({
      churchId: id,
      massKey: `${id}|earlier`,
      deviceId,
      chips: ['hluboky_prozitek'],
    }))
    localStorage.setItem('bohosluzby:massFeedback', JSON.stringify(prior))
  }, churchId!)

  await card.getByRole('button', { name: 'Uložit' }).click()
  await expect(page.getByText('Díky. Zapsáno pro další poutníky.')).toBeVisible()

  // the detail page now leads with the church-level witness block — the primary
  // testimony across every Mass here — as one sentence with the count folded in
  // ("V tomto kostele 3 poutníci často zmiňují:") + read-only pills.
  await page.goto(`/kostel/${churchId}/`)
  await expect(page.getByText(/V tomto kostele 3 poutníci často zmiňují/)).toBeVisible()
  await expect(page.getByText('hluboký prožitek').first()).toBeVisible()
  // reverent by construction: no stars anywhere near the Mass
  await expect(page.getByText('★')).toHaveCount(0)
  await shot(page, 'witness-detail', true)
})
