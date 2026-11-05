<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowLeftRight, Building2, ChevronDown, LogOut, Menu, Monitor, Moon, Search, SlidersHorizontal, Sun, UserRound } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppPopover from '@/components/overlays/AppPopover.vue';
import CommandPalette from '@/components/navigation/CommandPalette.vue';
import NotificationsMenu from '@/components/navigation/NotificationsMenu.vue';
import { useTheme } from '@/composables/useTheme';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useSessionDefaults } from '@/composables/useSessionDefaults';
import { authApi } from '@/services/auth-api';
import { markLoggedOut } from '@/router/auth-guard';
import { clearSelectedApp, selectedApp } from '@/app/app-context';
import { fileApi } from '@/services/file-api';
import { useLayoutStore } from '@/stores/layout';
import { shortcutLabel } from '@/lib/utils';

const searchShortcut = shortcutLabel('K');

const emit = defineEmits<{ toggleMenu: [] }>();
const theme = useTheme();
const { user, initials } = useCurrentUser();
const route = useRoute();
const router = useRouter();
const layout = useLayoutStore();

// Default company (what new documents use), shown beside the actions.
const { defaults } = useSessionDefaults();
const company = computed(() => (defaults.value.company as string) || '');

// ⌘K / Ctrl+K opens the command palette.
function onShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    layout.paletteOpen = !layout.paletteOpen;
  }
}
onMounted(() => window.addEventListener('keydown', onShortcut));
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut));

const avatar = computed(() => (user.value?.image ? fileApi.getUrl(user.value.image) : ''));
const themeIcon = computed(() => (theme.preference === 'system' ? Monitor : theme.isDark ? Moon : Sun));

async function logout() {
  try { await authApi.logout(); } catch { /* the session may already be gone */ }
  markLoggedOut();
  clearSelectedApp();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <header class="topbar">
    <button class="icon-button menu-button" :aria-label="layout.mobileSidebarOpen ? 'Close navigation' : 'Open navigation'" aria-controls="app-sidebar" :aria-expanded="layout.mobileSidebarOpen" @click="emit('toggleMenu')" data-testid="button-open-sidebar"><Menu :size="18" /></button>

    <button type="button" class="search-box" :aria-label="`Search (${searchShortcut})`" aria-keyshortcuts="Control+K Meta+K" data-testid="input-search" @click="layout.paletteOpen = true">
      <Search :size="15" />
      <span class="search-placeholder">Search or jump to…</span>
      <kbd>{{ searchShortcut }}</kbd>
    </button>

    <div class="top-actions">
      <span v-if="company" class="company-chip" :title="`Default company: ${company}`"><Building2 :size="15" /><span>{{ company }}</span></span>
      <button class="icon-button" :aria-label="theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'" :title="theme.isDark ? 'Light theme' : 'Dark theme'" @click="theme.toggleTheme()" data-testid="button-toggle-theme">
        <Transition name="icon-swap" mode="out-in"><Sun v-if="theme.isDark" key="sun" :size="17" /><Moon v-else key="moon" :size="17" /></Transition>
      </button>
      <NotificationsMenu />

      <AppPopover align="end" width="250px">
        <template #trigger="{ toggle, open }">
          <button type="button" class="user-chip" :aria-expanded="open" aria-label="Account menu" data-testid="link-profile" @click="toggle">
            <img v-if="avatar" :src="avatar" alt="" class="user-avatar" />
            <span v-else class="user-avatar">{{ initials }}</span>
            <span class="user-copy"><strong>{{ user?.fullName || 'Account' }}</strong><small v-if="user?.email">{{ user.email }}</small></span>
            <ChevronDown :size="14" class="user-caret" />
          </button>
        </template>
        <template #default="{ close }">
          <div class="menu-user"><strong>{{ user?.fullName }}</strong><small>{{ user?.email || user?.id }}</small></div>
          <RouterLink to="/profile" class="menu-item" @click="close()"><UserRound :size="14" />Profile</RouterLink>
          <RouterLink to="/settings" class="menu-item" @click="close()"><SlidersHorizontal :size="14" />Preferences</RouterLink>
          <div class="menu-theme" role="radiogroup" aria-label="Theme">
            <component :is="themeIcon" :size="14" />
            <button v-for="option in (['light', 'dark', 'system'] as const)" :key="option" type="button" role="radio" :aria-checked="theme.preference === option" :class="{ selected: theme.preference === option }" @click="theme.setTheme(option)">{{ option }}</button>
          </div>
          <div class="menu-separator" role="separator" />
          <RouterLink :to="{ name: 'select-app' }" class="menu-item" data-testid="link-switch-app" @click="close()"><ArrowLeftRight :size="14" />Switch app<small v-if="selectedApp" class="menu-current-app">{{ selectedApp.label }}</small></RouterLink>
          <button type="button" class="menu-item menu-item--danger" @click="close(); logout()"><LogOut :size="14" />Log out</button>
        </template>
      </AppPopover>
    </div>

    <CommandPalette :open="layout.paletteOpen" @close="layout.paletteOpen = false" />
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; z-index: 40; top: 0;
  display: flex; align-items: center; gap: 16px;
  height: var(--topbar-height); padding: 0 28px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(12px);
}

