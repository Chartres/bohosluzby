import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AfterMassCard, type CardMass } from './AfterMassCard'

// the write-path occurrence fields the card threads through unchanged
const OCC = { weekday: 7, time: '09:30', rite: 'ord' as const, lang: 'česky', massDate: '2026-07-05' }
const MASS: CardMass = {
  churchId: 'c1',
  massKey: 'c1|w7|09:30|ord|česky',
  churchName: 'kostel sv. Havla',
  type: 'mše sv.',
  ...OCC,
}

const setup = () => {
  const onSubmit = vi.fn()
  const onDismiss = vi.fn()
  const onNeverAsk = vi.fn()
  render(<AfterMassCard entry={MASS} onSubmit={onSubmit} onDismiss={onDismiss} onNeverAsk={onNeverAsk} />)
  return { onSubmit, onDismiss, onNeverAsk, user: userEvent.setup() }
}

afterEach(() => localStorage.clear())

describe('AfterMassCard', () => {
  it('asks about the mass and offers a witness, dismiss, and never-ask', () => {
    setup()
    expect(screen.getByText('Byli jste na této mši?')).toBeVisible()
    expect(screen.getByTestId('fb-mass-name')).toHaveTextContent('kostel sv. Havla')
    expect(screen.getByRole('button', { name: 'Ano, byl/a jsem' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Teď ne' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Neptat se' })).toBeVisible()
    // no chips before the pilgrim confirms attendance
    expect(screen.queryByRole('button', { name: 'hluboký prožitek' })).toBeNull()
  })

  it('"Ano" records the witness immediately, then reveals optional chips', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ano, byl/a jsem' }))
    expect(onSubmit).toHaveBeenCalledWith({ churchId: 'c1', massKey: 'c1|w7|09:30|ord|česky', chips: [], ...OCC })
    expect(screen.getByRole('button', { name: 'hluboký prožitek' })).toBeVisible()
  })

  it('saves chosen chips, then thanks the pilgrim', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ano, byl/a jsem' }))
    await user.click(screen.getByRole('button', { name: 'hluboký prožitek' }))
    await user.click(screen.getByRole('button', { name: 'krásný zpěv' }))
    await user.click(screen.getByRole('button', { name: 'Uložit' }))

    expect(onSubmit).toHaveBeenLastCalledWith({
      churchId: 'c1',
      massKey: 'c1|w7|09:30|ord|česky',
      chips: ['hluboky_prozitek', 'krasny_zpev'],
      ...OCC,
    })
    expect(screen.getByText('Díky. Zapsáno pro další poutníky.')).toBeVisible()
  })

  it('routes a suggested tag privately (never published)', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ano, byl/a jsem' }))
    await user.click(screen.getByRole('button', { name: 'navrhnout štítek' }))
    await user.type(screen.getByLabelText('navrhnout štítek'), 'tichá adorace po mši')
    await user.click(screen.getByRole('button', { name: 'Uložit' }))
    const list = JSON.parse(localStorage.getItem('bohosluzby:tagSuggestions')!)
    expect(list[0].text).toBe('tichá adorace po mši')
  })

  it('"Teď ne" dismisses and "Neptat se" silences future cards', async () => {
    const { onDismiss, onNeverAsk, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Neptat se' }))
    expect(onNeverAsk).toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('never shows a star, score, or emoji', () => {
    const { container } = render(
      <AfterMassCard entry={MASS} onSubmit={vi.fn()} onDismiss={vi.fn()} onNeverAsk={vi.fn()} />,
    )
    expect(container.textContent).not.toMatch(/[★☆⭐0-9]\s*\/\s*[0-9]/)
    expect(container.querySelector('svg')).toBeNull()
  })
})
