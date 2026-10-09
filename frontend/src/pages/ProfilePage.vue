<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CalendarClock, Globe2, Languages, Mail, ShieldCheck, UserRound } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import PanelCard from '@/components/ui/PanelCard.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { documentApi } from '@/services/document-api';
import { fileApi } from '@/services/file-api';
import { formatDate } from '@/lib/doctype';

/** The signed-in user's ERPNext User record. */
const { user, initials } = useCurrentUser();
const record = ref<Record<string, unknown> | null>(null);
const failed = ref(false);

watch(() => user.value?.id, async (id) => {
  if (!id) return;
  try { record.value = await documentApi.get('User', id); } catch { failed.value = true; }
}, { immediate: true });

const roles = computed(() => ((record.value?.roles as { role: string }[] | undefined) ?? []).map((row) => row.role).sort());
const avatar = computed(() => (user.value?.image ? fileApi.getUrl(user.value.image) : ''));
const details = computed(() => [
  { icon: Mail, label: 'Email', value: record.value?.email || user.value?.email },
  { icon: UserRound, label: 'User type', value: record.value?.user_type },
  { icon: Languages, label: 'Language', value: record.value?.language },
  { icon: Globe2, label: 'Time zone', value: record.value?.time_zone },
  { icon: CalendarClock, label: 'Last login', value: record.value?.last_login ? formatDate(record.value.last_login, true) : undefined },
].filter((entry) => entry.value));
</script>

<template>
  <div class="page page--narrow stagger-in">
    <section class="profile-hero">
      <img v-if="avatar" :src="avatar" alt="" class="large-avatar" />
      <div v-else class="large-avatar">{{ initials }}</div>
      <div class="profile-copy"><p class="eyebrow">Account</p><h1 class="page-title">{{ user?.fullName || 'Profile' }}</h1><p class="page-subtitle">{{ user?.id }}</p></div>
      <BaseBadge v-if="record" :tone="Number(record.enabled) ? 'green' : 'slate'" :label="Number(record.enabled) ? 'Active' : 'Disabled'" size="md" />
    </section>
    <div class="profile-grid">
      <PanelCard title="Profile details" eyebrow="From your ERPNext User record">
        <p v-if="failed" class="muted">Your User record is not readable with your current roles.</p>
        <div v-for="entry in details" :key="entry.label" class="detail"><component :is="entry.icon" :size="15" /><div><small>{{ entry.label }}</small><strong>{{ entry.value }}</strong></div></div>
        <RouterLink v-if="record" :to="{ name: 'document-detail', params: { doctype: 'User', name: user?.id } }" class="edit-link"><BaseButton variant="outline" size="sm">Open User record</BaseButton></RouterLink>
      </PanelCard>
      <PanelCard title="Roles" :eyebrow="`${roles.length} assigned`">
        <div v-if="roles.length" class="roles"><span v-for="role in roles" :key="role" class="role"><ShieldCheck :size="12" />{{ role }}</span></div>
        <p v-else class="muted">No roles visible.</p>
      </PanelCard>
    </div>
  </div>
</template>

<style scoped>
.profile-hero { display: flex; align-items: center; gap: 16px; padding: 20px 22px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.large-avatar { display: grid; width: 60px; height: 60px; flex: none; place-items: center; border-radius: 18px; object-fit: cover; color: var(--primary-foreground); background: var(--primary); box-shadow: var(--shadow-primary); font-size: 19px; font-weight: 700; }
.profile-copy { min-width: 0; flex: 1; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.detail { display: flex; align-items: center; gap: 12px; padding: 10px 0; color: var(--primary); border-bottom: 1px solid var(--border); }
.detail:first-child { padding-top: 0; }
.detail div { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.detail small { color: var(--muted-foreground); font-size: 12px; }
.detail strong { overflow-wrap: anywhere; color: var(--foreground); font-size: 13px; font-weight: 500; }
.edit-link { display: inline-block; margin-top: 14px; }
.roles { display: flex; flex-wrap: wrap; gap: 6px; }
.role { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; color: var(--primary-soft-foreground); border-radius: 999px; background: var(--primary-soft); font-size: 12px; font-weight: 500; }
@media (max-width: 700px) { .profile-grid { grid-template-columns: 1fr; } }
</style>
