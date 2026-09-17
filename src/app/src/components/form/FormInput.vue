<script setup lang="ts">
import type { FormItem, FormTree, ImageMediaSelection } from '../../types'
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { formItemInputLabel, applyImageSelectionById, applyValueById } from '../../utils/form'
import { isFormItemMissingRequired } from '../../utils/tiptap/props'

const props = defineProps({
  formItem: {
    type: Object as PropType<FormItem>,
    required: true,
  },
})

const form = defineModel({ type: Object as PropType<FormTree>, default: () => ({}) })

const displayLabel = computed(() => formItemInputLabel(props.formItem))
const missingRequiredValue = computed(() => isFormItemMissingRequired(props.formItem))

// Initialize model value
const model = ref(computeValue(props.formItem))

// Sync changes back to parent form
watch(model, (newValue) => {
  if (newValue === props.formItem.value) {
    return
  }

  form.value = applyValueById(form.value, props.formItem.id, newValue)
}, { deep: true })

// Watch for external form item changes
watch(() => props.formItem, (newFormItem) => {
  model.value = computeValue(newFormItem)
}, { deep: true })

function computeValue(formItem: FormItem): unknown {
  const value = formItem.value

  switch (formItem.type) {
    case 'string':
    case 'date':
    case 'datetime':
    case 'icon':
    case 'media':
    case 'file':
    case 'textarea':
      return typeof value === 'string' ? value : ''
    case 'boolean':
      return typeof value === 'boolean' ? value : false
    case 'number':
      return typeof value === 'number' ? value : 0
    case 'array':
      return Array.isArray(value) ? value : []
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    default:
      return value ?? null
  }
}

function handleImageSelection(selection: ImageMediaSelection) {
  form.value = applyImageSelectionById(form.value, props.formItem.id, selection)
}
</script>

<template>
  <UFormField
    :name="formItem.id"
    :label="undefined"
    :description="formItem.description"
    :ui="{
      root: 'w-full mt-2',
      label: 'text-xs font-semibold tracking-tight',
      description: 'text-[10px] text-muted',
    }"
  >
    <template
      #label
    >
      <span class="inline-flex items-center gap-1.5 min-w-0">
        <span class="truncate">{{ displayLabel }}</span>
        <span
          v-if="missingRequiredValue"
          class="text-error font-bold shrink-0"
          aria-label="Required field is empty"
          title="Required field is empty"
        >!</span>
        <UTooltip
          v-if="formItem.tooltip"
          :text="formItem.tooltip"
        >
          <UIcon
            name="i-lucide-circle-help"
            class="size-3.5 text-muted shrink-0"
          />
        </UTooltip>
      </span>
    </template>
    <InputWrapper
      v-model="model"
      :form-item="formItem"
      :level="1"
      @image-selected="handleImageSelection"
    />
  </UFormField>
</template>
