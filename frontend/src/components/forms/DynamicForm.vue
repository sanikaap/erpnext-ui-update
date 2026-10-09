<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { AlertCircle, ChevronDown, LayoutList, MoreHorizontal } from 'lucide-vue-next';
import FieldRenderer from '@/components/forms/FieldRenderer.vue';
import { buildLayout, evaluateCondition, fieldState, isTruthyValue, NO_VALUE_TYPES, TABLE_TYPES, type FormSectionLayout, type ValidationError } from '@/lib/doctype';
import { applyFetchFrom } from '@/lib/fetch-from';
import { stripHtml } from '@/lib/doctype';
import { sanitizeHtml } from '@/lib/sanitize';
import { useCurrentUser } from '@/composables/useCurrentUser';
import type { ERPNextMetadataField } from '@/types/erp';

/**
 * Renders any DocType from its metadata: Tab Break → tabs, Section Break → sections,
 * Column Break → columns. depends_on / mandatory_depends_on / read_only_depends_on
 * are re-evaluated on every change, so the form reacts like Desk.
 */
const props = withDefaults(defineProps<{
  doctype: string;
  fields: ERPNextMetadataField[];
  childFields?: Record<string, ERPNextMetadataField[]>;
  /** The document being edited; mutated in place (it should be reactive). */
  doc: Record<string, unknown>;
  parent?: Record<string, unknown>;
  docname?: string;
  readOnly?: boolean;
  /** View mode: skip fields without a value. */
  hideEmpty?: boolean;
  errors?: ValidationError[];
  /** Tighter spacing, e.g. inside a drawer. */
  dense?: boolean;
}>(), { childFields: () => ({}), readOnly: false, hideEmpty: false, errors: () => [], dense: false });

const emit = defineEmits<{ change: [field: ERPNextMetadataField, value: unknown] }>();
const { user } = useCurrentUser();
const expressionContext = computed(() => ({ user: user.value?.id }));

const tabs = computed(() => buildLayout(props.fields, (field) => field.fieldtype !== 'Button'));
const activeTab = ref<string | null>(null);
const expanded = ref<Set<string>>(new Set());

const errorFields = computed(() => new Set(props.errors.filter((error) => !error.table).map((error) => error.fieldname)));
const errorTables = computed(() => new Set(props.errors.filter((error) => error.table).map((error) => error.table!)));

function state(field: ERPNextMetadataField) {
  return fieldState(field, props.doc, { parent: props.parent, readOnly: props.readOnly, context: expressionContext.value });
}

function hasValue(field: ERPNextMetadataField) {
  const value = props.doc[field.fieldname];
  if (field.fieldtype === 'Check') return Number(value) === 1;
  return isTruthyValue(value) || value === 0;
}

function shown(field: ERPNextMetadataField) {
  if (!state(field).visible) return false;
  if (props.hideEmpty && !NO_VALUE_TYPES.has(field.fieldtype)) return hasValue(field);
  if (props.hideEmpty && ['HTML', 'Heading', 'Image'].includes(field.fieldtype)) return false;
  // HTML fields are usually placeholders that Desk form scripts fill; show only static content.
  if (field.fieldtype === 'HTML' && !stripHtml(field.options)) return false;
  return true;
}

function visibleColumns(section: FormSectionLayout) {
  if (!evaluateCondition(section.dependsOn, props.doc, props.parent, expressionContext.value)) return [];
  return section.columns.map((column) => column.filter(shown)).filter((column) => column.length);
}

const visibleTabs = computed(() => tabs.value
  .filter((tab) => evaluateCondition(tab.dependsOn, props.doc, props.parent, expressionContext.value))
  .map((tab) => ({ ...tab, sections: tab.sections.map((section) => ({ ...section, visible: visibleColumns(section) })).filter((section) => section.visible.length) }))
  .filter((tab) => tab.sections.length));

const currentTab = computed(() => visibleTabs.value.find((tab) => tab.key === activeTab.value) ?? visibleTabs.value[0]);

