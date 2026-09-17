// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { PropertyMeta } from 'vue-component-meta'
import TiptapComponentProps from '../../src/components/tiptap/TiptapComponentProps.vue'
import type { ComponentMeta, FormItem } from '../../src/types'

const mocks = vi.hoisted(() => ({ components: [] as ComponentMeta[] }))
vi.mock('../../src/composables/useStudio', () => ({
  useStudio: () => ({
    host: { meta: { editor: { components: { get: () => mocks.components } } } },
  }),
}))

const stringProp = (name: string): PropertyMeta => ({
  name,
  global: false,
  description: '',
  tags: [],
  required: false,
  type: 'string | undefined',
  schema: 'string | undefined',
  declarations: [],
})

const componentMeta = (props: PropertyMeta[]): ComponentMeta => ({
  name: 'TestComponent',
  path: '/components/TestComponent.vue',
  meta: { props, slots: [], events: [] },
})

const componentNode = (props: Record<string, unknown> = {}) => ({
  type: { name: 'element' },
  attrs: { tag: 'test-component', props },
}) as unknown as ProseMirrorNode

const mountedApps: ReturnType<typeof createApp>[] = []

afterEach(() => {
  mountedApps.splice(0).forEach(app => app.unmount())
  mocks.components = []
})

async function renderProperties(meta: ComponentMeta, node = componentNode()) {
  mocks.components = [meta]
  const container = document.createElement('div')
  const app = createApp(TiptapComponentProps, { node, updateProps: vi.fn() })
  app.component('FormSection', defineComponent({
    props: { formItem: { type: Object, required: true } },
    setup: props => () => h('div', { 'data-prop': (props.formItem as FormItem).key }, (props.formItem as FormItem).title),
  }))
  app.mount(container)
  mountedApps.push(app)
  await nextTick()
  return container
}

describe('TiptapComponentProps', () => {
  test('does not show Class for a component that does not declare it', async () => {
    const container = await renderProperties(componentMeta([stringProp('title')]))

    expect(container.querySelector('[data-prop="title"]')).not.toBeNull()
    expect(container.querySelector('[data-prop="class"]')).toBeNull()
  })

  test('shows Class for a component that explicitly declares it', async () => {
    const container = await renderProperties(componentMeta([stringProp('class')]))

    expect(container.querySelector('[data-prop="class"]')?.textContent).toBe('Class')
  })

  test('shows an existing undeclared class through custom-prop handling', async () => {
    const container = await renderProperties(
      componentMeta([stringProp('title')]),
      componentNode({ class: 'featured-card' }),
    )

    expect(container.querySelector('[data-prop="class"]')?.textContent).toBe('Class')
  })
})
