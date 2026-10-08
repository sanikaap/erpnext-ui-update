<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import PanelCard from '@/components/ui/PanelCard.vue';
import { useTheme } from '@/composables/useTheme';
import { useLayoutStore } from '@/stores/layout';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { erpnextApi } from '@/services/erpnext-api';

/** Per-browser interface preferences. ERPNext settings live in their own DocTypes (Setup module). */
const theme = useTheme();
const layout = useLayoutStore();
const { user } = useCurrentUser();
const site = erpnextApi.getBaseUrl();
</script>

<template>
  <div class="page page--narrow stagger-in">
    <section class="page-header">
      <div><p class="eyebrow">Account</p><h1 class="page-title">Preferences</h1><p class="page-subtitle">How this interface looks on this device. Changes apply immediately.</p></div>
    </section>
    <PanelCard title="Appearance" eyebrow="Saved in this browser">
      <div class="setting-row"><div><strong>Interface theme</strong><small>Choose a fixed theme or follow your device.</small></div>
        <div class="segmented" role="radiogroup" aria-label="Interface theme">
          <button role="radio" :aria-checked="theme.preference === 'light'" :class="{ selected: theme.preference === 'light' }" @click="theme.setTheme('light')" data-testid="button-theme-light"><Sun :size="14" />Light</button>
          <button role="radio" :aria-checked="theme.preference === 'dark'" :class="{ selected: theme.preference === 'dark' }" @click="theme.setTheme('dark')" data-testid="button-theme-dark"><Moon :size="14" />Dark</button>
          <button role="radio" :aria-checked="theme.preference === 'system'" :class="{ selected: theme.preference === 'system' }" @click="theme.setTheme('system')" data-testid="button-theme-system"><Monitor :size="14" />System</button>
        </div>
      </div>
      <div class="setting-row"><div><strong>Compact sidebar</strong><small>Show modules as an icon rail with flyout menus.</small></div>
        <button class="toggle" role="switch" :aria-checked="layout.sidebarCollapsed" aria-label="Compact sidebar" @click="layout.toggleSidebar()"><span /></button>
      </div>
    </PanelCard>
    <PanelCard title="Connection" eyebrow="ERPNext / Frappe">
      <div class="setting-row"><div class="connection"><span class="connection-dot" /><div><strong>Signed in as {{ user?.fullName || user?.id }}</strong><small>{{ site }} · requests use your ERPNext session and permissions.</small></div></div></div>
    </PanelCard>
  </div>
</template>

<style scoped>
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.setting-row + .setting-row { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.setting-row strong { display: block; color: var(--foreground); font-size: 13px; font-weight: 600; }
.setting-row small { display: block; margin-top: 2px; color: var(--muted-foreground); font-size: 12.5px; }
.segmented { display: flex; flex: none; padding: 3px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--muted); }
.segmented button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; color: var(--muted-foreground); border: 0; border-radius: 6px; background: none; font-size: 12.5px; font-weight: 500; }
.segmented button:hover { color: var(--foreground); }
.segmented button.selected { color: var(--foreground); background: var(--surface-elevated); box-shadow: var(--shadow-sm); }
.segmented button.selected svg { color: var(--primary); }
.connection { display: flex; align-items: flex-start; gap: 12px; }
.connection-dot { width: 8px; height: 8px; flex: none; margin-top: 6px; border-radius: 50%; background: var(--secondary); box-shadow: 0 0 0 3px var(--secondary-soft); }
.toggle { width: 38px; height: 22px; flex: none; padding: 2px; border: 0; border-radius: 99px; background: var(--border-strong); transition: background-color .15s; }
.toggle span { display: block; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow-sm); transition: transform .15s var(--ease); }
.toggle[aria-checked="true"] { background: var(--primary); }
.toggle[aria-checked="true"] span { transform: translateX(16px); }
@media (max-width: 640px) { .setting-row { align-items: flex-start; flex-direction: column; gap: 12px; } }
</style>