// More than five tabs: the first four stay inline, the rest move into a "More" menu.
const MAX_INLINE_TABS = 5;
const inlineTabs = computed(() => (visibleTabs.value.length > MAX_INLINE_TABS ? visibleTabs.value.slice(0, MAX_INLINE_TABS - 1) : visibleTabs.value));
const overflowTabs = computed(() => (visibleTabs.value.length > MAX_INLINE_TABS ? visibleTabs.value.slice(MAX_INLINE_TABS - 1) : []));
const activeOverflowTab = computed(() => overflowTabs.value.find((tab) => tab.key === currentTab.value?.key));
const moreTabsOpen = ref(false);
const moreButton = ref<HTMLButtonElement | null>(null);
const moreMenu = ref<HTMLElement | null>(null);
// The tab strip scrolls sideways (and clips), so the menu is fixed-positioned under its button.
const menuPosition = ref({ top: 0, right: 0 });
const closeMoreTabs = () => { moreTabsOpen.value = false; };
async function toggleMoreTabs() {
  if (moreTabsOpen.value) { closeMoreTabs(); return; }
  const rect = moreButton.value?.getBoundingClientRect();
  if (!rect) return;
  menuPosition.value = { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) };
  moreTabsOpen.value = true;
  await nextTick();
  moreMenu.value?.querySelector<HTMLButtonElement>('button')?.focus();
}
watch(moreTabsOpen, (open) => {
  if (open) { window.addEventListener('scroll', closeMoreTabs, true); window.addEventListener('resize', closeMoreTabs); }
  else { window.removeEventListener('scroll', closeMoreTabs, true); window.removeEventListener('resize', closeMoreTabs); }
});
onBeforeUnmount(closeMoreTabs);
function pickTab(key: string) {
  activeTab.value = key;
  if (moreTabsOpen.value) { closeMoreTabs(); moreButton.value?.focus(); }
}

function tabHasError(tab: (typeof visibleTabs.value)[number]) {
  return tab.sections.some((section) => section.visible.some((column) => column.some((field) => errorFields.value.has(field.fieldname) || errorTables.value.has(field.fieldname))));
}

// Jump to the first tab with a validation error so the user sees it.
watch(() => props.errors, (errors) => {
  if (!errors.length) return;
  const target = visibleTabs.value.find(tabHasError);
  if (target) activeTab.value = target.key;
  for (const tab of visibleTabs.value) {
    for (const section of tab.sections) {
      if (section.visible.some((column) => column.some((field) => errorFields.value.has(field.fieldname) || errorTables.value.has(field.fieldname)))) {
        expanded.value = new Set([...expanded.value, section.key]);
      }
    }
  }
});

// Collapsible sections start closed unless collapsible_depends_on says otherwise;
// a user's explicit open/close then wins, and is remembered per DocType on this device.
const sectionStorageKey = computed(() => `erp-form-sections:${props.doctype}`);
watch(sectionStorageKey, (key) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    expanded.value = new Set(Array.isArray(saved) ? saved.filter((entry): entry is string => typeof entry === 'string') : []);
  } catch { expanded.value = new Set(); }
}, { immediate: true });
function rememberSections() {
  try { localStorage.setItem(sectionStorageKey.value, JSON.stringify([...expanded.value])); } catch { /* storage unavailable: lasts this visit */ }
}
// Sections mid-animation keep clipping their content; afterwards an open section must
// not clip (link-field dropdowns overflow it).
const animating = ref<Set<string>>(new Set());
function animationDone(key: string) {
  if (!animating.value.has(key)) return;
  const next = new Set(animating.value); next.delete(key); animating.value = next;
}
function isCollapsed(section: FormSectionLayout) {
  if (!section.collapsible || expanded.value.has(section.key)) return false;
  if (expanded.value.has(`${section.key}:closed`)) return true;
  return !evaluateCondition(section.collapsibleDependsOn || 'eval:false', props.doc, props.parent, expressionContext.value);
}

function toggleSection(section: FormSectionLayout) {
  const next = new Set(expanded.value);
  if (isCollapsed(section)) { next.add(section.key); next.delete(`${section.key}:closed`); }
  else { next.delete(section.key); next.add(`${section.key}:closed`); }
  expanded.value = next;
  animating.value = new Set([...animating.value, section.key]);
  rememberSections();
}

function update(field: ERPNextMetadataField, value: unknown) {
  props.doc[field.fieldname] = value;
  emit('change', field, value);
}

function onLinkSelect(field: ERPNextMetadataField, value: string) {
  void applyFetchFrom(props.doc, props.fields, field, value);
}

function fieldId(field: ERPNextMetadataField) {
  return `field-${props.doctype.replace(/\W+/g, '-')}-${field.fieldname}`;
}

