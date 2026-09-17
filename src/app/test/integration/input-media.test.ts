// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type ComponentPublicInstance } from 'vue'
import { z } from 'zod'
import type { FormItem, FormTree, ImageMediaSelection, TreeItem } from '../../src/types'
import FormInput from '../../src/components/form/FormInput.vue'
import InputMedia from '../../src/components/form/input/InputMedia.vue'
import InputText from '../../src/components/form/input/InputText.vue'
import InputWrapper from '../../src/components/form/input/InputWrapper.vue'
import TiptapExtensionImagePicker from '../../src/components/tiptap/extension/TiptapExtensionImagePicker.vue'
import TiptapExtensionVideoPicker from '../../src/components/tiptap/extension/TiptapExtensionVideoPicker.vue'
import { getMediaFullUrl, getMediaThumbnailUrl } from '../../src/utils/media'

type PendingImage = {
  naturalWidth: number
  naturalHeight: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

const pendingImages: Array<{ src: string, image: PendingImage }> = []
let imageLoadMode: 'success' | 'error' | 'deferred' = 'success'
let intrinsicDimensions = { width: 1588, height: 2048 }

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
vi.mock('@tiptap/vue-3', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NodeViewWrapper: defineComponent({
      setup: (_, { slots }) => () => h('div', slots.default?.()),
    }),
  }
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
type TextPickerState = {
  isMediaPickerOpen: boolean
  mediaSelectionError: string
  handleMediaSelect: (media: TreeItem | null) => Promise<void>
}
type NodePickerState = {
  isOpen: boolean
  selectionError: string
  handleImageSelect?: (media: TreeItem | null) => Promise<void>
  handleVideoSelect?: (media: TreeItem | null) => Promise<void>
}
const cleanup: (() => void)[] = []
beforeEach(() => {
  imageLoadMode = 'success'
  intrinsicDimensions = { width: 1588, height: 2048 }
  pendingImages.splice(0)
  vi.stubGlobal('Image', class {
    naturalWidth = 0
    naturalHeight = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    set src(src: string) {
      const image = this as PendingImage
      image.naturalWidth = intrinsicDimensions.width
      image.naturalHeight = intrinsicDimensions.height
      pendingImages.push({ src, image })
      if (imageLoadMode === 'success') queueMicrotask(() => image.onload?.())
      if (imageLoadMode === 'error') queueMicrotask(() => image.onerror?.())
    }
  })
})
afterEach(() => {
  cleanup.splice(0).forEach(fn => fn())
  vi.clearAllMocks()
  vi.unstubAllGlobals()
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

function mountTextPicker(external = false, initialValue = '') {
  mocks.external = external
  const model = ref<string | number>(initialValue)
  const picker = ref<ComponentPublicInstance>()
  const selections: ImageMediaSelection[] = []
  const formItem = { id: 'BlogFigure/src', key: 'src', title: 'Source', type: 'string' } as FormItem
  const app = createApp(defineComponent({ setup: () => () => h(InputText, {
    'ref': picker,
    formItem,
    'modelValue': model.value,
    'onUpdate:modelValue': (value: string | number) => { model.value = value },
    'onImageSelected': (selection: ImageMediaSelection) => selections.push(selection),
  }) }))
  app.config.globalProperties.$t = (key: string) => key
  const stub = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['UInput', 'UTooltip', 'UButton', 'ModalMediaPicker']) app.component(name, stub)
  const container = document.createElement('div')
  app.mount(container)
  cleanup.push(() => app.unmount())
  return { model, selections, state: (picker.value!.$ as unknown as { setupState: TextPickerState }).setupState }
}

function mountComponentImageForm(media: TreeItem, includeDimensions = true) {
  const children: FormTree = {
    src: { id: '#blog-image/src', key: 'src', title: 'Src', type: 'string', value: '' },
  }
  if (includeDimensions) {
    children[':width'] = { id: '#blog-image/:width', key: ':width', title: 'Width', type: 'number', value: undefined }
    children[':height'] = { id: '#blog-image/:height', key: ':height', title: 'Height', type: 'number', value: undefined }
  }

  const form = ref<FormTree>({
    BlogImage: { id: '#blog-image', title: 'BlogImage', type: 'object', children },
  })
  const app = createApp(defineComponent({ setup: () => () => h(FormInput, {
    'formItem': form.value.BlogImage.children!.src,
    'modelValue': form.value,
    'onUpdate:modelValue': (value: FormTree) => { form.value = value },
  }) }))
  app.config.globalProperties.$t = (key: string) => key
  const passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', [
    ...(slots.default?.() || []), ...(slots.trailing?.() || []),
  ]) })
  for (const name of ['UFormField', 'UInput', 'UTooltip', 'UButton', 'UIcon']) app.component(name, passthrough)
  app.component('InputWrapper', InputWrapper)
  app.component('ModalMediaPicker', defineComponent({
    emits: ['select'],
    setup: (_, { emit }) => () => h('button', {
      'data-testid': 'select-component-image',
      'onClick': () => emit('select', media),
    }),
  }))
  const container = document.createElement('div')
  app.mount(container)
  cleanup.push(() => app.unmount())
  return { container, form }
}

