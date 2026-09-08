<script setup lang="ts">
import type { FormItem, TreeItem } from '../../../types'
import type { PropType } from 'vue'
import { ref, computed } from 'vue'
import { useStudio } from '../../../composables/useStudio'
import { isImageFile, getFileIcon } from '../../../utils/file'
import { Image } from '@unpic/vue'
import { acceptsMedia, isPdfUrl, resolveMediaSelectionUrl } from '../../../utils/mediaPicker'
import { getMediaThumbnailUrl } from '../../../utils/media'

const props = defineProps({
  formItem: {
    type: Object as PropType<FormItem>,
    default: () => ({}),
  },
})

const model = defineModel<string>({ default: '' })

const { mediaTree, host } = useStudio()

const popoverOpen = ref(false)
const search = ref('')
const selectionError = ref('')
const isSelecting = ref(false)
const accept = computed(() => props.formItem.accept)
const fileMode = computed(() => accept.value?.includes('application/pdf') || false)
const modelIsImage = computed(() => model.value && !isPdfUrl(model.value) && (accept.value || ['image/*']).includes('image/*'))
const modelFileName = computed(() => model.value.split(/[?#]/)[0].split('/').pop())

// Collect matching files from the media tree
const allMediaFiles = computed(() => {
  const medias: TreeItem[] = []

  const collectMedias = (items: TreeItem[]) => {
    for (const item of items) {
      if (item.type === 'file' && acceptsMedia(item.fsPath, accept.value)) {
        medias.push(item)
      }
      if (item.children) {
        collectMedias(item.children)
      }
    }
  }

  collectMedias(mediaTree.root.value)

  return medias
})

// Filter by search and limit to 8
const mediaFiles = computed(() => {
  let files = allMediaFiles.value

  if (search.value) {
    const query = search.value.toLowerCase()
    files = files.filter(file => file.name.toLowerCase().includes(query))
  }

  return files.slice(0, 8)
})

async function selectMedia(media: TreeItem) {
  if (isSelecting.value) return
  isSelecting.value = true
  selectionError.value = ''
  try {
    model.value = await resolveMediaSelectionUrl(media, host)
    popoverOpen.value = false
    search.value = ''
  }
  catch (error) {
    selectionError.value = (error as Error).message
  }
  finally {
    isSelecting.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <div
      :title="modelFileName"
      class="flex items-center justify-center size-6 bg-muted border border-muted rounded shrink-0 overflow-hidden"
    >
      <Image
        v-if="modelIsImage"
        :src="getMediaThumbnailUrl(model)"
        width="24"
        height="24"
        :alt="model"
        class="size-6 object-cover"
      />
      <UIcon
        v-else
        :name="fileMode || isPdfUrl(model) ? 'i-lucide-file-text' : 'i-lucide-image'"
        class="text-dimmed"
      />
    </div>

    <UInput
      v-model="model"
      :placeholder="$t(fileMode ? 'studio.form.media.filePlaceholder' : 'studio.form.media.placeholder')"
      size="xs"
      class="flex-1"
    >
      <template #trailing>
        <UPopover v-model:open="popoverOpen">
          <UButton
            size="xs"
            color="neutral"
            variant="none"
            icon="i-lucide-search"
            class="cursor-pointer"
          />

          <template #content>
            <div class="p-3 w-80">
              <p
                v-if="selectionError"
                role="alert"
                class="text-xs text-error mb-2"
              >
                {{ selectionError }}
              </p>
              <UInput
                v-model="search"
                :placeholder="$t(fileMode ? 'studio.form.media.fileSearchPlaceholder' : 'studio.form.media.searchPlaceholder')"
                size="xs"
                icon="i-lucide-search"
                autofocus
                class="mb-3 w-full"
              />

              <div
                v-if="mediaFiles.length === 0"
                class="text-center py-4"
              >
                <UIcon
                  :name="fileMode ? 'i-lucide-file-search' : 'i-lucide-image-off'"
                  class="size-8 mx-auto mb-2 text-muted"
                />
                <p class="text-xs text-muted">
                  {{ $t(fileMode
                    ? (search ? 'studio.form.media.noFilesFound' : 'studio.form.media.noFilesAvailable')
                    : (search ? 'studio.form.media.noImagesFound' : 'studio.form.media.noImagesAvailable')) }}
                </p>
              </div>

              <div
                v-else
                class="grid grid-cols-4 gap-2"
              >
                <UTooltip
                  v-for="media in mediaFiles"
                  :key="media.fsPath"
                  :text="media.name"
                >
                  <button
                    type="button"
                    class="aspect-square rounded-md cursor-pointer overflow-hidden border border-default hover:border-muted hover:ring-1 hover:ring-muted transition-all"
                    style="background: repeating-linear-gradient(45deg, #d4d4d8 0 6px, #a1a1aa 0 12px), repeating-linear-gradient(-45deg, #a1a1aa 0 6px, #d4d4d8 0 12px); background-blend-mode: overlay; background-size: 12px 12px;"
                    :disabled="isSelecting"
                    :aria-label="media.name"
                    @click="selectMedia(media)"
                  >
                    <Image
                      v-if="isImageFile(media.fsPath)"
                      :src="getMediaThumbnailUrl(media.routePath || media.fsPath)"
                      width="80"
                      height="80"
                      :alt="media.name"
                      class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    />
                    <span
                      v-else
                      class="flex flex-col items-center justify-center gap-1 h-full p-1 bg-default"
                    >
                      <UIcon
                        :name="getFileIcon(media.fsPath)"
                        class="size-6 text-muted"
                      />
                      <span class="text-xs truncate w-full">{{ media.name }}</span>
                    </span>
                  </button>
                </UTooltip>
              </div>

              <p
                v-if="mediaFiles.length > 0"
                class="text-xs text-dimmed mt-1"
              >
                {{ $t(fileMode ? 'studio.form.media.fileCount' : 'studio.form.media.imageCount', { count: mediaFiles.length, total: allMediaFiles.length }, allMediaFiles.length) }}
              </p>
            </div>
          </template>
        </UPopover>
      </template>
    </UInput>
  </div>
</template>