const inlineLabel = (field: ERPNextMetadataField) => field.fieldtype === 'Check';
const noLabel = (field: ERPNextMetadataField) => ['Heading', 'HTML', 'Table', 'Image'].includes(field.fieldtype);
const isWide = (field: ERPNextMetadataField) => TABLE_TYPES.has(field.fieldtype);

/** Row count on a tab that is essentially one child table (e.g. "Items 3"); hidden when empty. */
function tabCount(tab: (typeof visibleTabs.value)[number]) {
  const fields = tab.sections.flatMap((section) => section.visible.flat());
  const tables = fields.filter((field) => TABLE_TYPES.has(field.fieldtype));
  if (tables.length !== 1) return null;
  const isTheTab = fields.length <= 2 || tables[0].label.trim().toLowerCase() === tab.label.trim().toLowerCase();
  const rows = props.doc[tables[0].fieldname];
  return isTheTab && Array.isArray(rows) && rows.length ? rows.length : null;
}
/** A section holding only one child table: the table's own header is the section header. */
const tableOnly = (section: (typeof visibleTabs.value)[number]['sections'][number]) => {
  const fields = section.visible.flat();
  return fields.length === 1 && TABLE_TYPES.has(fields[0].fieldtype);
};
/** Section heading: the metadata label; the form's untitled opening section reads "<DocType> details". */
function sectionTitle(section: (typeof visibleTabs.value)[number]['sections'][number], index: number) {
  if (section.label) return section.label;
  return !props.dense && index === 0 && currentTab.value === visibleTabs.value[0] && !tableOnly(section) ? `${props.doctype} details` : '';
}

defineExpose({ tabs: visibleTabs, activeTab });
</script>

