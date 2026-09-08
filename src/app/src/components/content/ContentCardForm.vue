<script setup lang="ts">
import type { TreeItem } from '../../types'
import type { PropType } from 'vue'
import { computed } from 'vue'
import { getFileIcon, CONTENT_EXTENSIONS } from '../../utils/file'
import { ContentFileExtension, StudioItemActionId } from '../../types'

import { useStudio } from '../../composables/useStudio'
import { getContentExtensionConfig } from '../../utils/contentCreation'

const { host } = useStudio()

const props = defineProps({
  actionId: {
    type: String as PropType<StudioItemActionId.CreateDocument | StudioItemActionId.RenameItem>,
    required: true,
  },
  parentItem: {
    type: Object as PropType<TreeItem>,
    required: true,
  },
  renamedItem: {
    type: Object as PropType<TreeItem>,
    default: null,
  },
})

const fileIcon = computed(() => {
  if (props.renamedItem) {
    return getFileIcon(props.renamedItem.fsPath)
  }

  return 'i-simple-icons-markdown'
})
</script>

<template>
  <ItemCardForm
    :action-id="actionId"
    :parent-item="parentItem"
    :renamed-item="renamedItem"
    :get-extension-config="actionId === StudioItemActionId.CreateDocument
      ? (name: string, prefix: string | null | undefined) => getContentExtensionConfig(host.collection, parentItem.fsPath, name, prefix)
      : undefined"
    :config="{
      allowed: CONTENT_EXTENSIONS,
      default: ContentFileExtension.Markdown,
      editable: true,
    }"
  >
    <template #thumbnail>
      <div class="w-full h-full flex items-center justify-center">
        <UIcon
          :name="fileIcon"
          class="w-6 h-6 text-muted"
        />
      </div>
    </template>
  </ItemCardForm>
</template>
