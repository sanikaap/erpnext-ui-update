<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Mail, Phone, Star } from 'lucide-vue-next';
import LinkField from '@/components/forms/fields/LinkField.vue';
import AttachField from '@/components/forms/fields/AttachField.vue';
import TextEditorField from '@/components/forms/fields/TextEditorField.vue';
import TableField from '@/components/forms/fields/TableField.vue';
import TableMultiSelectField from '@/components/forms/fields/TableMultiSelectField.vue';
import { currencyFor, formatValue, selectOptions } from '@/lib/doctype';
import { sanitizeHtml } from '@/lib/sanitize';
import { fileApi } from '@/services/file-api';
import type { ERPNextMetadataField } from '@/types/erp';
import type { ValidationError } from '@/lib/doctype';

/**
 * Renders one DocField by its fieldtype. Every ERPNext DocType goes through
 * this component; unknown fieldtypes fall back to a plain input instead of failing.
 */
const props = withDefaults(defineProps<{
  field: ERPNextMetadataField;
  modelValue: unknown;
  /** The document (or child row) the field belongs to: Dynamic Link, Currency and Image read from it. */
  doc?: Record<string, unknown>;
  parent?: Record<string, unknown>;
  readOnly?: boolean;
  invalid?: boolean;
  compact?: boolean;
  /** Child-table metadata, keyed by child DocType. */
  childFields?: Record<string, ERPNextMetadataField[]>;
  /** Parent DocType / name, for attachments and link context. */
  doctype?: string;
  docname?: string;
  errors?: ValidationError[];
  inputId?: string;
}>(), { readOnly: false, invalid: false, compact: false, doc: () => ({}), childFields: () => ({}), errors: () => [] });

const emit = defineEmits<{ 'update:modelValue': [value: unknown]; linkSelect: [value: string] }>();

const type = computed(() => props.field.fieldtype);
const NUMERIC = new Set(['Int', 'Float', 'Currency', 'Percent']);
const MULTILINE = new Set(['Text', 'Small Text', 'Long Text', 'Code', 'JSON', 'HTML Editor', 'Markdown Editor']);
const KNOWN = new Set([
  'Data', 'Link', 'Dynamic Link', 'Select', 'Autocomplete', 'Check', 'Int', 'Float', 'Currency', 'Percent', 'Date', 'Datetime', 'Time',
  'Text', 'Small Text', 'Long Text', 'Code', 'JSON', 'HTML Editor', 'Markdown Editor', 'Text Editor', 'Password', 'Read Only',
  'Attach', 'Attach Image', 'Image', 'HTML', 'Heading', 'Phone', 'Table', 'Table MultiSelect', 'Rating', 'Color', 'Duration', 'Icon', 'Barcode',
]);

const linkDoctype = computed(() => {
  if (type.value === 'Link') return props.field.options || undefined;
  if (type.value === 'Dynamic Link') {
    const target = props.doc?.[props.field.options || ''];
    return typeof target === 'string' && target ? target : undefined;
  }
  return undefined;
});

const stringValue = computed(() => {
  const value = props.modelValue;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
});

const checked = computed(() => props.modelValue === true || Number(props.modelValue) === 1);
const options = computed(() => selectOptions(props.field));
const currency = computed(() => currencyFor(props.field, props.doc, props.parent));
const display = computed(() => formatValue(props.modelValue, props.field, props.doc, props.parent));
const dataKind = computed(() => (type.value === 'Phone' ? 'Phone' : type.value === 'Data' ? props.field.options || '' : ''));

// Numeric inputs keep the raw text while typing ("1.", "-") and emit numbers.
const numberDraft = ref<string | null>(null);
const numberText = computed(() => numberDraft.value ?? (props.modelValue === null || props.modelValue === undefined || props.modelValue === '' ? '' : String(props.modelValue)));
function onNumberInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/,/g, '');
  numberDraft.value = raw;
  if (raw === '' ) return emit('update:modelValue', null);
  if (!/^-?\d*\.?\d*$/.test(raw) || raw === '-' || raw === '.') return;
  emit('update:modelValue', type.value === 'Int' ? Number.parseInt(raw, 10) : Number(raw));
}
function onNumberBlur() { numberDraft.value = null; }

