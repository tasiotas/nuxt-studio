<script setup lang="ts">
import type { DraftItem, MediaItem } from '../../types'
import type { PropType } from 'vue'
import { isImageFile, getFileIcon } from '../../utils/file'
import { DraftStatus } from '../../types'

defineProps({
  draftItem: {
    type: Object as PropType<DraftItem<MediaItem>>,
    required: true,
  },
})
</script>

<template>
  <ItemCardReview :draft-item="draftItem">
    <template #open>
      <img
        v-if="isImageFile(draftItem.fsPath)"
        :src="draftItem.modified?.path!"
        :class="{ 'opacity-50': draftItem.status === DraftStatus.Deleted }"
      >
      <UIcon
        v-else
        :name="getFileIcon(draftItem.fsPath)"
        class="w-10 h-10 text-muted"
        :class="{ 'opacity-50': draftItem.status === DraftStatus.Deleted }"
      />
    </template>
  </ItemCardReview>
</template>
