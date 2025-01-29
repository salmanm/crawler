import { writeFileSync } from 'fs'
import axios, { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'

interface CrawlResult {
  url: string
  httpCode: number
  redirectsTo?: string
  referer?: string
}

const domainToCrawl = 'webview.hse.ie'
// const domainToCrawl = '192.168.29.110'

const crawlWebsite = async (baseUrl: string, userAgent: string): Promise<CrawlResult[]> => {
  const visited = new Set<string>()
  const results: CrawlResult[] = []
  const queue: string[] = [baseUrl]

  const customAxios = axios.create({
    headers: { 'User-Agent': userAgent, 'accept-language': 'en-US,en;q=0.9' },
    maxRedirects: 0, // To capture redirection URLs
    validateStatus: () => true, // Handle all status codes
  })

  const isHtml = (response: AxiosResponse) => {
    const type = response.headers['Content-Type'] || response.headers['content-type']
    if (Array.isArray(type)) {
      return type.some(t => t.includes('text/html'))
    }

    return type.includes('text/html')
  }

  const sanitize = (href: string, currentUrl: string) => {
    const url = new URL(href, currentUrl)
    url.hash = ''
    return url.toString().replace(/\/\?page=\d+&?/, '/?')
  }

  const isInternalLink = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.endsWith('hse.ie')
    } catch {
      return false
    }
  }

  while (queue.length > 0) {
    const currentUrl = queue.shift()!
    console.log('Remaining in queue:', queue.length)

    if (visited.has(currentUrl)) continue

    visited.add(currentUrl)

    try {
      const response = await customAxios.get(currentUrl)
      console.log(`Fetched ${currentUrl}: ${response.status}`)

      const result: CrawlResult = {
        url: currentUrl,
        httpCode: response.status,
      }

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, currentUrl).toString()
        result.redirectsTo = redirectUrl
        result.referer = currentUrl

        if (isInternalLink(redirectUrl) && !visited.has(redirectUrl)) {
          queue.push(redirectUrl)
          console.log('Adding to queue:', redirectUrl)
        }
      } else if (response.status === 200 && isHtml(response) && currentUrl.startsWith(baseUrl)) {
        const $ = cheerio.load(response.data)

        $('a').each((_index, element) => {
          const href = $(element).attr('href')

          if (href) {
            const absoluteUrl = sanitize(href, currentUrl)
            if (isInternalLink(absoluteUrl) && !visited.has(absoluteUrl)) {
              if (queue.indexOf(absoluteUrl) === -1) {
                queue.push(absoluteUrl)
                console.log('Adding to queue:', absoluteUrl)
              }
            }
          }
        })
      }

      results.push(result)
    } catch (error) {
      console.error(`Failed to fetch ${currentUrl}:`, error.message)
    }
  }

  return results
}

;(async () => {
  const baseUrl = `https://${domainToCrawl}`
  const userAgent = 'hseapp'

  const results = await crawlWebsite(baseUrl, userAgent)

  console.log('Crawl Results:')
  console.table(results)
  writeFileSync('results.json', JSON.stringify(results, null, 2))
})()
