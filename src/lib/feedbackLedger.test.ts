import {
  DUE_AFTER_MIN,
  dueCards,
  markAnswered,
  neverAsk,
  recordExpectedAttendance,
} from './feedbackLedger'

const NOW = new Date('2026-07-06T12:00:00Z')
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()

const entry = (massKey: string, startISO: string) => ({
  churchId: 'c1',
  massKey,
  startISO,
  churchName: 'kostel sv. Havla',
  time: '10:30',
  type: 'mše sv.',
})

afterEach(() => localStorage.clear())

describe('due-card eligibility timing', () => {
  it('shows a mass only once DUE_AFTER_MIN has elapsed', () => {
    recordExpectedAttendance(entry('a', minsAgo(DUE_AFTER_MIN - 1))) // 59 min ago
    recordExpectedAttendance(entry('b', minsAgo(DUE_AFTER_MIN + 1))) // 61 min ago
    const due = dueCards(NOW)
    expect(due.map((e) => e.massKey)).toEqual(['b'])
  })

  it('never shows a mass that has not started yet', () => {
    recordExpectedAttendance(entry('future', new Date(NOW.getTime() + 3_600_000).toISOString()))
    expect(dueCards(NOW)).toEqual([])
  })

  it('orders due cards soonest-first', () => {
    recordExpectedAttendance(entry('later', minsAgo(70)))
    recordExpectedAttendance(entry('older', minsAgo(200)))
    expect(dueCards(NOW).map((e) => e.massKey)).toEqual(['older', 'later'])
  })
})

describe('one entry per mass', () => {
  it('ignores a second record for the same massKey', () => {
    recordExpectedAttendance(entry('a', minsAgo(90)))
    recordExpectedAttendance(entry('a', minsAgo(30))) // duplicate — ignored
    expect(dueCards(NOW)).toHaveLength(1)
    expect(dueCards(NOW)[0].startISO).toBe(minsAgo(90)) // first write wins
  })
})

describe('answering and never-ask', () => {
  it('drops a mass from due once answered', () => {
    recordExpectedAttendance(entry('a', minsAgo(90)))
    markAnswered('a')
    expect(dueCards(NOW)).toEqual([])
  })

  it('never-ask silences every card globally', () => {
    recordExpectedAttendance(entry('a', minsAgo(90)))
    recordExpectedAttendance(entry('b', minsAgo(120)))
    neverAsk()
    expect(dueCards(NOW)).toEqual([])
  })
})