.search-box { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 480px; min-width: 0; flex: 1; height: 38px; padding: 0 6px 0 12px; color: var(--icon-foreground); border: 1px solid var(--input-border); box-shadow: var(--shadow-sm); border-radius: var(--radius-md); background: var(--input-background); text-align: left; transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.search-box:hover { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); box-shadow: 0 0 0 3px var(--primary-softer); }
.search-box:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.search-placeholder { flex: 1; color: var(--subtle-foreground); font-size: 13px; }
.search-box:hover .search-placeholder { color: var(--muted-foreground); }
.search-box kbd { padding: 2px 6px; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: 5px; background: var(--muted); font: 500 11px var(--font-sans); }

.top-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.company-chip { display: inline-flex; max-width: 220px; align-items: center; gap: 8px; height: 36px; padding: 0 12px; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); font-size: 13px; font-weight: 500; white-space: nowrap; }
.company-chip svg { flex: none; color: var(--icon-foreground); }
.company-chip span { overflow: hidden; text-overflow: ellipsis; }
.icon-button.menu-button { display: none; }
.icon-swap-enter-active, .icon-swap-leave-active { transition: opacity var(--dur-fast) var(--ease); }
.icon-swap-enter-from, .icon-swap-leave-to { opacity: 0; }


.user-chip { display: flex; align-items: center; gap: 9px; margin-left: 4px; padding: 3px 8px 3px 3px; border: 1px solid transparent; border-radius: 999px; background: none; transition: background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease); }
.user-chip:hover { border-color: var(--border); background: var(--surface); }
.user-chip:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.user-avatar { display: grid; width: 32px; height: 32px; flex: none; place-items: center; border-radius: 50%; object-fit: cover; color: var(--primary-foreground); background: var(--primary); font-size: 12px; font-weight: 700; }
.user-copy { display: flex; max-width: 150px; flex-direction: column; line-height: 1.25; text-align: left; }
.user-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.user-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.user-caret { color: var(--icon-foreground); }

.menu-user { display: flex; flex-direction: column; margin: -2px -2px 6px; padding: 4px 8px 10px; border-bottom: 1px solid var(--border); }
.menu-user strong { color: var(--foreground); font-size: 13px; }
.menu-user small { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; }
.menu-theme { display: flex; align-items: center; gap: 4px; margin: 4px 0; padding: 4px 4px 4px 8px; color: var(--subtle-foreground); border-radius: var(--radius-md); background: var(--muted); }
.menu-theme svg { margin-right: 4px; color: var(--primary); }
.menu-theme button { flex: 1; height: 26px; color: var(--muted-foreground); border: 0; border-radius: 6px; background: none; font-size: 12px; text-transform: capitalize; }
.menu-theme button.selected { color: var(--foreground); background: var(--surface-elevated); box-shadow: var(--shadow-sm); font-weight: 600; }

@media (max-width: 1280px) { .user-copy { max-width: 120px; } }
@media (max-width: 1180px) { .company-chip { display: none; } }
@media (max-width: 640px) { .search-box { width: 38px; max-width: 38px; flex: none; padding: 0; justify-content: center; } .search-placeholder, .search-box kbd { display: none; } }
@media (max-width: 900px) {
  .topbar { padding: 0 16px; gap: 8px; }
  .icon-button.menu-button { display: grid; border: 0; background: none; box-shadow: none; }
  .user-copy, .user-caret { display: none; }
}
</style>
