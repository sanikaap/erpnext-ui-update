<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AlertCircle, ChevronDown } from 'lucide-vue-next';
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
// a user's explicit open/close then wins.
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

defineExpose({ tabs: visibleTabs, activeTab });
</script>

<template>
  <div :class="['dynamic-form', { 'dynamic-form--dense': dense }]">
    <nav v-if="visibleTabs.length > 1" class="form-tabs" role="tablist" :aria-label="`${doctype} sections`">
      <button
        v-for="tab in visibleTabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="tab.key === currentTab?.key"
        :class="['form-tab', { 'form-tab--active': tab.key === currentTab?.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}<span v-if="tabHasError(tab)" class="form-tab-error" aria-label="has errors" />
      </button>
    </nav>

    <div v-if="!visibleTabs.length" class="form-empty">{{ hideEmpty ? 'No values recorded yet.' : 'This DocType has no fields to show.' }}</div>

    <div v-if="currentTab" class="form-sections" role="tabpanel">
      <section v-for="section in currentTab.sections" :key="section.key" :class="['form-section', { 'form-section--untitled': !section.label }]">
        <header v-if="section.label" class="section-head">
          <button v-if="section.collapsible" type="button" class="section-toggle" :aria-expanded="!isCollapsed(section)" @click="toggleSection(section)">
            <ChevronDown :size="15" :class="['section-caret', { 'section-caret--closed': isCollapsed(section) }]" />
            <h3>{{ section.label }}</h3>
            <span v-if="isCollapsed(section)" class="section-count">{{ section.visible.flat().length }} fields</span>
          </button>
          <h3 v-else>{{ section.label }}</h3>
          <p v-if="section.description && !isCollapsed(section)" v-html="sanitizeHtml(section.description)" />
        </header>

        <div v-show="!isCollapsed(section)" class="section-grid" :style="{ '--form-columns': section.visible.length }">
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
      </section>
    </div>
  </div>
</template>

<style scoped>
.dynamic-form { display: flex; min-width: 0; flex-direction: column; gap: 16px; }

.form-tabs { position: sticky; z-index: 6; top: calc(var(--topbar-height) + var(--form-sticky-offset, 0px)); display: flex; gap: 4px; overflow-x: auto; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(8px); box-shadow: var(--shadow-sm); scrollbar-width: none; }
.dynamic-form--dense .form-tabs { position: static; }
.form-tab { position: relative; display: inline-flex; flex: none; align-items: center; gap: 6px; height: 32px; padding: 0 12px; color: var(--muted-foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; font-weight: 500; white-space: nowrap; transition: background-color .12s, color .12s; }
.form-tab:hover { color: var(--foreground); background: var(--muted); }
.form-tab--active { color: var(--primary-soft-foreground); background: var(--primary-soft); font-weight: 600; }
.form-tab-error { width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }

.form-sections { display: flex; flex-direction: column; gap: 14px; }
.form-section { padding: 18px 20px 20px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.dynamic-form--dense .form-section { padding: 0 0 18px; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; box-shadow: none; background: none; }
.dynamic-form--dense .form-section:last-child { border-bottom: 0; }
.section-head { margin-bottom: 14px; }
.section-head h3 { position: relative; padding-left: 12px; color: var(--foreground); font-size: 14px; font-weight: 600; letter-spacing: -.005em; }
.section-head h3::before { position: absolute; top: 3px; bottom: 3px; left: 0; width: 3px; content: ''; border-radius: 3px; background: linear-gradient(var(--primary), var(--secondary)); }
.section-head p { margin-top: 3px; padding-left: 12px; color: var(--muted-foreground); font-size: 12px; }
.section-toggle { display: flex; align-items: center; gap: 4px; width: 100%; padding: 0; border: 0; background: none; text-align: left; }
.section-toggle h3 { padding-left: 4px; }
.section-toggle h3::before { display: none; }
.section-caret { flex: none; color: var(--primary); transition: transform .15s var(--ease); }
.section-caret--closed { transform: rotate(-90deg); }
.section-count { margin-left: auto; color: var(--subtle-foreground); font-size: 12px; }
.form-section:has(.section-caret--closed) .section-head { margin-bottom: 0; }

.section-grid { display: grid; grid-template-columns: repeat(var(--form-columns, 1), minmax(0, 1fr)); gap: 0 24px; }
.section-column { display: flex; min-width: 0; flex-direction: column; gap: 14px; }
.form-field { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.field-label { display: flex; align-items: baseline; gap: 2px; color: var(--muted-foreground); font-size: 12px; font-weight: 500; }
.form-field:focus-within .field-label { color: var(--primary-soft-foreground); }
.field-required { color: var(--danger); font-weight: 600; }
.form-field--bold .field-label { color: var(--foreground); font-weight: 600; }
.field-help { color: var(--subtle-foreground); font-size: 11.5px; line-height: 1.4; }
.field-error { display: flex; align-items: center; gap: 4px; color: var(--danger); font-size: 11.5px; font-weight: 500; }
.form-field--invalid .field-label { color: var(--danger); }
.form-empty { padding: 32px; color: var(--muted-foreground); font-size: 13px; text-align: center; }

@media (max-width: 900px) {
  .section-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
}
</style>