// Frappe datetimes are "YYYY-MM-DD HH:mm:ss"; datetime-local wants "YYYY-MM-DDTHH:mm".
const datetimeValue = computed(() => stringValue.value ? stringValue.value.replace(' ', 'T').slice(0, 16) : '');
/** Frappe sends times as "9:46:00" (or with microseconds); <input type="time"> needs "09:46:00". */
const timeValue = computed(() => {
  const [hours = '', minutes = '00', seconds = '00'] = stringValue.value.split('.')[0].split(':');
  return hours ? [hours, minutes, seconds].map((part) => part.padStart(2, '0')).join(':') : '';
});

function onDatetime(value: string) {
  emit('update:modelValue', value ? `${value.replace('T', ' ')}:00`.slice(0, 19) : '');
}

const rating = computed(() => Number(props.modelValue || 0) * (props.field.options ? Number(props.field.options) || 5 : 5));
const ratingMax = computed(() => Number(props.field.options) || 5);
function setRating(stars: number) {
  // Frappe stores Rating as a 0–1 fraction of the maximum.
  emit('update:modelValue', stars / ratingMax.value);
}

const imageSrc = computed(() => {
  const value = type.value === 'Image' ? props.doc?.[props.field.options || ''] : props.modelValue;
  return typeof value === 'string' && value ? fileApi.getUrl(value) : '';
});

function update(value: unknown) {
  emit('update:modelValue', value);
}

function onJsonInput(value: string) {
  try { emit('update:modelValue', value ? JSON.parse(value) : null); } catch { emit('update:modelValue', value); }
}
</script>

