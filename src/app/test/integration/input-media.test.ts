// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { z } from 'zod'
import type { FormItem, TreeItem } from '../../src/types'
import InputMedia from '../../src/components/form/input/InputMedia.vue'
import { getMediaThumbnailUrl } from '../../src/utils/media'

const mocks = vi.hoisted(() => ({
  root: [] as TreeItem[],
  external: false,
  get: vi.fn(),
  image: vi.fn(),
}))
vi.mock('../../src/composables/useStudio', async () => {
  const { ref } = await import('vue')
  return { useStudio: () => ({
    mediaTree: { root: ref(mocks.root) },
    host: { meta: { media: { external: mocks.external } }, media: { get: mocks.get } },
  }) }
})
vi.mock('@unpic/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { Image: defineComponent({
    props: ['src'],
    setup: props => () => {
      mocks.image(props.src)
      return h('img', { src: props.src })
    },
  }) }
})

type PickerState = {
  mediaFiles: TreeItem[]
  search: string
  popoverOpen: boolean
  selectionError: string
  selectMedia: (media: TreeItem) => Promise<void>
}
const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup.splice(0).forEach(fn => fn())
  vi.clearAllMocks()
})
const file = (name: string, routePath?: string): TreeItem => ({ name, fsPath: `documents/${name}`, routePath, type: 'file', prefix: null })

function mountPicker(accept?: FormItem['accept'], external = false, initialValue = '') {
  mocks.root = [file('photo.png'), file('guide.pdf'), file('MANUAL.PDF')]
  mocks.external = external
  const model = ref(initialValue)
  const picker = ref<ComponentPublicInstance>()
  const formItem: FormItem = { id: '#asset', title: 'Asset', type: 'media', accept }
  const app = createApp(defineComponent({ setup: () => () => h(InputMedia, {
    'ref': picker, formItem, 'modelValue': model.value, 'onUpdate:modelValue': (value: string) => { model.value = value },
  }) }))
  app.config.globalProperties.$t = (key: string) => key
  const stub = defineComponent({ setup: (_, { slots }) => () => h('div', [
    ...(slots.default?.() || []), ...(slots.trailing?.() || []), ...(slots.content?.() || []),
  ]) })
  for (const name of ['UPopover', 'UTooltip', 'UButton', 'UIcon']) app.component(name, stub)
  app.component('UInput', defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: (props, { slots, emit }) => () => h('div', [
      h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }),
      ...(slots.trailing?.() || []),
    ]),
  }))
  const container = document.createElement('div')
  app.mount(container)
  cleanup.push(() => app.unmount())
  return { container, model, state: (picker.value!.$ as unknown as { setupState: PickerState }).setupState }
}

describe('schema media picker', () => {
  it('defaults to images only', () => {
    const { state } = mountPicker()
    expect(state.mediaFiles.map(file => file.name)).toEqual(['photo.png'])
    expect(mocks.image).toHaveBeenCalledWith(getMediaThumbnailUrl('documents/photo.png'))
  })

  it.each([
    '/printables/Download-on-the-App-Store-Badge.svg',
    'https://cdn.example.com/site-assets/photo.png',
  ])('uses Media tab thumbnail resolution for grid and selected preview: %s', async (url) => {
    const { state, container, model } = mountPicker(undefined, false, url)
    state.mediaFiles[0].routePath = url
    await nextTick()
    expect(Array.from(container.querySelectorAll('img'), image => image.getAttribute('src')))
      .toEqual([getMediaThumbnailUrl(url), getMediaThumbnailUrl(url)])
    await state.selectMedia(state.mediaFiles[0])
    expect(model.value).toBe(url)
    expect(model.value).not.toContain('/__nuxt_studio/ipx/')
  })

  it('resolves the actual external image URL for saving and uses IPX only for its preview', async () => {
    const url = 'https://cdn.example.com/storage-prefix/documents/photo.png'
    mocks.get.mockResolvedValue({ path: url })
    const { state, model, container } = mountPicker(undefined, true)
    await state.selectMedia(state.mediaFiles[0])
    await nextTick()
    expect(model.value).toBe(url)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(getMediaThumbnailUrl(url))
    expect(mocks.get).toHaveBeenCalledWith('documents/photo.png')
  })

  it('renders lowercase and uppercase PDFs with filenames and no image processing', () => {
    const { state, container } = mountPicker(['application/pdf'], false, 'https://cdn.example.com/MANUAL.PDF?download=1')
    expect(state.mediaFiles.map(file => file.name)).toEqual(['guide.pdf', 'MANUAL.PDF'])
    expect(container.textContent).toContain('guide.pdf')
    expect(container.textContent).toContain('MANUAL.PDF')
    expect(container.innerHTML).toContain('i-lucide-file-text')
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('MANUAL.PDF')
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.image).not.toHaveBeenCalled()
    expect(container.innerHTML).not.toContain('/ipx')
  })

  it('preserves search, empty states, and selection reset', async () => {
    const { state, model, container } = mountPicker(['application/pdf'])
    state.search = 'manual'
    state.popoverOpen = true
    await nextTick()
    expect(state.mediaFiles.map(file => file.name)).toEqual(['MANUAL.PDF'])
    await state.selectMedia(state.mediaFiles[0])
    expect(model.value).toBe('documents/MANUAL.PDF')
    expect(state.search).toBe('')
    expect(state.popoverOpen).toBe(false)
    state.search = 'missing'
    await nextTick()
    expect(container.textContent).toContain('noFilesFound')
    expect(container.textContent).not.toContain('noImagesFound')
  })

  it('retrieves and saves the complete external URL including storage prefix', async () => {
    const url = 'https://cdn.example.com/site-assets/documents/guide.pdf'
    mocks.get.mockResolvedValue({ path: url })
    const { state, model } = mountPicker(['application/pdf'], true)
    state.mediaFiles[0].routePath = '/documents/guide.pdf'
    await state.selectMedia(state.mediaFiles[0])
    expect(mocks.get).toHaveBeenCalledWith('documents/guide.pdf')
    expect(model.value).toBe(url)
    expect(z.url().parse(model.value)).toBe(url)
  })

  it('preserves an existing public URL without reconstructing it', async () => {
    const { state, model } = mountPicker(['application/pdf'], true)
    const url = 'https://cdn.example.com/prefix/MANUAL.PDF'
    await state.selectMedia(file('MANUAL.PDF', url))
    expect(model.value).toBe(url)
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('does not save a relative path when external URL resolution fails', async () => {
    mocks.get.mockResolvedValue({ path: '/guide.pdf' })
    const { state, model } = mountPicker(['application/pdf'], true, 'https://cdn.example.com/old.pdf')
    await state.selectMedia(state.mediaFiles[0])
    expect(model.value).toBe('https://cdn.example.com/old.pdf')
    expect(state.selectionError).toContain('no public URL')
  })

  it('keeps manual URL entry available', async () => {
    const { container, model } = mountPicker(['application/pdf'])
    const input = container.querySelector('input')!
    input.value = 'https://other.example.com/file.pdf'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(model.value).toBe(input.value)
  })
})