<template>
  <div :class="['dynamic-form', { 'dynamic-form--dense': dense }]">
    <nav v-if="visibleTabs.length > 1" class="form-tabs" role="tablist" :aria-label="`${doctype} sections`">
      <button
        v-for="tab in inlineTabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="tab.key === currentTab?.key"
        :class="['form-tab', { 'form-tab--active': tab.key === currentTab?.key }]"
        @click="pickTab(tab.key)"
      >
        {{ tab.label }}<span v-if="tabCount(tab) !== null" class="form-tab-count tabular">{{ tabCount(tab) }}</span><span v-if="tabHasError(tab)" class="form-tab-error" aria-label="has errors" />
      </button>
      <div v-if="overflowTabs.length" class="form-tab-more">
        <button
          ref="moreButton"
          type="button"
          :class="['form-tab', { 'form-tab--active': activeOverflowTab }]"
          aria-haspopup="menu"
          :aria-expanded="moreTabsOpen"
          :aria-label="activeOverflowTab ? `More sections, showing ${activeOverflowTab.label}` : 'More sections'"
          @click="toggleMoreTabs"
        >
          {{ activeOverflowTab?.label || 'More' }}<MoreHorizontal :size="14" /><span v-if="overflowTabs.some(tabHasError)" class="form-tab-error" aria-label="has errors" />
        </button>
      </div>
    </nav>
    <Teleport to="body">
      <div v-if="moreTabsOpen" class="form-tab-scrim" @click="closeMoreTabs" />
      <Transition name="pop">
        <div
          v-if="moreTabsOpen"
          ref="moreMenu"
          class="menu-panel form-tab-menu"
          role="menu"
          :style="{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }"
          @keydown.esc="closeMoreTabs(); moreButton?.focus()"
        >
          <button v-for="tab in overflowTabs" :key="tab.key" type="button" role="menuitem" :class="{ active: tab.key === currentTab?.key }" @click="pickTab(tab.key)">
            {{ tab.label }}<span v-if="tabHasError(tab)" class="form-tab-error" aria-label="has errors" />
          </button>
        </div>
      </Transition>
    </Teleport>

    <div v-if="!visibleTabs.length" class="form-empty">{{ hideEmpty ? 'No values recorded yet.' : 'This DocType has no fields to show.' }}</div>

    <div v-if="currentTab" class="form-sections" role="tabpanel">
      <section v-for="(section, sectionIndex) in currentTab.sections" :key="section.key" :class="['form-section', { 'form-section--untitled': !sectionTitle(section, sectionIndex), 'form-section--table': tableOnly(section) && !section.collapsible }]">
        <header v-if="sectionTitle(section, sectionIndex) && !(tableOnly(section) && !section.collapsible)" class="section-head">
          <button v-if="section.collapsible" type="button" class="section-toggle" :aria-expanded="!isCollapsed(section)" @click="toggleSection(section)">
            <span class="section-icon" aria-hidden="true"><LayoutList :size="15" /></span>
            <h3>{{ sectionTitle(section, sectionIndex) }}</h3>
            <span v-if="isCollapsed(section)" class="section-count">{{ section.visible.flat().length }} fields</span>
            <ChevronDown :size="16" :class="['section-caret', { 'section-caret--closed': isCollapsed(section) }]" />
          </button>
          <div v-else class="section-title"><span class="section-icon" aria-hidden="true"><LayoutList :size="15" /></span><h3>{{ sectionTitle(section, sectionIndex) }}</h3></div>
          <p v-if="section.description && !isCollapsed(section)" v-html="sanitizeHtml(section.description)" />
        </header>

        <div
          :class="['section-body', { 'section-body--closed': isCollapsed(section), 'section-body--clip': isCollapsed(section) || animating.has(section.key) }]"
          :inert="isCollapsed(section)"
          @transitionend.self="animationDone(section.key)"
        >
        <div class="section-body-inner">
        <div class="section-grid" :style="{ '--form-columns': section.visible.length }">
          <div v-for="(column, columnIndex) in section.visible" :key="columnIndex" class="section-column">
            <div
              v-for="field in column"
              :key="field.fieldname"
              :class="['form-field', `form-field--${field.fieldtype.toLowerCase().replace(/\s+/g, '-')}`, { 'form-field--wide': isWide(field), 'form-field--invalid': errorFields.has(field.fieldname), 'form-field--readonly': state(field).readOnly, 'form-field--bold': field.bold }]"
            >
              <label v-if="!inlineLabel(field) && !noLabel(field)" class="field-label" :for="fieldId(field)">
                {{ field.label }}<b v-if="state(field).required && !state(field).readOnly" class="field-required" aria-label="required">*</b>
              </label>
              <FieldRenderer
                :field="field"
                :model-value="doc[field.fieldname]"
                :doc="doc"
                :parent="parent"
                :read-only="state(field).readOnly"
                :invalid="errorFields.has(field.fieldname)"
                :child-fields="childFields"
                :doctype="doctype"
                :docname="docname"
                :errors="errors"
                :input-id="fieldId(field)"
                @update:model-value="update(field, $event)"
                @link-select="onLinkSelect(field, $event)"
              />
              <p v-if="errorFields.has(field.fieldname)" class="field-error"><AlertCircle :size="12" />{{ field.label }} is required</p>
              <p v-else-if="field.description && !state(field).readOnly" class="field-help" v-html="sanitizeHtml(field.description)" />
            </div>
          </div>
        </div>
        </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dynamic-form { display: flex; min-width: 0; flex-direction: column; gap: 16px; }