<template>
  <!-- Child tables -->
  <TableField
    v-if="type === 'Table'"
    :field="field"
    :model-value="(modelValue as Record<string, unknown>[]) || []"
    :child-fields="childFields[field.options || ''] || []"
    :all-child-fields="childFields"
    :parent-doc="doc"
    :parent-doctype="doctype"
    :read-only="readOnly"
    :errors="errors"
    @update:model-value="update"
  />
  <TableMultiSelectField
    v-else-if="type === 'Table MultiSelect'"
    :field="field"
    :model-value="(modelValue as Record<string, unknown>[]) || []"
    :child-fields="childFields[field.options || ''] || []"
    :parent-doctype="doctype"
    :read-only="readOnly"
    :invalid="invalid"
    @update:model-value="update"
  />

  <!-- Decorative / structural -->
  <h4 v-else-if="type === 'Heading'" class="fr-heading">{{ field.label }}</h4>
  <div v-else-if="type === 'HTML'" class="fr-html" v-html="sanitizeHtml(field.options)" />
  <div v-else-if="type === 'Image'" class="fr-image">
    <img v-if="imageSrc" :src="imageSrc" :alt="field.label" loading="lazy" /><span v-else class="fr-empty">No image</span>
  </div>

  <!-- Links -->
  <LinkField
    v-else-if="type === 'Link' || type === 'Dynamic Link'"
    :model-value="modelValue"
    :doctype="linkDoctype"
    :read-only="readOnly || (type === 'Dynamic Link' && !linkDoctype)"
    :invalid="invalid"
    :compact="compact"
    :reference-doctype="doctype"
    :input-id="inputId"
    :placeholder="type === 'Dynamic Link' && !linkDoctype ? `Choose ${field.options} first` : undefined"
    @update:model-value="update"
    @select="emit('linkSelect', $event)"
  />

  <!-- Files -->
  <AttachField
    v-else-if="type === 'Attach' || type === 'Attach Image'"
    :model-value="modelValue"
    :image="type === 'Attach Image'"
    :read-only="readOnly"
    :doctype="doctype"
    :docname="docname"
    :fieldname="field.fieldname"
    :compact="compact"
    @update:model-value="update"
  />

  <TextEditorField v-else-if="type === 'Text Editor'" :model-value="modelValue" :read-only="readOnly" :invalid="invalid" @update:model-value="update" />

  <!-- Read-only presentation for value fields -->
  <span v-else-if="type === 'Check' && readOnly" :class="['fr-check fr-check--readonly', { 'fr-check--compact': compact }]">
    <span :class="['fr-check-read', { on: checked }]"><Check v-if="checked" :size="12" /></span>
    <span v-if="!compact" class="fr-check-label">{{ field.label }}</span>
  </span>
  <div v-else-if="readOnly || type === 'Read Only'" :class="['fr-readonly', { 'fr-readonly--compact': compact, 'fr-readonly--numeric': NUMERIC.has(type), 'fr-readonly--bold': field.bold }]">
    <span v-if="type === 'Color' && stringValue" class="fr-swatch" :style="{ background: stringValue }" />
    <span v-else-if="MULTILINE.has(type)" :class="['fr-multiline', { mono: type === 'Code' || type === 'JSON' }]">{{ stringValue || '—' }}</span>
    <a v-else-if="dataKind === 'Email' && stringValue" :href="`mailto:${stringValue}`" class="fr-link"><Mail :size="13" />{{ stringValue }}</a>
    <a v-else-if="dataKind === 'Phone' && stringValue" :href="`tel:${stringValue}`" class="fr-link"><Phone :size="13" />{{ stringValue }}</a>
    <a v-else-if="dataKind === 'URL' && /^https?:/i.test(stringValue)" :href="stringValue" target="_blank" rel="noopener noreferrer" class="fr-link">{{ stringValue }}</a>
    <span v-else-if="type === 'Rating'" class="fr-rating" :aria-label="`${rating} of ${ratingMax}`"><Star v-for="star in ratingMax" :key="star" :size="14" :class="{ on: star <= Math.round(rating) }" /></span>
    <span v-else :class="{ 'fr-empty': display === '—' }">{{ display }}</span>
  </div>

  <!-- Editable controls -->
  <label v-else-if="type === 'Check'" :class="['fr-check', { 'fr-check--compact': compact }]">
    <input :id="inputId" type="checkbox" :checked="checked" @change="update(($event.target as HTMLInputElement).checked ? 1 : 0)" />
    <span class="fr-check-box" aria-hidden="true"><Check :size="12" /></span>
    <span v-if="!compact" class="fr-check-label">{{ field.label }}<b v-if="field.reqd" class="fr-required">*</b></span>
  </label>

  <div v-else-if="type === 'Select'" :class="['fr-select', { 'fr-select--compact': compact }]">
    <select :id="inputId" :class="['control', { 'control--invalid': invalid }]" :value="stringValue" @change="update(($event.target as HTMLSelectElement).value)">
      <option v-if="!options.includes('')" value="">{{ compact ? '' : `Select ${field.label.toLowerCase()}…` }}</option>
      <option v-for="option in options" :key="option" :value="option">{{ option || (compact ? '' : `Select ${field.label.toLowerCase()}…`) }}</option>
    </select>
  </div>

  <div v-else-if="NUMERIC.has(type)" :class="['fr-number control', { 'control--invalid': invalid, 'fr-number--compact': compact }]">
    <span v-if="type === 'Currency' && currency && !compact" class="fr-affix">{{ currency }}</span>
    <input :id="inputId" :value="numberText" inputmode="decimal" autocomplete="off" @input="onNumberInput" @blur="onNumberBlur" />
    <span v-if="type === 'Percent'" class="fr-affix">%</span>
  </div>

  <input v-else-if="type === 'Date'" :id="inputId" type="date" :class="['control', { 'control--invalid': invalid, 'control--compact': compact }]" :value="stringValue.slice(0, 10)" @input="update(($event.target as HTMLInputElement).value)" />
  <input v-else-if="type === 'Datetime'" :id="inputId" type="datetime-local" :class="['control', { 'control--invalid': invalid, 'control--compact': compact }]" :value="datetimeValue" @input="onDatetime(($event.target as HTMLInputElement).value)" />
  <input v-else-if="type === 'Time'" :id="inputId" type="time" step="1" :class="['control', { 'control--invalid': invalid, 'control--compact': compact }]" :value="timeValue" @input="update(($event.target as HTMLInputElement).value)" />

  <textarea
    v-else-if="MULTILINE.has(type)"
    :id="inputId"
    :class="['control fr-textarea', { 'control--invalid': invalid, mono: type === 'Code' || type === 'JSON', 'fr-textarea--small': type === 'Small Text' || compact, 'fr-textarea--long': type === 'Long Text' || type === 'Code' }]"
    :value="stringValue"
    :rows="compact ? 1 : type === 'Small Text' ? 2 : 5"
    @input="type === 'JSON' ? onJsonInput(($event.target as HTMLTextAreaElement).value) : update(($event.target as HTMLTextAreaElement).value)"
  />

  <div v-else-if="type === 'Rating'" class="fr-rating fr-rating--edit" role="radiogroup" :aria-label="field.label">
    <button v-for="star in ratingMax" :key="star" type="button" role="radio" :aria-checked="star <= Math.round(rating)" :aria-label="`${star} stars`" @click="setRating(star)"><Star :size="17" :class="{ on: star <= Math.round(rating) }" /></button>
  </div>

  <div v-else-if="type === 'Color'" class="fr-color control">
    <input type="color" :value="stringValue || '#087f80'" @input="update(($event.target as HTMLInputElement).value)" />
    <input :id="inputId" :value="stringValue" placeholder="#087f80" @input="update(($event.target as HTMLInputElement).value)" />
  </div>

  <div v-else-if="type === 'Autocomplete'" class="fr-auto">
    <input :id="inputId" :class="['control', { 'control--invalid': invalid }]" :value="stringValue" :list="`${field.fieldname}-options`" @input="update(($event.target as HTMLInputElement).value)" />
    <datalist :id="`${field.fieldname}-options`"><option v-for="option in options" :key="option" :value="option" /></datalist>
  </div>

  <!-- Data, Phone, Password, Duration, Barcode and any unknown fieldtype -->
  <div v-else class="fr-text">
    <input
      :id="inputId"
      :type="type === 'Password' ? 'password' : dataKind === 'Email' ? 'email' : dataKind === 'Phone' ? 'tel' : dataKind === 'URL' ? 'url' : 'text'"
      :class="['control', { 'control--invalid': invalid, 'control--compact': compact }]"
      :value="typeof modelValue === 'object' && modelValue !== null ? '' : stringValue"
      :autocomplete="type === 'Password' ? 'new-password' : 'off'"
      :maxlength="field.length || undefined"
      :disabled="typeof modelValue === 'object' && modelValue !== null"
      @input="update(($event.target as HTMLInputElement).value)"
    />
    <small v-if="!KNOWN.has(type) && !compact" class="fr-unsupported">{{ type }} field — edited as text</small>
  </div>
