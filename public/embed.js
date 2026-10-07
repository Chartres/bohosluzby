/*! Kam na mši — nejbližší bohoslužby na webu farnosti. https://bohosluzby.dravec.org
 *
 * Vložení:
 *   <div data-kam-na-msi="ID-KOSTELA"><a href="https://bohosluzby.dravec.org/kostel/ID-KOSTELA/">Pořad bohoslužeb</a></div>
 *   <script src="https://bohosluzby.dravec.org/embed.js" async></script>
 *
 * Bez cookies, bez sledování: skript jen stáhne statický soubor s pořadem
 * (embed/ID.json) a vypíše nejbližší bohoslužby. Když se cokoli nepovede,
 * zůstane na stránce původní odkaz. Plain script: no build step, no
 * dependencies, no regex lookbehind (old iPhones parse it too).
 */
;(function () {
  'use strict'
  var SITE = 'https://bohosluzby.dravec.org'
  var WEEKDAY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'] // getUTCDay order
  var DAY_MS = 86400000

  var scriptOrigin = (function () {
    try {
      var src = document.currentScript && document.currentScript.src
      return src ? new URL(src).origin : SITE
    } catch (e) {
      return SITE
    }
  })()

  /** Prague wall clock: date parts + minutes since midnight. */
  function pragueNow(now) {
    var p = {}
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .forEach(function (x) {
        p[x.type] = x.value
      })
    return { y: +p.year, m: +p.month, d: +p.day, min: +p.hour * 60 + +p.minute }
  }

  function minutes(hhmm) {
    var parts = String(hhmm).split(':')
    return +parts[0] * 60 + +parts[1]
  }

  /** The next `n` services from now (Prague time), over the coming week. */
  function nextServices(data, now, n) {
    var w = pragueNow(now)
    var base = Date.UTC(w.y, w.m - 1, w.d)
    var out = []
    for (var off = 0; off < 8; off++) {
      var day = new Date(base + off * DAY_MS)
      var dow = day.getUTCDay()
      var iso = String(dow === 0 ? 7 : dow)
      var key = day.toISOString().slice(0, 10)
      var label = off === 0 ? 'dnes' : off === 1 ? 'zítra' : WEEKDAY[dow]
      var rows = []
      // a note-limited row carries the app's verdict per day (r[5], from data.from);
      // outside the mask's range fall back to the weekday
      var idx = data.from ? Math.round((day.getTime() - Date.parse(data.from + 'T00:00:00Z')) / DAY_MS) : -1
      ;(data.s || []).forEach(function (r) {
        if (String(r[0]).indexOf(iso) === -1) return
        if (r[5] && idx >= 0 && idx < r[5].length && r[5].charAt(idx) !== '1') return
        rows.push(r)
      })
      ;(data.x || []).forEach(function (r) {
        if (r[0] === key) rows.push(r)
      })
      rows.forEach(function (r) {
        var min = minutes(r[1])
        if (isNaN(min) || (off === 0 && min < w.min)) return
        out.push({ off: off, min: min, label: label, time: r[1], lang: r[2], type: r[3], note: r[4] })
      })
    }
    out.sort(function (a, b) {
      return a.off - b.off || a.min - b.min
    })
    return out.slice(0, n)
  }

  function el(tag, style, text) {
    var e = document.createElement(tag)
    if (style) e.setAttribute('style', style)
    if (text != null) e.textContent = text // never innerHTML: registry text is third-party
    return e
  }

  function render(target, data, now) {
    var box = el('div', 'font:inherit;line-height:1.4;border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:12px 14px;max-width:28em')
    box.appendChild(el('p', 'margin:0 0 6px;font-weight:600', 'Nejbližší bohoslužby — ' + data.name))
    var list = el('ul', 'margin:0;padding:0;list-style:none')
    var next = nextServices(data, now, 3)
    if (next.length === 0) list.appendChild(el('li', 'margin:2px 0', 'V příštím týdnu bez pravidelné bohoslužby.'))
    next.forEach(function (s) {
      var li = el('li', 'margin:2px 0')
      li.appendChild(el('strong', 'font-variant-numeric:tabular-nums', s.label + ' ' + s.time))
      var rest = ' ' + s.type + (s.lang && s.lang !== 'česky' ? ' (' + s.lang + ')' : '') + (s.note ? ' — ' + s.note : '')
      li.appendChild(document.createTextNode(rest))
      list.appendChild(li)
    })
    box.appendChild(list)
    var host = ''
    try {
      host = location.hostname
    } catch (e) {}
    var a = el('a', 'display:inline-block;margin-top:8px', 'Celý pořad a kostely v okolí → Kam na mši')
    a.href =
      data.url +
      '?utm_source=embed&utm_medium=farnost&utm_campaign=' +
      encodeURIComponent(host || 'unknown')
    a.target = '_blank'
    a.rel = 'noopener'
    box.appendChild(a)
    if (data.updated)
      box.appendChild(el('p', 'margin:6px 0 0;font-size:.8em;opacity:.7', 'Rejstřík ČBK, aktualizace ' + data.updated.split('-').reverse().map(Number).join('. ')))
    target.textContent = ''
    target.appendChild(box)
  }

  function init(root) {
    var nodes = (root || document).querySelectorAll('[data-kam-na-msi]')
    var jobs = []
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute('data-kam-na-msi-done')) return
      node.setAttribute('data-kam-na-msi-done', '1')
      var id = encodeURIComponent(node.getAttribute('data-kam-na-msi') || '')
      jobs.push(
        fetch(scriptOrigin + '/embed/' + id + '.json')
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.json()
          })
          .then(function (data) {
            render(node, data, new Date())
          })
          .catch(function () {
            /* keep the parish's fallback link */
          }),
      )
    })
    return Promise.all(jobs).then(function () {})
  }

  window.KamNaMsi = { nextServices: nextServices, render: render, init: init }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init() })
  else init()
})()