/* Tabs: an underlined strip on a white bar, sticky under the document header. */
.form-tabs { position: sticky; z-index: 6; top: calc(var(--topbar-height) + var(--form-sticky-offset, 0px)); display: flex; gap: 4px; overflow-x: auto; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(8px); box-shadow: var(--shadow-sm); scrollbar-width: none; }
.dynamic-form--dense .form-tabs { position: static; }
.form-tab { position: relative; display: inline-flex; flex: none; align-items: center; gap: 7px; height: 48px; padding: 0 12px; color: var(--muted-foreground); border: 0; border-radius: 0; background: none; font-size: 13.5px; font-weight: 500; white-space: nowrap; transition: color var(--dur-fast) var(--ease); }
.form-tab::after { position: absolute; right: 10px; bottom: 0; left: 10px; height: 2px; content: ''; border-radius: 2px 2px 0 0; background: transparent; transition: background-color var(--dur-fast) var(--ease); }
.form-tab:focus-visible { outline: var(--focus-ring); outline-offset: -6px; border-radius: var(--radius-md); }
.form-tab:hover { color: var(--foreground); }
.form-tab:hover::after { background: var(--border-strong); }
.form-tab--active { color: var(--primary-soft-foreground); font-weight: 600; }
.form-tab--active::after, .form-tab--active:hover::after { background: var(--primary); }
.form-tab-count { min-width: 20px; padding: 0 6px; color: var(--muted-foreground); border-radius: 999px; background: var(--muted); font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
.form-tab--active .form-tab-count { color: var(--primary-soft-foreground); background: var(--primary-soft); }
.form-tab-error { width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }
.form-tab-more { position: relative; flex: none; }
.form-tab-more svg { color: var(--icon-foreground); }
.form-tab-scrim { position: fixed; z-index: 29; inset: 0; }
.form-tab-menu { position: fixed; z-index: 30; max-width: calc(100vw - 16px); }
.form-tab-menu button { display: flex; align-items: center; justify-content: space-between; gap: 10px; height: 34px; padding: 0 10px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; text-align: left; }
.form-tab-menu button:hover { background: var(--muted); }
.form-tab-menu button:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
.form-tab-menu button.active { color: var(--primary-soft-foreground); background: var(--primary-soft); font-weight: 600; }

/* Sections: white cards with an icon heading. */
.form-sections { display: flex; flex-direction: column; gap: 16px; }
.form-section { padding: 20px 22px 22px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.form-section--table { padding: 0; overflow: hidden; }
.dynamic-form--dense .form-section { padding: 0 0 18px; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; box-shadow: none; background: none; overflow: visible; }
.dynamic-form--dense .form-section:last-child { border-bottom: 0; }
.section-head { margin-bottom: 18px; }
.section-title, .section-toggle { display: flex; align-items: center; gap: 10px; }
.section-head h3 { color: var(--foreground); font-size: 15px; font-weight: 600; letter-spacing: -.005em; }
.section-icon { display: grid; width: 28px; height: 28px; flex: none; place-items: center; color: var(--primary); border-radius: 8px; background: var(--primary-softer); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 16%, transparent); }
.dynamic-form--dense .section-icon { display: none; }
.section-head p { margin-top: 6px; padding-left: 38px; color: var(--muted-foreground); font-size: 12.5px; }
.section-toggle { width: 100%; padding: 0; border: 0; background: none; text-align: left; }
.section-caret { flex: none; margin-left: 8px; color: var(--icon-foreground); transition: transform var(--dur-med) var(--ease), color var(--dur-fast) var(--ease); }
.section-toggle:hover .section-caret { color: var(--primary); }
.section-toggle:focus-visible { outline: var(--focus-ring); outline-offset: 4px; border-radius: var(--radius-sm); }
.section-caret--closed { transform: rotate(-90deg); }
.section-count { margin-left: auto; color: var(--subtle-foreground); font-size: 12px; }
.form-section:has(.section-caret--closed) .section-head { margin-bottom: 0; transition: margin-bottom var(--dur-med) var(--ease); }
.section-body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows var(--dur-med) var(--ease), opacity var(--dur-med) var(--ease); }
.section-body--closed { grid-template-rows: 0fr; opacity: 0; }
.section-body-inner { min-height: 0; }
.section-body--clip > .section-body-inner { overflow: hidden; }

/* Fields */
.section-grid { display: grid; grid-template-columns: repeat(var(--form-columns, 1), minmax(0, 1fr)); gap: 0 24px; }
.section-column { display: flex; min-width: 0; flex-direction: column; gap: 16px; }
.form-field { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.field-label { display: flex; align-items: baseline; gap: 2px; color: var(--foreground); font-size: 12.5px; font-weight: 500; }
.form-field--readonly .field-label { color: var(--muted-foreground); }
.form-field:focus-within .field-label { color: var(--primary-soft-foreground); }
.field-required { margin-left: 2px; color: var(--danger); font-weight: 600; }
.form-field--bold .field-label { font-weight: 600; }
.field-help { color: var(--help-foreground); font-size: 11.5px; line-height: 1.45; }
.field-error { display: flex; align-items: center; gap: 4px; color: var(--danger); font-size: 11.5px; font-weight: 500; }
.form-field--invalid .field-label { color: var(--danger); }
.form-empty { padding: 32px; color: var(--muted-foreground); font-size: 13px; text-align: center; }
/* Form inputs are a touch taller than toolbar controls; compact grid cells keep their own height. */
.dynamic-form:not(.dynamic-form--dense) .form-field > :deep(.control:not(textarea):not(.fr-textarea):not(.rich)),
.dynamic-form:not(.dynamic-form--dense) .form-field > :deep(div > .control:not(textarea):not(.fr-textarea):not(.rich)) { height: 40px; }
.dynamic-form:not(.dynamic-form--dense) .form-field :deep(.fr-readonly) { min-height: 40px; }

@media (max-width: 900px) {
  .section-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .form-section { padding: 16px; }
}
</style>
