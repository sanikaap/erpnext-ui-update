<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, ChevronRight, LogOut, Menu, Monitor, Moon, Search, SlidersHorizontal, Sun, UserRound } from 'lucide-vue-next';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppPopover from '@/components/overlays/AppPopover.vue';
import CommandPalette from '@/components/navigation/CommandPalette.vue';
import NotificationsMenu from '@/components/navigation/NotificationsMenu.vue';
import { useTheme } from '@/composables/useTheme';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { documentConfigs, getDocumentRouteForDocType } from '@/config/navigation';
import { getModuleForPath, moduleRegistry } from '@/app/module-registry';
import { authApi } from '@/services/auth-api';
import { markLoggedOut } from '@/router/auth-guard';
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

// ---------- Breadcrumbs: Module › List › Record ----------
interface Crumb { label: string; to?: string; color?: string }
const crumbs = computed<Crumb[]>(() => {
  const doctype = route.params.doctype ? String(route.params.doctype) : documentConfigs[route.path]?.doctype;
  if (route.path === '/') return [{ label: 'Overview' }];
  if (route.path === '/settings') return [{ label: 'Account' }, { label: 'Preferences' }];
  if (route.path === '/profile') return [{ label: 'Account' }, { label: 'Profile' }];
  const module = route.meta.moduleKey ? moduleRegistry.find((candidate) => candidate.key === route.meta.moduleKey) : getModuleForPath(route.path, doctype);
  const list: Crumb[] = module ? [{ label: module.label, to: route.meta.moduleKey ? undefined : module.route, color: module.color }] : [];
  if (route.meta.moduleKey) return list;
  if (documentConfigs[route.path]) return [...list, { label: documentConfigs[route.path].title }];
  if (route.name === 'document-list') return [...list, { label: doctype || '' }];
  if (doctype) {
    const listRoute = getDocumentRouteForDocType(doctype);
    const listLabel = documentConfigs[listRoute]?.title || doctype;
    const single = route.params.name === doctype;
    return [...list, ...(single ? [] : [{ label: listLabel, to: listRoute }]), { label: route.params.name ? String(route.params.name) : `New ${doctype}` }];
  }
  return list;
});

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
  await router.replace({ name: 'login' });
}
</script>

<template>
  <header class="topbar">
    <button class="icon-button menu-button" aria-label="Open navigation" @click="emit('toggleMenu')" data-testid="button-open-sidebar"><Menu :size="18" /></button>

    <nav class="breadcrumb" aria-label="Breadcrumb">
      <template v-for="(crumb, index) in crumbs" :key="`${index}-${crumb.label}`">
        <ChevronRight v-if="index > 0" :size="13" class="crumb-sep" />
        <RouterLink v-if="crumb.to" :to="crumb.to" class="crumb" :title="crumb.label" :style="crumb.color ? { '--c': `var(${crumb.color})` } : undefined">
          <span v-if="crumb.color" class="crumb-dot" /><span class="crumb-label">{{ crumb.label }}</span>
        </RouterLink>
        <span v-else :class="['crumb', { 'crumb--current': index === crumbs.length - 1 }]" :title="crumb.label" :style="crumb.color ? { '--c': `var(${crumb.color})` } : undefined" :aria-current="index === crumbs.length - 1 ? 'page' : undefined">
          <span v-if="crumb.color" class="crumb-dot" /><span class="crumb-label">{{ crumb.label }}</span>
        </span>
      </template>
    </nav>

    <button type="button" class="search-box" :aria-label="`Search (${searchShortcut})`" aria-keyshortcuts="Control+K Meta+K" data-testid="input-search" @click="layout.paletteOpen = true">
      <Search :size="15" />
      <span class="search-placeholder">Search or jump to…</span>
      <kbd>{{ searchShortcut }}</kbd>
    </button>

    <div class="top-actions">
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
  display: flex; align-items: center; gap: 14px;
  height: var(--topbar-height); padding: 0 28px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  backdrop-filter: saturate(1.4) blur(12px);
}
.breadcrumb { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; overflow: hidden; font-size: 13px; }
/* Earlier crumbs shrink first; the current page keeps its room and only truncates last. */
.crumb { display: inline-flex; min-width: 2.5em; flex: 0 1 auto; align-items: center; gap: 6px; color: var(--muted-foreground); white-space: nowrap; }
.crumb-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.crumb--current { min-width: 0; flex-shrink: 0; max-width: 70%; }
a.crumb { border-radius: var(--radius-sm); text-underline-offset: 3px; transition: color var(--dur-fast) var(--ease); }
a.crumb:hover .crumb-label { text-decoration: underline; }
a.crumb:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
a.crumb:hover { color: var(--foreground); }
.crumb--current { color: var(--foreground); font-weight: 600; }
.crumb-dot { width: 7px; height: 7px; flex: none; border-radius: 2px; background: var(--c); }
.crumb-sep { flex: none; color: var(--subtle-foreground); }

