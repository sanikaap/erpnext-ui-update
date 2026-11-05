<script setup lang="ts">
import { computed, ref } from 'vue';
import { Share2, Tag, UserPlus, X } from 'lucide-vue-next';
import LinkField from '@/components/forms/fields/LinkField.vue';
import { erpnextApi, frappeErrorMessage } from '@/services/erpnext-api';
import { useToast } from '@/composables/useToast';
import type { DocInfo } from '@/services/document-api';

/** Desk's form sidebar: assignments, tags and sharing, on Frappe's own endpoints. */
const props = defineProps<{ doctype: string; name: string; docinfo: DocInfo; canWrite: boolean; canShare: boolean }>();
const emit = defineEmits<{ refresh: [] }>();
const toast = useToast();

interface Assignment { owner: string; name?: string }
interface ShareEntry { user?: string; everyone?: number; read?: number; write?: number; share?: number }
const assignments = computed(() => (props.docinfo.assignments ?? []) as Assignment[]);
const tags = computed(() => String(props.docinfo.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean));
const shares = computed(() => ((props.docinfo.shared ?? []) as ShareEntry[]).filter((entry) => entry.user && !entry.everyone));

const assignee = ref('');
const shareWith = ref('');
const newTag = ref('');

async function call(method: string, args: Record<string, unknown>, failure: string) {
  try {
    await erpnextApi.callPost(method, args);
    emit('refresh');
    return true;
  } catch (cause) {
    toast.error(failure, frappeErrorMessage(cause));
    return false;
  }
}
async function addAssignee(user: string) {
  if (!user) return;
  assignee.value = '';
  await call('frappe.desk.form.assign_to.add', { doctype: props.doctype, name: props.name, assign_to: JSON.stringify([user]) }, 'Could not assign');
}
const removeAssignee = (user: string) => call('frappe.desk.form.assign_to.remove', { doctype: props.doctype, name: props.name, assign_to: user }, 'Could not remove assignment');
async function addTag() {
  const tag = newTag.value.trim();
  if (!tag) return;
  newTag.value = '';
  await call('frappe.desk.doctype.tag.tag.add_tag', { tag, dt: props.doctype, dn: props.name }, 'Could not add tag');
}
const removeTag = (tag: string) => call('frappe.desk.doctype.tag.tag.remove_tag', { tag, dt: props.doctype, dn: props.name }, 'Could not remove tag');
async function addShare(user: string) {
  if (!user) return;
  shareWith.value = '';
  await call('frappe.share.add', { doctype: props.doctype, name: props.name, user, read: 1 }, 'Could not share');
}
const removeShare = (user: string) => call('frappe.share.remove', { doctype: props.doctype, name: props.name, user }, 'Could not remove access');
const shortName = (user: string) => user.split('@')[0];
</script>

<template>
  <section class="aside-card meta-card">
    <div class="meta-block">
      <h3 class="meta-title"><UserPlus :size="14" />Assigned to</h3>
      <ul v-if="assignments.length" class="meta-chips">
        <li v-for="item in assignments" :key="item.owner" class="meta-chip" :title="item.owner">{{ shortName(item.owner) }}<button v-if="canWrite" type="button" :aria-label="`Remove ${item.owner}`" @click="removeAssignee(item.owner)"><X :size="11" /></button></li>
      </ul>
      <LinkField v-if="canWrite" :key="`assign-${assignments.length}`" :model-value="assignee" doctype="User" placeholder="Assign to a user…" compact @select="addAssignee" />
      <p v-else-if="!assignments.length" class="meta-empty">No one yet</p>
    </div>
    <div class="meta-block">
      <h3 class="meta-title"><Tag :size="14" />Tags</h3>
      <ul v-if="tags.length" class="meta-chips">
        <li v-for="tag in tags" :key="tag" class="meta-chip">{{ tag }}<button v-if="canWrite" type="button" :aria-label="`Remove tag ${tag}`" @click="removeTag(tag)"><X :size="11" /></button></li>
      </ul>
      <input v-if="canWrite" v-model="newTag" class="control control--compact meta-input" placeholder="Add a tag, then Enter" aria-label="Add a tag" @keydown.enter.prevent="addTag" />
      <p v-else-if="!tags.length" class="meta-empty">No tags</p>
    </div>
    <div class="meta-block">
      <h3 class="meta-title"><Share2 :size="14" />Shared with</h3>
      <ul v-if="shares.length" class="meta-chips">
        <li v-for="entry in shares" :key="entry.user" class="meta-chip" :title="entry.user">{{ shortName(entry.user!) }}<button v-if="canShare" type="button" :aria-label="`Stop sharing with ${entry.user}`" @click="removeShare(entry.user!)"><X :size="11" /></button></li>
      </ul>
      <LinkField v-if="canShare" :key="`share-${shares.length}`" :model-value="shareWith" doctype="User" placeholder="Share with a user…" compact @select="addShare" />
      <p v-else-if="!shares.length" class="meta-empty">Not shared</p>
    </div>
  </section>
</template>

<style scoped>
.meta-card { display: flex; flex-direction: column; gap: 14px; padding: 16px 18px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-sm); }
.meta-block { display: flex; flex-direction: column; gap: 8px; }
.meta-title { display: flex; align-items: center; gap: 8px; color: var(--foreground); font-size: 13px; font-weight: 600; }
.meta-title svg { color: var(--primary); }
.meta-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; padding: 0; list-style: none; }
.meta-chip { display: inline-flex; max-width: 100%; align-items: center; gap: 4px; padding: 2px 8px; color: var(--primary-soft-foreground); border-radius: 999px; background: var(--primary-soft); font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }
.meta-chip button { display: grid; width: 15px; height: 15px; flex: none; place-items: center; padding: 0; color: inherit; border: 0; border-radius: 50%; background: none; }
.meta-chip button:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
.meta-chip button:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }
.meta-input { height: 30px; border-color: var(--border); font-size: 12.5px; }
.meta-empty { color: var(--subtle-foreground); font-size: 12px; }
</style>
