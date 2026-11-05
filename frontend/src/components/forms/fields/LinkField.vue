<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowUpRight, ChevronDown, LoaderCircle, Plus, Search, X } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { documentApi } from '@/services/document-api';
import { hasDocTypePermission } from '@/services/metadata-api';
import { staticLinkTitle } from '@/services/static-data';

/**
 * Searchable Link control for any target DocType (field.options).
 * Search runs server-side through frappe.desk.search.search_link, so ERPNext's
 * own search fields, filters and permissions apply.
 */
const props = withDefaults(defineProps<{
  modelValue: unknown;
  doctype?: string;
  placeholder?: string;
  readOnly?: boolean;
  invalid?: boolean;
  compact?: boolean;
  filters?: unknown;
  referenceDoctype?: string;
  inputId?: string;
  /** Query from the form's scripts (frm.set_query), evaluated at search time against current values. */
  searchArgs?: () => { filters?: unknown; query?: string } | undefined;
}>(), { readOnly: false, invalid: false, compact: false });

const emit = defineEmits<{ 'update:modelValue': [value: string]; select: [value: string] }>();
const router = useRouter();

interface Option { value: string; description?: string; label?: string }

const text = ref(String(props.modelValue ?? ''));
const open = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const options = ref<Option[]>([]);
const highlighted = ref(0);
const canCreate = ref(false);
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const listId = `link-list-${Math.random().toString(36).slice(2, 9)}`;

watch(() => props.modelValue, (value) => {
  if (!open.value) text.value = String(value ?? '');
});

const value = computed(() => String(props.modelValue ?? ''));
const title = computed(() => staticLinkTitle(props.doctype, value.value));
const showCreate = computed(() => canCreate.value && Boolean(props.doctype));

let timer: number | undefined;
let requestId = 0;

async function search(query: string) {
  if (!props.doctype) return;
  const current = (requestId += 1);
  loading.value = true;
  error.value = null;
  try {
    const scripted = props.searchArgs?.();
    const results = await documentApi.searchLink(props.doctype, query, { filters: scripted?.filters ?? props.filters, query: scripted?.query, pageLength: 10, referenceDoctype: props.referenceDoctype });
    if (current !== requestId) return;
    options.value = results;
    highlighted.value = 0;
  } catch (cause) {
    if (current !== requestId) return;
    options.value = [];
    error.value = cause instanceof Error ? cause.message.replace(/^Frappe API Error \d+: ?/, '') || 'Search failed' : 'Search failed';
  } finally {
    if (current === requestId) loading.value = false;
  }
}

function position() {
  const rect = root.value?.getBoundingClientRect();
  if (!rect) return;
  const below = window.innerHeight - rect.bottom;
  const height = 300;
  const top = below < height && rect.top > below ? rect.top - Math.min(height, rect.top - 8) - 4 : rect.bottom + 4;
  panelStyle.value = { top: `${top}px`, left: `${rect.left}px`, width: `${Math.max(rect.width, 260)}px` };
}

function openPanel() {
  if (props.readOnly || open.value) return;
  open.value = true;
  position();
  void search(text.value === value.value ? '' : text.value);
  if (props.doctype) void hasDocTypePermission(props.doctype, 'create').then((allowed) => { canCreate.value = allowed; });
}

function closePanel() {
  open.value = false;
  window.clearTimeout(timer);
}

function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value;
  if (!open.value) openPanel();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void search(text.value), 220);
}

function choose(option: Option) {
  text.value = option.value;
  emit('update:modelValue', option.value);
  emit('select', option.value);
  closePanel();
}

function clear() {
  text.value = '';
  emit('update:modelValue', '');
  emit('select', '');
  void nextTick(() => input.value?.focus());
}

function commitOnBlur() {
  // A Link must point to a real record: keep a typed value only if it matches a result.
  const typed = text.value.trim();
  if (!typed) {
    if (value.value) clear();
  } else if (typed !== value.value) {
    const match = options.value.find((option) => option.value.toLowerCase() === typed.toLowerCase());
    if (match) choose(match);
    else text.value = value.value;
  }
  closePanel();
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && document.getElementById(listId)?.contains(next)) return;
  commitOnBlur();
}

function onKeydown(event: KeyboardEvent) {
  const count = options.value.length + (showCreate.value ? 1 : 0);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!open.value) return openPanel();
    highlighted.value = count ? (highlighted.value + 1) % count : 0;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlighted.value = count ? (highlighted.value - 1 + count) % count : 0;
  } else if (event.key === 'Enter') {
    if (!open.value) return;
    event.preventDefault();
    if (highlighted.value < options.value.length) choose(options.value[highlighted.value]);
    else if (showCreate.value) createNew();
  } else if (event.key === 'Escape') {
    if (open.value) { event.stopPropagation(); text.value = value.value; closePanel(); }
  } else if (event.key === 'Tab') {
    if (open.value && options.value[highlighted.value] && text.value && text.value !== value.value) choose(options.value[highlighted.value]);
  }
}

function createNew() {
  if (!props.doctype) return;
  const href = router.resolve({ name: 'document-create', params: { doctype: props.doctype } }).href;
  window.open(href, '_blank', 'noopener');
  closePanel();
}

function openRecord() {
  if (!props.doctype || !value.value) return;
  void router.push({ name: 'document-detail', params: { doctype: props.doctype, name: value.value } });
}

