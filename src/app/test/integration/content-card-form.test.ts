// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref, type ComponentPublicInstance, type Ref } from 'vue'
import type { CollectionInfo } from '@nuxt/content'
import { getCollectionByFilePath } from '../../../module/src/runtime/utils/collection'
import ContentCardForm from '../../src/components/content/ContentCardForm.vue'
import ItemCardForm from '../../src/components/shared/item/ItemCardForm.vue'
import type { ExtensionConfig, StudioHost, TreeItem } from '../../src/types'
import { StudioItemActionId } from '../../src/types'

type TestStudio = {
  host: { collection: StudioHost['collection'] }
  context: { itemActions: Ref<unknown[]>, unsetActionInProgress: () => void }
}
type FormState = {
  state: { name: string, extension?: string, prefix?: string }
  extensionConfig: ExtensionConfig
  collectionError: string
  onSubmit: () => Promise<void>
}
const mocks = vi.hoisted(() => ({ studio: {} as TestStudio }))
vi.mock('../../src/composables/useStudio', () => ({ useStudio: () => mocks.studio }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup.splice(0).forEach(fn => fn())
  vi.useRealTimers()
})

function mountForm(folder = 'printables', renamedItem?: TreeItem) {
  vi.useFakeTimers()
  const list = [
    { name: 'blog', source: [{ include: 'blog/*.md' }] },
    { name: 'printables', source: [{ include: 'printables/*.yaml', exclude: ['printables/private*'] }] },
  ] as CollectionInfo[]
  const handler = vi.fn(async ({ fsPath }) => {
    if (!mocks.studio.host.collection.getByFsPath(fsPath)) throw new Error(`Collection not found for fsPath: ${fsPath}`)
  })
  mocks.studio = {
    host: { collection: {
      list: () => list,
      getByFsPath: (path: string) => getCollectionByFilePath(path, Object.fromEntries(list.map(c => [c.name, c]))),
    } },
    context: {
      itemActions: ref([{ id: StudioItemActionId.CreateDocument, handler, label: 'create' }, { id: StudioItemActionId.RenameItem, handler, label: 'rename' }]),
      unsetActionInProgress: vi.fn(),
    },
  }
  const props = reactive({
    actionId: renamedItem ? StudioItemActionId.RenameItem : StudioItemActionId.CreateDocument,
    parentItem: { fsPath: folder, routePath: `/${folder}`, children: [], type: 'directory', name: folder, prefix: null } as TreeItem,
    renamedItem,
  })
  const form = ref<ComponentPublicInstance>()
  const app = createApp(defineComponent({ setup: () => () => h(ContentCardForm, props) }))
  app.config.globalProperties.$t = (key: string) => key
  app.component('ItemCardForm', defineComponent({
    inheritAttrs: false,
    setup: (_, { attrs }) => () => h(ItemCardForm, { ...attrs, ref: form }),
  }))
  const stub = defineComponent({ setup: (_, { slots }) => () => h('div', [...(slots.default?.() || []), ...(slots.body?.() || [])]) })
  for (const name of ['UForm', 'UPageCard', 'UFormField', 'UInput', 'USelect', 'UTooltip', 'UButton', 'UIcon']) app.component(name, stub)
  app.component('USelect', defineComponent({
    props: ['items', 'modelValue', 'disabled'],
    setup: props => () => h('select', { disabled: props.disabled, value: props.modelValue },
      props.items.map((item: string) => h('option', { value: item }, item))),
  }))
  app.component('UButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  const container = document.createElement('div')
  app.mount(container)
  cleanup.push(() => app.unmount())
  return { props, handler, container, form: (form.value!.$ as unknown as { setupState: FormState }).setupState }
}

describe('new content form', () => {
  it('creates a YAML printable with YAML initial content, never Markdown', async () => {
    const { form, handler, container } = mountForm()
    expect(container.querySelector('select')?.disabled).toBe(true)
    expect(container.querySelector('select')?.value).toBe('yaml')
    expect(form.state.extension).toBe('yaml')
    expect(form.extensionConfig.editable).toBe(false)
    form.state.name = 'My Worksheet'
    await nextTick()
    await form.onSubmit()
    expect(handler).toHaveBeenCalledExactlyOnceWith({ fsPath: 'printables/my-worksheet.yaml', content: '' })
  })

  it('resets unsupported selections when switching folders, including no-match folders', async () => {
    const { form, props } = mountForm('blog')
    form.state.name = 'Worksheet'
    expect(form.state.extension).toBe('md')
    props.parentItem.fsPath = 'printables'
    await nextTick()
    expect(form.state.extension).toBe('yaml')
    props.parentItem.fsPath = 'unmatched'
    await nextTick()
    expect(form.state.extension).toBeUndefined()
    expect(form.collectionError).toBeTruthy()
    props.parentItem.fsPath = 'blog'
    await nextTick()
    expect(form.state.extension).toBe('md')
  })

  it('blocks excluded filenames and direct invalid submission', async () => {
    const { form, handler, container } = mountForm()
    form.state.name = 'Private Notes'
    await nextTick()
    expect(form.collectionError).toBeTruthy()
    expect(container.querySelector('[role=alert]')?.textContent).toContain('noCollection')
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true)
    await form.onSubmit()
    expect(handler).not.toHaveBeenCalled()
    form.state.name = 'Worksheet'
    await nextTick()
    form.state.extension = 'md'
    await form.onSubmit()
    expect(handler).not.toHaveBeenCalled()
  })

  it('rechecks collection matching at submit time and displays a newly invalid path', async () => {
    const { form, handler } = mountForm()
    form.state.name = 'Worksheet'
    await nextTick()
    expect(form.collectionError).toBe('')
    mocks.studio.host.collection.getByFsPath = () => undefined
    await form.onSubmit()
    expect(handler).not.toHaveBeenCalled()
    expect(form.collectionError).toContain('noCollectionForPath')
  })

  it('preserves an existing extension and rename configuration', () => {
    const { form } = mountForm('printables', { name: 'legacy', fsPath: 'printables/legacy.md', type: 'file', prefix: null })
    expect(form.state.extension).toBe('md')
    expect(form.extensionConfig.allowed).toEqual(['md', 'yaml', 'yml', 'json'])
    expect(form.collectionError).toBe('')
  })
})
