<script setup lang="ts">
import { computed } from 'vue'
import type { MediaItem } from '../../types'

const props = defineProps<{ mediaItem: MediaItem }>()
const fileName = computed(() => props.mediaItem.path?.split('/').pop() || 'PDF')
const markdownCode = computed(() => `[${fileName.value.replace(/[\\[\]]/g, '\\$&')}](<${props.mediaItem.path?.replace(/ /g, '%20')}>)`)
</script>

<template>
  <div class="flex flex-col h-full gap-4 p-4">
    <iframe
      :key="mediaItem.path"
      :src="mediaItem.path"
      :title="fileName"
      class="w-full flex-1 min-h-64 rounded-lg border border-default bg-default"
    />
    <div class="p-3 rounded-lg bg-default border border-muted relative">
      <div class="absolute top-3 right-3">
        <CopyButton :content="mediaItem.path!" />
      </div>
      <p class="text-xs text-muted mb-2">
        {{ $t('studio.media.publicPath') }}
      </p>
      <a
        :href="mediaItem.path"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs font-mono text-highlighted underline break-all"
      >
        {{ mediaItem.path }}
      </a>
    </div>
    <div class="p-3 rounded-lg bg-default border border-muted relative">
      <div class="absolute top-3 right-3">
        <CopyButton :content="markdownCode" />
      </div>
      <p class="text-xs text-muted mb-2">
        {{ $t('studio.media.markdown') }}
      </p>
      <p class="text-xs font-mono text-highlighted break-all pr-8">
        {{ markdownCode }}
      </p>
    </div>
  </div>
</template>