function onWindowChange() { if (open.value) position(); }
window.addEventListener('resize', onWindowChange);
window.addEventListener('scroll', onWindowChange, true);
onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowChange);
  window.removeEventListener('scroll', onWindowChange, true);
  window.clearTimeout(timer);
});
</script>

<template>
  <div v-if="readOnly" :class="['link-readonly', { 'link-readonly--compact': compact }]">
    <button v-if="value && doctype" type="button" class="link-chip" :title="value" @click="openRecord">{{ title || value }}<small v-if="title" class="link-id">{{ value }}</small><ArrowUpRight :size="12" /></button>
    <span v-else class="link-empty">—</span>
  </div>
  <div v-else ref="root" :class="['link-field control', { 'control--invalid': invalid, 'link-field--compact': compact, 'link-field--open': open }]">
    <Search v-if="!compact" :size="14" class="link-icon" />
    <input
      :id="inputId"
      ref="input"
      :value="text"
      :placeholder="placeholder || (doctype ? `Search ${doctype.toLowerCase()}…` : 'Search…')"
      role="combobox"
      autocomplete="off"
      :aria-expanded="open"
      :aria-controls="listId"
      aria-autocomplete="list"
      @focus="openPanel"
      @click="openPanel"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <LoaderCircle v-if="loading && open" :size="14" class="link-spinner spin" />
    <button v-else-if="value" type="button" class="link-action" tabindex="-1" aria-label="Clear" @mousedown.prevent @click="clear"><X :size="13" /></button>
    <ChevronDown v-else-if="!compact" :size="14" class="link-caret" />
    <button v-if="value && !compact" type="button" class="link-action" tabindex="-1" :aria-label="`Open ${value}`" :title="`Open ${value}`" @mousedown.prevent @click="openRecord"><ArrowUpRight :size="13" /></button>

    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" :id="listId" class="link-panel" role="listbox" :style="panelStyle" @mousedown.prevent>
          <div v-if="error" class="link-state link-state--error">{{ error }}</div>
          <div v-else-if="loading && !options.length" class="link-state"><LoaderCircle :size="14" class="spin" />Searching {{ doctype }}…</div>
          <div v-else-if="!options.length" class="link-state">No {{ doctype }} found{{ text ? ` for “${text}”` : '' }}</div>
          <button
            v-for="(option, index) in options"
            :key="option.value"
            type="button"
            role="option"
            tabindex="-1"
            :aria-selected="option.value === value"
            :class="['link-option', { 'link-option--active': index === highlighted, 'link-option--selected': option.value === value }]"
            @mouseenter="highlighted = index"
            @click="choose(option)"
          >
            <strong>{{ option.label || option.value }}</strong>
            <small v-if="option.label && option.label !== option.value">{{ option.value }}</small>
            <small v-if="option.description">{{ option.description }}</small>
          </button>
          <button v-if="showCreate" type="button" tabindex="-1" :class="['link-option link-create', { 'link-option--active': highlighted === options.length }]" @mouseenter="highlighted = options.length" @click="createNew">
            <Plus :size="14" />Create a new {{ doctype }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.link-field { position: relative; display: flex; align-items: center; gap: 6px; padding: 0 6px 0 10px; }
.link-field input { min-width: 0; flex: 1; height: 100%; padding: 0; color: var(--foreground); border: 0; outline: 0; background: none; font-size: 13px; }
.link-field input::placeholder { color: var(--subtle-foreground); }
.link-icon, .link-caret { flex: none; color: var(--subtle-foreground); }
.link-field--open .link-icon { color: var(--primary); }
.link-spinner { flex: none; color: var(--primary); }
.link-action { display: grid; width: 22px; height: 22px; flex: none; place-items: center; padding: 0; color: var(--subtle-foreground); border: 0; border-radius: 5px; background: none; }
.link-action:hover { color: var(--primary); background: var(--primary-soft); }
.link-field--compact { height: 30px; padding: 0 4px 0 8px; border-color: transparent; box-shadow: none; background: transparent; }
.link-field--compact:hover { border-color: var(--border); }
.link-field--compact:focus-within { background: var(--input-background); }

.link-panel { position: fixed; z-index: 120; display: flex; max-height: 300px; flex-direction: column; overflow-y: auto; padding: 5px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
.link-option { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; padding: 7px 10px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; text-align: left; }
.link-option strong { font-size: 13px; font-weight: 500; }
.link-option small { overflow: hidden; max-width: 100%; color: var(--muted-foreground); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.link-option--active { background: var(--primary-soft); }
.link-option--active strong { color: var(--primary-soft-foreground); }
.link-option--selected strong::after { content: ' ✓'; color: var(--primary); }
.link-create { flex-direction: row; align-items: center; gap: 8px; margin-top: 4px; border-top: 1px solid var(--border); border-radius: 0 0 var(--radius-md) var(--radius-md); color: var(--primary-soft-foreground); font-size: 12.5px; font-weight: 500; }
.link-state { display: flex; align-items: center; gap: 8px; padding: 10px; color: var(--muted-foreground); font-size: 12.5px; }
.link-state--error { color: var(--danger); }

.link-readonly { display: flex; min-height: 36px; align-items: center; }
.link-readonly--compact { min-height: 30px; }
.link-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 8px; overflow: hidden; color: var(--primary-soft-foreground); border: 0; border-radius: 6px; background: var(--primary-soft); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.link-chip:hover { text-decoration: underline; }
.link-id { opacity: .7; font-family: var(--font-mono); font-size: 10.5px; font-weight: 400; }
.link-empty { color: var(--subtle-foreground); }
</style>