</template>

<style scoped>
.control--compact { height: 30px; border-color: transparent; box-shadow: none; background: transparent; }
.control--compact:hover { border-color: var(--border); }
.control--compact:focus { background: var(--input-background); }

.fr-readonly { display: flex; min-height: 38px; align-items: center; padding: 0 12px; overflow: hidden; color: var(--foreground); border: 1px solid transparent; border-radius: var(--radius-md); background: var(--readonly-background); font-size: 13px; overflow-wrap: anywhere; }
.fr-readonly--compact { min-height: 30px; padding: 0 8px; border-color: transparent; background: transparent; }
.fr-readonly--numeric { justify-content: flex-end; font-variant-numeric: tabular-nums; }
.fr-readonly--compact.fr-readonly--numeric { justify-content: flex-end; }
.fr-readonly--bold { font-weight: 600; }
.fr-readonly:has(.fr-multiline) { align-items: flex-start; padding-top: 8px; padding-bottom: 8px; }
.fr-multiline { white-space: pre-wrap; }
.fr-empty { color: var(--subtle-foreground); }
.fr-link { display: inline-flex; align-items: center; gap: 6px; color: var(--primary-soft-foreground); }
.fr-link:hover { text-decoration: underline; }
.fr-swatch { width: 18px; height: 18px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .1); }
.fr-check-read { display: grid; width: 18px; height: 18px; place-items: center; color: var(--primary-foreground); border: 1px solid var(--border-strong); border-radius: 5px; background: var(--surface); }
.fr-check-read.on { border-color: var(--secondary); background: var(--secondary); }
.fr-check--readonly { cursor: default; color: var(--muted-foreground); }