function mountNodePicker(component: typeof TiptapExtensionImagePicker | typeof TiptapExtensionVideoPicker) {
  const picker = ref<ComponentPublicInstance>()
  const chain = {
    focus: vi.fn(),
    deleteRange: vi.fn(),
    insertContentAt: vi.fn(),
    run: vi.fn(),
  }
  chain.focus.mockReturnValue(chain)
  chain.deleteRange.mockReturnValue(chain)
  chain.insertContentAt.mockReturnValue(chain)
  const editor = { chain: vi.fn(() => chain) }
  const app = createApp(defineComponent({ setup: () => () => h(component, {
    ref: picker,
    editor,
    getPos: () => 4,
  }) }))
  app.component('ModalMediaPicker', defineComponent({ setup: () => () => h('div') }))
  const container = document.createElement('div')
  app.mount(container)
  cleanup.push(() => app.unmount())
  return {
    chain,
    state: (picker.value!.$ as unknown as { setupState: NodePickerState }).setupState,
  }
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

describe('generic component media picker', () => {
  it('updates a component src and its width/height props from one image selection', async () => {
    const { container, form } = mountComponentImageForm(file('photo.png', '/images/photo.png'))

    const selectButton = container.querySelector('[data-testid="select-component-image"]') as HTMLButtonElement
    selectButton.click()

    await vi.waitFor(() => {
      expect(form.value.BlogImage.children?.src.value).toBe('/images/photo.png')
      expect(form.value.BlogImage.children?.[':width'].value).toBe(1588)
      expect(form.value.BlogImage.children?.[':height'].value).toBe(2048)
    })
  })

  it('leaves components exposing only src unchanged apart from the selected URL', async () => {
    const { container, form } = mountComponentImageForm(file('photo.png', '/images/photo.png'), false)

    const selectButton = container.querySelector('[data-testid="select-component-image"]') as HTMLButtonElement
    selectButton.click()

    await vi.waitFor(() => expect(form.value.BlogImage.children?.src.value).toBe('/images/photo.png'))
    expect(Object.keys(form.value.BlogImage.children || {})).toEqual(['src'])
  })

  it('loads the full selected image and emits its intrinsic dimensions with src', async () => {
    const media = file('photo.png', '/images/photo.png')
    const { model, selections, state } = mountTextPicker(false)

    await state.handleMediaSelect(media)

    expect(pendingImages[0].src).toBe(getMediaFullUrl('/images/photo.png'))
    expect(model.value).toBe('/images/photo.png')
    expect(selections).toEqual([{ src: '/images/photo.png', width: 1588, height: 2048 }])
  })

  it('saves the public URL returned by external media storage', async () => {
    const media = file('photo.png', 'photo.png')
    const url = 'https://cdn.example.com/storage-prefix/documents/photo.png'
    mocks.get.mockResolvedValue({ path: url })
    const { model, state } = mountTextPicker(true)

    await state.handleMediaSelect(media)

    expect(mocks.get).toHaveBeenCalledWith(media.fsPath)
    expect(model.value).toBe(url)
    expect(state.isMediaPickerOpen).toBe(false)
  })

  it.each([
    [file('routed.png', '/images/routed.png'), '/images/routed.png'],
    [file('fallback.png'), 'documents/fallback.png'],
  ])('preserves local media selection behavior', async (media, expected) => {
    const { model, state } = mountTextPicker(false)

    await state.handleMediaSelect(media)

    expect(model.value).toBe(expected)
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('preserves an absolute external route without fetching media metadata', async () => {
    const url = 'https://cdn.example.com/storage-prefix/photo.png'
    const { model, state } = mountTextPicker(true)

    await state.handleMediaSelect(file('photo.png', url))

    expect(model.value).toBe(url)
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('keeps the current value and picker open when external resolution fails', async () => {
    mocks.get.mockResolvedValue({ path: '/relative/photo.png' })
    const { model, state } = mountTextPicker(true, 'https://cdn.example.com/original.png')
    state.isMediaPickerOpen = true

    await state.handleMediaSelect(file('photo.png', 'photo.png'))

    expect(model.value).toBe('https://cdn.example.com/original.png')
    expect(state.isMediaPickerOpen).toBe(true)
    expect(state.mediaSelectionError).toContain('no public URL')
  })

  it('keeps the manual URL option behavior when no media is selected', async () => {
    const { model, state } = mountTextPicker(true, 'https://other.example.com/photo.png')
    state.isMediaPickerOpen = true

    await state.handleMediaSelect(null)

    expect(model.value).toBe('')
    expect(state.isMediaPickerOpen).toBe(false)
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('emits no dimensions when the full image cannot be loaded', async () => {
    imageLoadMode = 'error'
    const { model, selections, state } = mountTextPicker(false, '/images/old.png')

    await state.handleMediaSelect(file('broken.png', '/images/broken.png'))

    expect(model.value).toBe('/images/broken.png')
    expect(selections).toEqual([{ src: '/images/broken.png' }])
  })

  it('does not let dimensions from an earlier selection overwrite the latest selection', async () => {
    imageLoadMode = 'deferred'
    const { model, selections, state } = mountTextPicker(false)

    const firstSelection = state.handleMediaSelect(file('first.png', '/images/first.png'))
    await Promise.resolve()
    const secondSelection = state.handleMediaSelect(file('second.png', '/images/second.png'))
    await Promise.resolve()

    pendingImages[1].image.naturalWidth = 1200
    pendingImages[1].image.naturalHeight = 800
    pendingImages[1].image.onload?.()
    await secondSelection

    pendingImages[0].image.naturalWidth = 400
    pendingImages[0].image.naturalHeight = 300
    pendingImages[0].image.onload?.()
    await firstSelection

    expect(model.value).toBe('/images/second.png')
    expect(selections).toEqual([{ src: '/images/second.png', width: 1200, height: 800 }])
  })
})

describe('rich-text media pickers', () => {
  it('inserts the resolved public image URL', async () => {
    const media = file('photo.png', 'photo.png')
    const url = 'https://cdn.example.com/storage-prefix/documents/photo.png'
    mocks.external = true
    mocks.get.mockResolvedValue({ path: url })
    const { chain, state } = mountNodePicker(TiptapExtensionImagePicker)

    await state.handleImageSelect!(media)

    expect(chain.insertContentAt).toHaveBeenCalledWith(4, {
      type: 'image',
      attrs: { props: { src: url, alt: 'photo.png' } },
    })
    expect(state.isOpen).toBe(false)
  })

  it('inserts the resolved public video URL', async () => {
    const media = file('clip.mp4', 'clip.mp4')
    const url = 'https://cdn.example.com/storage-prefix/documents/clip.mp4'
    mocks.external = true
    mocks.get.mockResolvedValue({ path: url })
    const { chain, state } = mountNodePicker(TiptapExtensionVideoPicker)

    await state.handleVideoSelect!(media)

    expect(chain.insertContentAt).toHaveBeenCalledWith(4, {
      type: 'video',
      attrs: { props: { src: url } },
    })
    expect(state.isOpen).toBe(false)
  })

  it('does not replace the picker node when external resolution fails', async () => {
    mocks.external = true
    mocks.get.mockResolvedValue({ path: '/relative/photo.png' })
    const { chain, state } = mountNodePicker(TiptapExtensionImagePicker)

    await state.handleImageSelect!(file('photo.png', 'photo.png'))

    expect(chain.deleteRange).not.toHaveBeenCalled()
    expect(chain.insertContentAt).not.toHaveBeenCalled()
    expect(chain.run).not.toHaveBeenCalled()
    expect(state.isOpen).toBe(true)
    expect(state.selectionError).toContain('no public URL')
  })
})
