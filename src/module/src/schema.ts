import type { EditorOptions } from '@nuxt/content'

export type MediaAccept = 'image/*' | 'application/pdf'

export type MediaEditorOptions = Omit<EditorOptions, 'input'> & {
  /** Omit to keep the image-only picker. An empty array accepts no library files. */
  accept?: MediaAccept[]
}

/** Typed media metadata for Nuxt Content's property(...).editor(). */
export function mediaEditor(options: MediaEditorOptions = {}): MediaEditorOptions & { input: 'media' } {
  return { ...options, input: 'media' }
}