.search-box { display: flex; align-items: center; gap: 10px; width: 300px; height: 36px; padding: 0 6px 0 12px; color: var(--subtle-foreground); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--input-background); text-align: left; transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.search-box:hover { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); box-shadow: 0 0 0 3px var(--primary-softer); }
.search-placeholder { flex: 1; font-size: 13px; }
.search-box kbd { padding: 2px 6px; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: 5px; background: var(--muted); font: 500 11px var(--font-sans); }

.top-actions { display: flex; align-items: center; gap: 6px; }
.icon-button { position: relative; display: grid; width: 36px; height: 36px; place-items: center; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease); }
.icon-button:hover { color: var(--primary); background: var(--primary-softer); }
.icon-button.menu-button { display: none; }
.icon-swap-enter-active, .icon-swap-leave-active { transition: opacity var(--dur-fast) var(--ease); }
.icon-swap-enter-from, .icon-swap-leave-to { opacity: 0; }


.user-chip { display: flex; align-items: center; gap: 9px; margin-left: 4px; padding: 3px 8px 3px 3px; border: 1px solid transparent; border-radius: 999px; background: none; transition: background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease); }
.user-chip:hover { border-color: var(--border); background: var(--surface); }
.user-avatar { display: grid; width: 32px; height: 32px; flex: none; place-items: center; border-radius: 50%; object-fit: cover; color: #fff; background: linear-gradient(135deg, var(--primary), var(--accent)); font-size: 12px; font-weight: 700; }
.user-copy { display: flex; max-width: 150px; flex-direction: column; line-height: 1.25; text-align: left; }
.user-copy strong { overflow: hidden; color: var(--foreground); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.user-copy small { overflow: hidden; color: var(--subtle-foreground); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.user-caret { color: var(--subtle-foreground); }

.menu-user { display: flex; flex-direction: column; margin: -2px -2px 6px; padding: 4px 8px 10px; border-bottom: 1px solid var(--border); }
.menu-user strong { color: var(--foreground); font-size: 13px; }
.menu-user small { overflow: hidden; color: var(--subtle-foreground); font-size: 12px; text-overflow: ellipsis; }
.menu-item { display: flex; align-items: center; gap: 9px; width: 100%; height: 34px; padding: 0 8px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; font-size: 13px; text-align: left; }
.menu-item svg { color: var(--subtle-foreground); }
.menu-item:hover { background: var(--primary-soft); }
.menu-item:hover svg { color: var(--primary); }
.menu-item--danger { margin-top: 4px; color: var(--danger); }
.menu-item--danger svg { color: var(--danger); }
.menu-item--danger:hover { background: var(--danger-soft); }
.menu-theme { display: flex; align-items: center; gap: 4px; margin: 4px 0; padding: 4px 4px 4px 8px; color: var(--subtle-foreground); border-radius: var(--radius-md); background: var(--muted); }
.menu-theme svg { margin-right: 4px; color: var(--primary); }
.menu-theme button { flex: 1; height: 26px; color: var(--muted-foreground); border: 0; border-radius: 6px; background: none; font-size: 12px; text-transform: capitalize; }
.menu-theme button.selected { color: var(--foreground); background: var(--surface-elevated); box-shadow: var(--shadow-sm); font-weight: 600; }

@media (max-width: 1280px) { .search-box { width: 220px; } .user-copy { max-width: 120px; } }
@media (max-width: 1080px) { .search-box { width: 36px; padding: 0; justify-content: center; } .search-placeholder, .search-box kbd { display: none; } }
@media (max-width: 900px) {
  .topbar { padding: 0 16px; gap: 8px; }
  .icon-button.menu-button { display: grid; border: 0; background: none; }
  .user-copy, .user-caret { display: none; }
}
@media (max-width: 560px) { .breadcrumb .crumb:not(.crumb--current), .crumb-sep { display: none; } .crumb--current { max-width: 100%; } }
</style>
