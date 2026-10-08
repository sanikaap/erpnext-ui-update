<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileText, ImageIcon, LoaderCircle, Paperclip, Upload, X } from 'lucide-vue-next';
import { fileApi } from '@/services/file-api';
import { useToast } from '@/composables/useToast';

/** Attach / Attach Image: uploads to Frappe's File DocType and stores the file URL. */
const props = withDefaults(defineProps<{
  modelValue: unknown;
  image?: boolean;
  readOnly?: boolean;
  doctype?: string;
  docname?: string;
  fieldname?: string;
  compact?: boolean;
}>(), { image: false, readOnly: false, compact: false });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const toast = useToast();

const input = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const url = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''));
const fileName = computed(() => decodeURIComponent(url.value.split('/').pop() || url.value));
const isImage = computed(() => props.image || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url.value));
const href = computed(() => (url.value ? fileApi.getUrl(url.value) : ''));

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    // Saved documents get the file attached to them; new ones upload unattached
    // and Frappe links it on save through the field value.
    const response = await fileApi.upload(file, { doctype: props.docname ? props.doctype : undefined, docname: props.docname, isPrivate: false });
    const uploaded = response?.message?.file_url;
    if (!uploaded) throw new Error('ERPNext did not return a file URL.');
    emit('update:modelValue', uploaded);
  } catch (cause) {
    toast.error('Upload failed', cause instanceof Error ? cause.message : undefined);
  } finally {
    uploading.value = false;
    if (input.value) input.value.value = '';
  }
}
</script>

<template>
  <div :class="['attach', { 'attach--image': image, 'attach--compact': compact }]">
    <template v-if="url">
      <a v-if="isImage && !compact" :href="href" target="_blank" rel="noopener" class="attach-preview"><img :src="href" :alt="fileName" loading="lazy" /></a>
      <div class="attach-file">
        <component :is="isImage ? ImageIcon : FileText" :size="15" class="attach-icon" />
        <a :href="href" target="_blank" rel="noopener" class="attach-name" :title="fileName">{{ fileName }}</a>
        <button v-if="!readOnly" type="button" class="attach-clear" aria-label="Remove file" @click="emit('update:modelValue', '')"><X :size="13" /></button>
      </div>
    </template>
    <span v-else-if="readOnly" class="attach-empty">—</span>
    <button v-if="!readOnly && !url" type="button" class="attach-drop" :disabled="uploading" @click="input?.click()">
      <LoaderCircle v-if="uploading" :size="15" class="spin" /><component :is="image ? ImageIcon : compact ? Paperclip : Upload" v-else :size="15" />
      <span>{{ uploading ? 'Uploading…' : image ? 'Upload image' : 'Attach file' }}</span>
    </button>
    <input ref="input" type="file" class="sr-only" :accept="image ? 'image/*' : undefined" tabindex="-1" @change="onFile" />
  </div>
</template>

<style scoped>
.attach { display: flex; flex-direction: column; gap: 8px; }
.attach-preview { display: block; width: 120px; height: 120px; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--muted); }
.attach-preview img { width: 100%; height: 100%; object-fit: cover; }
.attach-file { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--readonly-background); }
.attach-icon { flex: none; color: var(--primary); }
.attach-name { min-width: 0; flex: 1; overflow: hidden; color: var(--info); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.attach-name:hover { text-decoration: underline; }
.attach-clear { display: grid; width: 22px; height: 22px; flex: none; place-items: center; color: var(--subtle-foreground); border: 0; border-radius: 5px; background: none; }
.attach-clear:hover { color: var(--danger); background: var(--danger-soft); }
.attach-drop { display: flex; align-items: center; justify-content: center; gap: 8px; height: 36px; color: var(--primary-soft-foreground); border: 1px dashed color-mix(in srgb, var(--primary) 40%, var(--border)); border-radius: var(--radius-md); background: var(--primary-softer); font-size: 12.5px; font-weight: 500; transition: background-color .15s, border-color .15s; }
.attach-drop:hover:not(:disabled) { border-color: var(--primary); background: var(--primary-soft); }
.attach--image .attach-drop { width: 120px; height: 96px; flex-direction: column; }
.attach--compact .attach-drop, .attach--compact .attach-file { height: 30px; }
.attach-empty { color: var(--subtle-foreground); }
</style>
