// Task 4 journey: the "Ohlasy poutníků" collapsible filter. With witness rows
// seeded for one church, expanding the section and picking a chip narrows both
// the list and (implicitly, same predicate) the map to churches carrying that
// tag. No network — Supabase is null in e2e, so loadAggregates folds the
// localStorage mirror.
import { test, expect } from '@playwright/test'
import { FIXED_NOW, PRAGUE, mockData, openControls, shot } from './fixtures'

test.use({ geolocation: PRAGUE, permissions: ['geolocation'] })

test('Ohlasy poutníků: default collapsed, a tag narrows the list to matching churches', async ({
  page,
}) => {
  await page.clock.install({ time: FIXED_NOW })
  // seed a witness for kostel sv. Havla (church 3) with "krásný zpěv" before load
  await page.addInitScript(() => {
    localStorage.setItem(
      'bohosluzby:massFeedback',
      JSON.stringify([
        { churchId: '3', massKey: '3|w1|19:30|lat|latinsky', deviceId: 'seed', chips: ['krasny_zpev'] },
      ]),
    )
  })
  await mockData(page)
  await page.goto('/?zobrazeni=seznam')

  const list = page.getByTestId('seznam')
  await expect(list.getByText('kostel sv. Havla')).toBeVisible()
  // more than one church shows before filtering
  await expect(list.getByText('kostel Panny Marie Sněžné')).toBeVisible()
  // the seeded church's row carries the quiet witness mark
  await expect(list.getByRole('img', { name: 'svědectví poutníků' }).first()).toBeVisible()

  await openControls(page)
  // the witness filter is collapsed by default — the chip is not yet reachable
  const filterChip = page.getByRole('button', { name: 'krásný zpěv' })
  await expect(filterChip).toBeHidden()

  // expand "Ohlasy poutníků", then pick the tag
  await page.getByText('Ohlasy poutníků').click()
  await filterChip.click()
  await shot(page, 'witness-filter', true)

  // the list now shows only the church that carries the tag
  await expect(list.getByText('kostel sv. Havla')).toBeVisible()
  await expect(list.getByText('kostel Panny Marie Sněžné')).toBeHidden()
})
