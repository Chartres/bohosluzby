import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackCard } from './FeedbackCard'

const feedback = vi.fn()
vi.mock('./analytics', () => ({ feedback: (...a: unknown[]) => feedback(...a) }))

describe('FeedbackCard', () => {
  beforeEach(() => feedback.mockClear())

  it('is collapsed until opened, then sends Sean Ellis + text and thanks', async () => {
    const user = userEvent.setup()
    render(<FeedbackCard />)

    // collapsed: one quiet line, no send button
    expect(screen.queryByRole('button', { name: 'Odeslat' })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Napište nám/ }))
    expect(screen.getByRole('button', { name: 'Odeslat' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Hodně by mi chyběla' }))
    await user.type(screen.getByRole('textbox'), 'chybí Brno-venkov')
    await user.click(screen.getByRole('button', { name: 'Odeslat' }))

    expect(feedback).toHaveBeenCalledWith({
      sean_ellis: 'very',
      text: '[footer] chybí Brno-venkov',
    })
    expect(screen.getByText(/Díky/)).toBeVisible()
  })

  it('tells the reader schedule corrections are forwarded to the parish/registry', async () => {
    const user = userEvent.setup()
    render(<FeedbackCard />)

    await user.click(screen.getByRole('button', { name: /Napište nám/ }))
    expect(screen.getByText(/farnosti/)).toBeVisible()
    expect(screen.getByText(/evidenci/)).toBeVisible()

    await user.type(screen.getByRole('textbox'), 'chybí Brno-venkov')
    await user.click(screen.getByRole('button', { name: 'Odeslat' }))
    expect(screen.getByText(/farnosti/)).toBeVisible()
  })
})
