// The detail crawl may skip a church that is really gone (404/410) or whose
// body isn't JSON. Anything else — a 5xx or timeout after retries, a 429/403
// from a WAF — must abort, so the old data stays: a skipped id silently drops
// out of churches.json, and the 90% gate downstream lets ~400 of them through.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { details } from './extract.mjs'

const httpErr = (status) => Object.assign(new Error(`HTTP ${status}`), { status })

function crawl(ids, failing, err) {
  const dir = mkdtempSync(`${tmpdir()}/extract-test-`)
  const fetchText = async (url) => {
    if (failing.some((id) => url.endsWith(`id=${id}`))) {
      if (typeof err === 'string') return err
      throw err
    }
    return '{"id":1}'
  }
  return { dir, done: details(ids, { fetchText, dir }) }
}

beforeEach(() => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('details', () => {
  it.each([503, 429, 403])('HTTP %i on one church aborts the crawl', async (status) => {
    await expect(crawl(['1', '2', '3'], ['2'], httpErr(status)).done).rejects.toThrow(`HTTP ${status}`)
  })

  it('a timeout aborts the crawl', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
    await expect(crawl(['1', '2', '3'], ['2'], timeout).done).rejects.toThrow(/timeout/)
  })

  it.each([404, 410])('HTTP %i skips only that church', async (status) => {
    const { dir, done } = crawl(['1', '2', '3'], ['2'], httpErr(status))
    expect(await done).toEqual(['2'])
    expect(['1', '2', '3'].map((id) => existsSync(`${dir}/${id}.json`))).toEqual([true, false, true])
  })

  it('a body that is not JSON skips only that church', async () => {
    const { dir, done } = crawl(['1', '2'], ['1'], '<html>maintenance</html>')
    expect(await done).toEqual(['1'])
    expect(existsSync(`${dir}/2.json`)).toBe(true)
  })

  it('more skips than the cap aborts (a WAF answering 200 with HTML)', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => String(i + 1))
    await expect(crawl(ids, ids, '<html>challenge</html>').done).rejects.toThrow(/skipped/)
  })
})
