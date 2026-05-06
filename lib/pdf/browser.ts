import type { Browser } from 'puppeteer-core'

/**
 * Launch a Puppeteer browser instance.
 *
 * • Development  → uses your local Google Chrome (set CHROME_EXECUTABLE_PATH
 *                  if Chrome is not at the default macOS/Linux path)
 * • Production   → uses @sparticuz/chromium-min, which downloads a Vercel-
 *                  compatible Chromium binary from GitHub Releases into /tmp.
 *                  Set CHROMIUM_PACK_URL to override the download source.
 */
export async function getBrowser(): Promise<Browser> {
  // Require at runtime so webpack does not try to bundle native binaries.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer-core')

  if (process.env.NODE_ENV === 'development') {
    const executablePath =
      process.env.CHROME_EXECUTABLE_PATH ??
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }) as Promise<Browser>
  }

  // ── Production (Vercel / Lambda) ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chromium = require('@sparticuz/chromium-min')

  const packUrl =
    process.env.CHROMIUM_PACK_URL ??
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

  const executablePath = await chromium.executablePath(packUrl)

  return puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless:        chromium.headless,
  }) as Promise<Browser>
}
