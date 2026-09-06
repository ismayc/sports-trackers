import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The browser chrome states this app's background three times, in three files a
// JS module cannot import: the CSS token the page actually paints, the
// <meta name="theme-color"> the browser tints its UI with, and the manifest the
// installed PWA shows behind its splash. They drifted: the manifest said #12151c
// while the page painted #15171b, so the installed app flashed the wrong dark.
//
// These files are outside every seam by necessity (the manifest is static JSON,
// and index.html's theme script must stay a blocking classic script or the page
// flashes the wrong palette before paint). A test is what keeps them honest.
const ROOT = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

describe('browser chrome agrees with the page', () => {
  // Dark is the family default, so the bare :root block is the dark palette and
  // its --bg is the color the chrome should match.
  const cssBg = read('src/index.css').match(/--bg:\s*(#[0-9a-f]{6})/i)[1].toLowerCase()

  it('tints the browser UI with the color the page paints', () => {
    const meta = read('index.html').match(
      /<meta\s+name="theme-color"\s+content="(#[0-9a-f]{6})"/i,
    )[1]
    expect(meta.toLowerCase()).toBe(cssBg)
  })

  it('shows the same color behind the installed app', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'))
    expect(manifest.theme_color.toLowerCase()).toBe(cssBg)
    expect(manifest.background_color.toLowerCase()).toBe(cssBg)
  })

  it('reads the theme from this repo own storage prefix, not a sibling one', () => {
    // The pre-paint script cannot import src/, so the prefix is a literal here and
    // a literal in App.jsx. guards.test.js checks it is not a SIBLING's prefix;
    // this checks the two copies inside this repo agree with each other.
    const htmlKey = read('index.html').match(/localStorage\.getItem\('([^']+)'\)/)[1]
    expect(htmlKey).toBe('st:theme')
    expect(read('src/App.jsx')).toContain("'st:theme'")
  })
})
