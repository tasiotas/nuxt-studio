<script setup lang="ts">
import type { NodeViewProps } from '@tiptap/vue-3'
import { NodeViewWrapper } from '@tiptap/vue-3'
import { ref } from 'vue'
import type { TreeItem } from '../../../types'
import { useStudio } from '../../../composables/useStudio'
import { resolveMediaSelectionUrl } from '../../../utils/mediaPicker'

const props = defineProps<NodeViewProps>()

const { host } = useStudio()
const isOpen = ref(true)
const selectionError = ref('')

const handleVideoSelect = async (video: TreeItem | null) => {
  selectionError.value = ''
  try {
    const src = video ? await resolveMediaSelectionUrl(video, host) : ''
    const pos = props.getPos()

    if (typeof pos === 'number') {
      props.editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .insertContentAt(pos, {
          type: 'video',
          attrs: {
            props: {
              src,
            },
          },
        })
        .run()
    }

    isOpen.value = false
  }
  catch (error) {
    selectionError.value = (error as Error).message
  }
}

const handleCancel = () => {
  const pos = props.getPos()

  if (typeof pos === 'number') {
    props.editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + 1 })
      .run()
  }

  isOpen.value = false
}
</script>

<template>
  <NodeViewWrapper>
    <ModalMediaPicker
      :open="isOpen"
      type="video"
      :error="selectionError"
      @select="handleVideoSelect"
      @cancel="handleCancel"
    />
  </NodeViewWrapper>
</template>
