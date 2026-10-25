import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '@nuxtjs/mdc/runtime/parser/index'
import { compressTree } from '@nuxt/content/runtime'
import type { MarkdownDocument } from 'comark'
import type { DatabaseItem } from 'nuxt-studio/app'
import { documentFromMarkdownContent, ensureComarkBody, isDocumentMatchingContent } from '../../src/runtime/utils/document'

const id = 'docs/article.md'

function article(attrs: string, nested = false, tag = 'blog-image') {
  const image = `${nested ? ':::' : '::'}${tag}\n---\n${attrs}\n---\n${nested ? ':::' : '::'}`
  return `Article text.\n\n${nested ? `::wrapper\n${image}\n::` : image}\n`
}

async function deployedDocument(content: string): Promise<DatabaseItem> {
  const parsed = await parseMarkdown(content, { highlight: false })
  return { id, extension: 'md', stem: 'article', meta: {}, body: compressTree(parsed.body) } as DatabaseItem
}

const deployed = 'src: /photo.jpg\nwidth: 1920\nheight: 1080'

describe('MDC deployed content compared with Studio content', () => {
  it.each([
    [':height: \'1080\'\n:width: \'1920\'\nsrc: /photo.jpg', false],
    ['height: \'1080\'\nwidth: \'1920\'\nsrc: /photo.jpg', false],
    ['height: 1080\nwidth: 1920\nsrc: /photo.jpg', false],
    [':height: \'1080\'\n:width: \'1920\'\nsrc: /photo.jpg', true],
    ['height: \'1080\'\nwidth: \'1920\'\nsrc: /photo.jpg', true],
    ['height: 1080\nwidth: 1920\nsrc: /photo.jpg', true],
  ])('matches equivalent numeric dimensions and reordered attributes: %s (nested: %s)', async (attrs, nested) => {
    const content = article(attrs, nested)
    const document = await deployedDocument(article(deployed, nested))
    const before = structuredClone(document)
    const studio = await documentFromMarkdownContent(id, content)
    const studioBefore = structuredClone(studio)

    await expect(isDocumentMatchingContent(content, document)).resolves.toBe(true)
    await expect(isDocumentMatchingContent(content, studio)).resolves.toBe(true)
    expect(document).toEqual(before)
    expect(studio).toEqual(studioBefore)
  })

  it('exercises the actual parser scalar mismatch for plain numeric YAML', async () => {
    const content = article(deployed)
    const studio = await documentFromMarkdownContent(id, content)
    const mdc = await parseMarkdown(content, { highlight: false })
    expect((studio.body as MarkdownDocument).nodes[1]).toEqual(['blog-image', { src: '/photo.jpg', width: '1920', height: '1080' }])
    expect(mdc.body.children[1]).toMatchObject({ tag: 'blog-image', props: { 'src': '/photo.jpg', ':width': '1920', ':height': '1080' } })
    const stored = ensureComarkBody(await deployedDocument(content))
    expect((stored.body as MarkdownDocument).nodes[1]).toEqual(['blog-image', { src: '/photo.jpg', width: 1920, height: 1080 }])
    const before = structuredClone(stored)
    await expect(isDocumentMatchingContent(content, stored)).resolves.toBe(true)
    expect(stored).toEqual(before)
  })

  it.each([
    [':width: \'1921\'\n:height: \'1080\'\nsrc: /photo.jpg', 'Article text.'],
    [':width: \'1920\'\n:height: \'1081\'\nsrc: /photo.jpg', 'Article text.'],
    [':width: \'1920\'\n:height: \'1080\'\nsrc: /other.jpg', 'Article text.'],
    [':width: \'1920\'\n:height: \'1080\'\nsrc: /photo.jpg', 'Changed article.'],
  ])('detects changed dimensions, URLs and text: %s %s', async (attrs, text) => {
    for (const nested of [false, true]) {
      const document = await deployedDocument(article(deployed, nested))
      await expect(isDocumentMatchingContent(article(attrs, nested).replace('Article text.', text), document)).resolves.toBe(false)
    }
  })

  it.each([
    [':width: image.width', 'width: image.width'],
    [':width: \'true\'', 'width: \'true\''],
    [':width: \'false\'', 'width: \'false\''],
    [':width: \'1920 + 0\'', 'width: 1920'],
    [':width: \'\' ', 'width: 0'],
    [':height: \'null\'', 'height: 0'],
    [':quality: \'80\'', 'quality: 80'],
    [':lazy: \'true\'', 'lazy: \'true\''],
  ])('preserves other bindings: %s', async (source, stored) => {
    const document = await deployedDocument(article(stored))
    const before = structuredClone(document)
    await expect(isDocumentMatchingContent(article(source), document)).resolves.toBe(false)
    expect(document).toEqual(before)
  })

  it('does not normalize dimensions on other components', async () => {
    const document = await deployedDocument(article(deployed, false, 'other-image'))
    await expect(isDocumentMatchingContent(article(':width: \'1920\'\n:height: \'1080\'\nsrc: /photo.jpg', false, 'other-image'), document)).resolves.toBe(false)
  })
})
