<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CornerDownLeft, Database, FileText, LoaderCircle, Plus, Search } from 'lucide-vue-next';
import { allNavigation } from '@/config/navigation';
import { moduleRegistry } from '@/app/module-registry';
import { isStaticDocType, staticGlobalSearch } from '@/services/static-data';
import { useNavigation } from '@/composables/useNavigation';
import { erpnextApi } from '@/services/erpnext-api';
import { documentApi } from '@/services/document-api';
import type { Component } from 'vue';

/**
 * ⌘K palette: jump to any page, open any DocType's list (including ones not in the
 * sidebar) and search records with Frappe's global search.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const router = useRouter();

interface Entry { key: string; section: string; label: string; hint?: string; icon: Component; color?: string; run: () => void }

const query = ref('');
const input = ref<HTMLInputElement | null>(null);
const active = ref(0);
const doctypes = ref<string[]>([]);
const records = ref<Array<{ doctype: string; name: string; content?: string; title?: string }>>([]);
const searching = ref(false);

watch(() => props.open, async (open) => {
  if (!open) return;
  query.value = '';
  records.value = [];
  doctypes.value = [];
  active.value = 0;
  await nextTick();
  input.value?.focus();
});

const groupFor = new Map(moduleRegistry.flatMap((module) => module.items.map((entry) => [entry.path, module] as const)));
const { isAvailable } = useNavigation();

const pages = computed<Entry[]>(() => {
  const text = query.value.trim().toLowerCase();
  const seen = new Set<string>();
  return allNavigation
    .filter((entry) => {
      const group = groupFor.get(entry.path);
      const match = !text || entry.label.toLowerCase().includes(text) || group?.label.toLowerCase().includes(text) || entry.doctype?.toLowerCase().includes(text);
      const key = `${group?.label}:${entry.label}`;
      if (!match || seen.has(key) || !isAvailable(entry)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, text ? 8 : 6)
    .map((entry) => {
      const group = groupFor.get(entry.path);
      return { key: `page-${entry.path}`, section: 'Go to', label: entry.label, hint: group ? `${group.workspace} · ${group.label}` : undefined, icon: entry.icon, color: group?.color, run: () => void router.push(entry.path) };
    });
});

const creates = computed<Entry[]>(() => {
  const text = query.value.trim().toLowerCase().replace(/^new\s+/, '');
  if (!query.value.trim().toLowerCase().startsWith('new') || !text) return [];
  return [...new Set(allNavigation.map((entry) => entry.doctype).filter((doctype) => doctype && !isStaticDocType(doctype)) as string[])]
    .filter((doctype) => doctype.toLowerCase().includes(text))
    .slice(0, 4)
    .map((doctype) => ({ key: `new-${doctype}`, section: 'Create', label: `New ${doctype}`, icon: Plus, run: () => void router.push({ name: 'document-create', params: { doctype } }) }));
});

const doctypeEntries = computed<Entry[]>(() => doctypes.value
  .filter((doctype) => !pages.value.some((page) => page.label === doctype))
  .slice(0, 5)
  .map((doctype) => ({ key: `dt-${doctype}`, section: 'DocTypes', label: doctype, hint: 'Open list', icon: Database, run: () => void router.push({ name: 'document-list', params: { doctype } }) })));

const recordEntries = computed<Entry[]>(() => records.value.map((record) => ({
  key: `rec-${record.doctype}-${record.name}`,
  section: 'Records',
  label: record.name,
  // Global search content is "Label : value ||| Label : value"; show it as a readable summary.
  hint: [record.doctype, record.title && record.title !== record.name ? record.title : '', (record.content || '').replace(/<[^>]+>/g, '').split('|||').map((part) => part.split(':').slice(1).join(':').trim()).filter((part) => part && part !== record.name && part !== record.title).slice(0, 2).join(', ')].filter(Boolean).join(' · '),
  icon: FileText,
  run: () => void router.push({ name: 'document-detail', params: { doctype: record.doctype, name: record.name } }),
})));

const entries = computed(() => [...creates.value, ...pages.value, ...doctypeEntries.value, ...recordEntries.value]);
const sections = computed(() => {
  const result: { title: string; items: { entry: Entry; index: number }[] }[] = [];
  entries.value.forEach((entry, index) => {
    const last = result[result.length - 1];
    if (last?.title === entry.section) last.items.push({ entry, index });
    else result.push({ title: entry.section, items: [{ entry, index }] });
  });
  return result;
});

let timer: number | undefined;
let generation = 0;
watch(query, (text) => {
  active.value = 0;
  window.clearTimeout(timer);
  if (text.trim().length < 2) { records.value = []; doctypes.value = []; searching.value = false; return; }
  searching.value = true;
  timer = window.setTimeout(async () => {
    const run = (generation += 1);
    const [found, types] = await Promise.all([
      erpnextApi.call<Array<{ doctype: string; name: string; content?: string; title?: string }>>('frappe.utils.global_search.search', { text: text.trim(), limit: 8 })
        .then((response) => response.message ?? []).catch(() => []),
      documentApi.searchLink('DocType', text.trim(), { pageLength: 6, filters: { istable: 0 } }).then((rows) => rows.map((row) => row.value)).catch(() => []),
    ]);
    if (run !== generation) return;
    // NGO demo records live in the browser, so they are searched locally.
    records.value = [...staticGlobalSearch(text.trim(), 4), ...found];
    doctypes.value = types;
    searching.value = false;
  }, 250);
});

function choose(entry?: Entry) {
  if (!entry) return;
  entry.run();
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  const count = entries.value.length;
  if (event.key === 'ArrowDown') { event.preventDefault(); active.value = count ? (active.value + 1) % count : 0; scrollActive(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); active.value = count ? (active.value - 1 + count) % count : 0; scrollActive(); }
  else if (event.key === 'Enter') { event.preventDefault(); choose(entries.value[active.value]); }
  else if (event.key === 'Escape') emit('close');
}

function scrollActive() {
  void nextTick(() => document.querySelector('.palette-item--active')?.scrollIntoView({ block: 'nearest' }));
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="palette-root" @mousedown.self="emit('close')">
        <div class="palette" role="dialog" aria-modal="true" aria-label="Search">
          <label class="palette-input">
            <Search :size="17" />
            <input ref="input" v-model="query" placeholder="Search pages, DocTypes and records… (type “new” to create)" aria-label="Search" @keydown="onKeydown" />
            <LoaderCircle v-if="searching" :size="15" class="spin palette-spinner" />
            <kbd>Esc</kbd>
          </label>
          <div class="palette-results" role="listbox">
            <p v-if="!entries.length && !searching" class="palette-empty">No matches for “{{ query }}”.</p>
            <section v-for="section in sections" :key="section.title">
              <p class="palette-section">{{ section.title }}</p>
              <button
                v-for="{ entry, index } in section.items"
                :key="entry.key"
                type="button"
                role="option"
                :aria-selected="index === active"
                :class="['palette-item', { 'palette-item--active': index === active }]"
                :style="entry.color ? { '--c': `var(${entry.color})` } : undefined"
                @mouseenter="active = index"
                @click="choose(entry)"
              >
                <span class="palette-icon"><component :is="entry.icon" :size="14" /></span>
                <span class="palette-label">{{ entry.label }}</span>
                <span v-if="entry.hint" class="palette-hint">{{ entry.hint }}</span>
                <CornerDownLeft v-if="index === active" :size="13" class="palette-enter" />
              </button>
            </section>
          </div>
          <footer class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>⌘</kbd><kbd>K</kbd> toggle</span></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-root { position: fixed; z-index: 95; inset: 0; display: flex; justify-content: center; padding: 12vh 16px 16px; background: var(--overlay); backdrop-filter: blur(3px); }
.palette { display: flex; width: 640px; max-width: 100%; max-height: 70vh; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface-elevated); box-shadow: var(--shadow-lg); animation: stagger-in .16s var(--ease) both; }
.palette-input { display: flex; align-items: center; gap: 10px; padding: 0 14px; height: 54px; color: var(--primary); border-bottom: 1px solid var(--border); }
.palette-input input { min-width: 0; flex: 1; height: 100%; color: var(--foreground); border: 0; outline: 0; background: none; font-size: 14.5px; }
.palette-input input::placeholder { color: var(--subtle-foreground); }
.palette-spinner { color: var(--primary); }
kbd { padding: 1px 6px; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: 5px; background: var(--muted); font: 500 11px var(--font-sans); }
.palette-results { flex: 1; overflow-y: auto; padding: 6px; }
.palette-section { padding: 10px 10px 4px; color: var(--subtle-foreground); font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.palette-item { --c: var(--primary); display: flex; align-items: center; gap: 10px; width: 100%; height: 40px; padding: 0 10px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; text-align: left; }
.palette-item--active { background: color-mix(in srgb, var(--c) 11%, transparent); }
.palette-icon { display: grid; width: 26px; height: 26px; flex: none; place-items: center; color: var(--c); border-radius: 7px; background: color-mix(in srgb, var(--c) 13%, transparent); }
.palette-label { flex: none; max-width: 55%; overflow: hidden; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.palette-hint { min-width: 0; flex: 1; overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.palette-enter { flex: none; margin-left: auto; color: var(--c); }
.palette-empty { padding: 24px; color: var(--muted-foreground); font-size: 13px; text-align: center; }
.palette-foot { display: flex; gap: 16px; padding: 8px 14px; color: var(--subtle-foreground); border-top: 1px solid var(--border); background: var(--surface-tint); font-size: 11.5px; }
.palette-foot kbd { margin-right: 2px; }
@media (max-width: 600px) { .palette-foot { display: none; } }
</style>
