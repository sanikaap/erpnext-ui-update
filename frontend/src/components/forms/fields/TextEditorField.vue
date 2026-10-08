<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Bold, Italic, Link2, List, ListOrdered, Underline } from 'lucide-vue-next';
import { sanitizeHtml } from '@/lib/sanitize';

/** Lightweight rich-text editor for Text Editor fields; output is sanitized HTML. */
const props = withDefaults(defineProps<{ modelValue: unknown; readOnly?: boolean; invalid?: boolean }>(), { readOnly: false, invalid: false });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const editor = ref<HTMLDivElement | null>(null);
let lastEmitted = '';

function render() {
  if (!editor.value) return;
  const html = sanitizeHtml(props.modelValue);
  if (html !== lastEmitted) editor.value.innerHTML = html;
}
onMounted(render);
watch(() => props.modelValue, render);

function onInput() {
  if (!editor.value) return;
  lastEmitted = sanitizeHtml(editor.value.innerHTML);
  emit('update:modelValue', lastEmitted);
}

function command(name: string, value?: string) {
  editor.value?.focus();
  // execCommand is deprecated but remains the only dependency-free way to format a contenteditable.
  document.execCommand(name, false, value);
  onInput();
}

function addLink() {
  const url = window.prompt('Link URL');
  if (url && /^(https?:|mailto:)/i.test(url.trim())) command('createLink', url.trim());
}
</script>

<template>
  <div v-if="readOnly" class="rich-readonly" v-html="sanitizeHtml(modelValue) || '<span class=&quot;rich-empty&quot;>—</span>'" />
  <div v-else :class="['rich control', { 'control--invalid': invalid }]">
    <div class="rich-toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" aria-label="Bold" @mousedown.prevent @click="command('bold')"><Bold :size="14" /></button>
      <button type="button" aria-label="Italic" @mousedown.prevent @click="command('italic')"><Italic :size="14" /></button>
      <button type="button" aria-label="Underline" @mousedown.prevent @click="command('underline')"><Underline :size="14" /></button>
      <span class="rich-sep" />
      <button type="button" aria-label="Bulleted list" @mousedown.prevent @click="command('insertUnorderedList')"><List :size="14" /></button>
      <button type="button" aria-label="Numbered list" @mousedown.prevent @click="command('insertOrderedList')"><ListOrdered :size="14" /></button>
      <button type="button" aria-label="Link" @mousedown.prevent @click="addLink"><Link2 :size="14" /></button>
    </div>
    <div ref="editor" class="rich-body" contenteditable="true" role="textbox" aria-multiline="true" @input="onInput" />
  </div>
</template>

<style scoped>
.rich { height: auto; padding: 0; overflow: hidden; }
.rich-toolbar { display: flex; align-items: center; gap: 2px; padding: 4px 6px; border-bottom: 1px solid var(--border); background: var(--surface-tint); }
.rich-toolbar button { display: grid; width: 28px; height: 26px; place-items: center; color: var(--muted-foreground); border: 0; border-radius: 6px; background: none; }
.rich-toolbar button:hover { color: var(--primary); background: var(--primary-soft); }
.rich-sep { width: 1px; height: 16px; margin: 0 4px; background: var(--border); }
.rich-body { min-height: 120px; max-height: 420px; overflow-y: auto; padding: 10px 12px; outline: 0; font-size: 13px; line-height: 1.6; }
.rich-body :deep(p) { margin: 0 0 6px; }
.rich-readonly { color: var(--foreground); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.rich-readonly :deep(p) { margin: 0 0 6px; }
.rich-readonly :deep(a) { color: var(--info); }
.rich-readonly :deep(.rich-empty) { color: var(--subtle-foreground); }
</style>
