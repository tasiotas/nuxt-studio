import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { property } from '@nuxt/content'
import type { Draft07 } from '@nuxt/content'
import { z } from 'zod'
import { mediaEditor } from '../../../../module/src/schema'
import { acceptsMedia } from '../../../src/utils/mediaPicker'
import { buildFormTreeFromSchema } from '../../../src/utils/form'

describe('media editor metadata', () => {
  it('keeps existing fields image-only and supports explicit PDF and mixed modes', () => {
    expect(acceptsMedia('photo.JPG')).toBe(true)
    expect(acceptsMedia('guide.pdf')).toBe(false)
    expect(acceptsMedia('guide.PDF', ['application/pdf'])).toBe(true)
    expect(acceptsMedia('guide.pdf', ['application/pdf'])).toBe(true)
    expect(acceptsMedia('photo.png', ['application/pdf'])).toBe(false)
    expect(acceptsMedia('video.mp4', ['application/pdf'])).toBe(false)
    expect(acceptsMedia('guide.pdf', ['image/*', 'application/pdf'])).toBe(true)
    expect(acceptsMedia('photo.png', [])).toBe(false)
  })

  it('preserves typed property metadata through Nuxt Content serialization and Studio conversion', async () => {
    const schema = z.object({
      document: property(z.url()).editor(mediaEditor({ accept: ['application/pdf'], label: 'PDF file' })),
      image: property(z.string()).editor({ input: 'media' }),
    })
    // Use the installed Content serializer rather than mimicking its metadata
    // override. This internal path is intentionally tested for compatibility.
    const require = createRequire(import.meta.url)
    const serializerUrl = pathToFileURL(join(dirname(require.resolve('@nuxt/content')), 'chunks/zod4.mjs')).href
    const { toJSONSchema } = await import(/* @vite-ignore */ serializerUrl) as {
      toJSONSchema: (schema: unknown, name: string) => Draft07
    }
    const serialized: Draft07 = JSON.parse(JSON.stringify(toJSONSchema(schema, 'files')))
    const form = buildFormTreeFromSchema('files', serialized)
    const document = form.files.children?.document
    expect(document?.type).toBe('media')
    expect(document?.accept).toEqual(['application/pdf'])
    expect(document?.label).toBe('PDF file')
    expect(form.files.children?.image.accept).toBeUndefined()
  })
})
