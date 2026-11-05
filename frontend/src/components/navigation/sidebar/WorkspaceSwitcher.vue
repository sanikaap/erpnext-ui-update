<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ArrowLeftRight, Boxes, Check, ChevronsUpDown, HeartHandshake, LayoutGrid } from 'lucide-vue-next';
import { appOptions, selectApp, selectedApp, type AppKey } from '@/app/app-context';

/**
 * Sidebar workspace switcher: shows the app you are in (ERPNext / NGO), switches to
 * the other one in one click, and links back to the workspace chooser.
 * `compact`: icon-only trigger for the rail.
 */
defineProps<{ compact: boolean }>();
const emit = defineEmits<{ navigate: []; tip: [label: string, event: Event]; hideTip: [] }>();
const router = useRouter();
const icons = { erpnext: Boxes, ngo: HeartHandshake } as const;

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function onDocument(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}
watch(open, (value) => {
  if (value) {
    emit('hideTip');
    window.setTimeout(() => document.addEventListener('mousedown', onDocument));
    window.addEventListener('keydown', onKey);
  } else {
    document.removeEventListener('mousedown', onDocument);
    window.removeEventListener('keydown', onKey);
  }
});
onBeforeUnmount(() => { open.value = false; });

async function switchTo(key: AppKey) {
  open.value = false;
  if (selectedApp.value?.key === key) return;
  const option = appOptions.find((entry) => entry.key === key)!;
  selectApp(key);
  emit('navigate');
  await router.push(option.home);
}
</script>

<template>
  <div ref="root" :class="['ws', { compact }]">
    <button
      type="button"
      class="ws-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="`Workspace: ${selectedApp?.label ?? 'none'}. Switch workspace`"
      data-testid="button-workspace-switcher"
      @click="open = !open"
      @mouseenter="compact && !open && emit('tip', 'Switch workspace', $event)" @mouseleave="emit('hideTip')"
      @focus="compact && !open && emit('tip', 'Switch workspace', $event)" @blur="emit('hideTip')"
    >
      <span :class="['ws-icon', `ws-icon--${selectedApp?.key ?? 'none'}`]"><component :is="selectedApp ? icons[selectedApp.key] : LayoutGrid" :size="16" /></span>
      <template v-if="!compact">
        <span class="ws-copy"><small>Workspace</small><strong>{{ selectedApp?.label ?? 'Choose app' }}</strong></span>
        <ChevronsUpDown :size="15" class="ws-caret" />
      </template>
    </button>

    <Transition name="ws-pop">
      <div v-if="open" class="ws-menu" role="menu" aria-label="Switch workspace">
        <p class="ws-menu-title">Switch workspace</p>
        <button
          v-for="option in appOptions"
          :key="option.key"
          type="button"
          role="menuitemradio"
          :aria-checked="selectedApp?.key === option.key"
          :class="['ws-option', { current: selectedApp?.key === option.key }]"
          :data-testid="`button-switch-workspace-${option.key}`"
          @click="switchTo(option.key)"
        >
          <span :class="['ws-icon', `ws-icon--${option.key}`]"><component :is="icons[option.key]" :size="15" /></span>
          <span class="ws-option-copy"><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
          <Check v-if="selectedApp?.key === option.key" :size="15" class="ws-check" />
        </button>
        <div class="ws-sep" role="separator" />
        <RouterLink :to="{ name: 'select-app' }" class="ws-all" role="menuitem" data-testid="link-all-workspaces" @click="open = false; emit('navigate')">
          <ArrowLeftRight :size="14" />Back to workspaces
        </RouterLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ws { position: relative; flex: none; padding: 10px 10px 0; }
.ws.compact { display: flex; justify-content: center; padding: 10px 0 0; }

.ws-trigger { display: flex; align-items: center; gap: 10px; width: 100%; height: 46px; padding: 0 10px 0 7px; color: var(--nav-fg); border: 1px solid var(--nav-border); border-radius: 10px; background: var(--nav-hover); text-align: left; transition: border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease); }
.ws-trigger:hover, .ws-trigger[aria-expanded='true'] { border-color: color-mix(in srgb, var(--nav-accent) 45%, var(--nav-border)); background: var(--nav-active-bg); }
.ws-trigger:focus-visible { outline: 2px solid var(--nav-accent); outline-offset: -2px; }
.compact .ws-trigger { justify-content: center; width: 42px; height: 42px; padding: 0; }

.ws-icon { display: grid; width: 30px; height: 30px; flex: none; place-items: center; color: var(--primary); border-radius: 8px; background: color-mix(in srgb, var(--primary) 16%, transparent); }
.ws-icon--ngo { color: var(--secondary); background: color-mix(in srgb, var(--secondary) 18%, transparent); }
.ws-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; line-height: 1.2; }
.ws-copy small { color: var(--nav-subtle); font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.ws-copy strong { overflow: hidden; color: var(--nav-active-fg); font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.ws-caret { flex: none; color: var(--nav-subtle); }

.ws-menu { position: absolute; z-index: 60; top: calc(100% + 6px); left: 10px; width: 280px; max-width: calc(100vw - 32px); padding: 8px; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); box-shadow: var(--shadow-lg); }
.compact .ws-menu { left: 12px; }
.ws-menu-title { padding: 4px 8px 8px; color: var(--subtle-foreground); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.ws-option { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 8px; color: var(--foreground); border: 0; border-radius: var(--radius-md); background: none; text-align: left; }
.ws-option:hover, .ws-option:focus-visible { outline: 0; background: var(--muted); }
.ws-option.current { background: var(--primary-softer, var(--muted)); }
.ws-option-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.ws-option-copy strong { font-size: 13px; font-weight: 600; }
.ws-option-copy small { color: var(--muted-foreground); font-size: 11.5px; line-height: 1.35; }
.ws-check { flex: none; margin-top: 7px; color: var(--primary); }
.ws-sep { height: 1px; margin: 6px 0; background: var(--border); }
.ws-all { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 8px; color: var(--muted-foreground); border-radius: var(--radius-md); font-size: 13px; font-weight: 500; }
.ws-all:hover, .ws-all:focus-visible { outline: 0; color: var(--foreground); background: var(--muted); }

.ws-pop-enter-active, .ws-pop-leave-active { transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease); }
.ws-pop-enter-from, .ws-pop-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
