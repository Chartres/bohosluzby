// The prototype/production split (task 5): VITE_WITNESS_PREVIEW=1 shows a per-tag
// count on each pill; production shows no numbers and leans on the strongest tag.
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WitnessPills } from './WitnessPills'

const CHIPS = [
  { id: 'krasny_zpev', count: 3 },
  { id: 'hluboky_prozitek', count: 1 },
]

afterEach(() => vi.unstubAllEnvs())

it('prototype build shows the per-tag count on each pill', () => {
  vi.stubEnv('VITE_WITNESS_PREVIEW', '1')
  render(<WitnessPills chips={CHIPS} />)
  expect(screen.getByText('krásný zpěv · 3')).toBeInTheDocument()
  expect(screen.getByText('hluboký prožitek · 1')).toBeInTheDocument()
})

it('production shows no numbers and marks the strongest tag stronger', () => {
  vi.stubEnv('VITE_WITNESS_PREVIEW', '')
  const { container } = render(<WitnessPills chips={CHIPS} />)
  expect(screen.getByText('krásný zpěv')).toBeInTheDocument()
  expect(screen.queryByText(/· \d/)).toBeNull()
  // the single strongest (first) tag carries the stronger pill class
  const strong = container.querySelectorAll('.witness-pill--strong')
  expect(strong).toHaveLength(1)
  expect(strong[0].textContent).toContain('krásný zpěv')
})
