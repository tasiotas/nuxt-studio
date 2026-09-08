import { property } from '@nuxt/content'
import { z } from 'zod'
import { mediaEditor } from 'nuxt-studio/schema'

export const schema = z.object({
  document: property(z.url()).editor(mediaEditor({ accept: ['application/pdf'], label: 'PDF file' })),
  image: property(z.string()).editor({ input: 'media' }),
  mixed: property(z.string()).editor(mediaEditor({ accept: ['image/*', 'application/pdf'] })),
})

// @ts-expect-error Unsupported media types must be caught in the consuming app.
mediaEditor({ accept: ['application/zip'] })