.fr-check { position: relative; display: inline-flex; min-height: 36px; align-items: center; gap: 10px; cursor: pointer; color: var(--foreground); font-size: 13px; font-weight: 500; }
.fr-check--compact { min-height: 30px; justify-content: center; width: 100%; }
.fr-check input { position: absolute; opacity: 0; pointer-events: none; }
.fr-check-box { display: grid; width: 18px; height: 18px; flex: none; place-items: center; color: transparent; border: 1.5px solid var(--border-strong); border-radius: 5px; background: var(--input-background); transition: background-color .12s, border-color .12s, box-shadow .12s; }
.fr-check:hover .fr-check-box { border-color: var(--primary); }
.fr-check input:checked + .fr-check-box { color: var(--primary-foreground); border-color: var(--primary); background: var(--primary); }
.fr-check input:focus-visible + .fr-check-box { box-shadow: 0 0 0 3px var(--primary-soft); }
.fr-required { margin-left: 2px; color: var(--danger); font-weight: 600; }

.fr-select { position: relative; }
.fr-select--compact select { height: 30px; border-color: transparent; box-shadow: none; background: transparent; }
.fr-select--compact select:hover { border-color: var(--border); }

.fr-number { display: flex; align-items: center; gap: 8px; }
.fr-number input { min-width: 0; flex: 1; height: 100%; padding: 0; color: var(--foreground); border: 0; outline: 0; background: none; font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
.fr-number--compact { height: 30px; padding: 0 8px; border-color: transparent; box-shadow: none; background: transparent; }
.fr-number--compact:hover { border-color: var(--border); }
.fr-number--compact:focus-within { background: var(--input-background); }
.fr-affix { flex: none; padding: 1px 6px; color: var(--primary-soft-foreground); border-radius: 5px; background: var(--primary-soft); font-size: 11px; font-weight: 600; letter-spacing: .02em; }

.fr-textarea { height: auto; min-height: 92px; padding: 8px 11px; resize: vertical; line-height: 1.55; }
.fr-textarea--small { min-height: 60px; }
.fr-textarea--long { min-height: 150px; }

.fr-heading { padding-top: 6px; color: var(--foreground); font-size: 13.5px; font-weight: 600; }
.fr-html { color: var(--muted-foreground); font-size: 13px; }
.fr-image img { max-width: 160px; max-height: 160px; border: 1px solid var(--border); border-radius: var(--radius-lg); object-fit: cover; }

.fr-rating { display: inline-flex; align-items: center; gap: 2px; color: var(--border-strong); }
.fr-rating .on { color: var(--warning); fill: var(--warning); }
.fr-rating--edit button { display: grid; padding: 2px; place-items: center; color: inherit; border: 0; background: none; }
.fr-color { display: flex; align-items: center; gap: 8px; padding-left: 6px; }
.fr-color input[type=color] { width: 26px; height: 24px; padding: 0; border: 0; background: none; }
.fr-color input:not([type=color]) { min-width: 0; flex: 1; height: 100%; border: 0; outline: 0; background: none; font-size: 13px; }
.fr-unsupported { display: block; margin-top: 4px; color: var(--subtle-foreground); font-size: 11px; }
</style>
