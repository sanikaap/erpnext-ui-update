<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, Boxes, HeartHandshake } from 'lucide-vue-next';
import { appHome, appOptions, selectApp, selectedApp, type AppKey } from '@/app/app-context';

const route = useRoute();
const router = useRouter();
const icons = { erpnext: Boxes, ngo: HeartHandshake } as const;

async function choose(key: AppKey) {
  const option = appOptions.find((entry) => entry.key === key)!;
  selectApp(key);
  // Only honour a redirect that belongs to the chosen app (the guard re-checks it anyway).
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  const useRedirect = redirect && redirect !== '/' && (key === 'ngo') === redirect.startsWith('/ngo');
  await router.replace(useRedirect ? redirect : option.home);
}
</script>

<template>
  <main class="select-page">
    <section class="select-card">
      <div class="select-top">
        <div class="select-brand"><span class="brand-mark"><span /></span>Workspace</div>
        <RouterLink v-if="selectedApp" :to="appHome" class="select-back" data-testid="link-back-to-app"><ArrowLeft :size="14" />Back to {{ selectedApp.label }}</RouterLink>
      </div>
      <div>
        <h1>Where do you want to work?</h1>
        <p class="select-hint">Choose an app. You can switch any time from the workspace menu at the top of the sidebar.</p>
      </div>
      <div class="options">
        <button
          v-for="option in appOptions"
          :key="option.key"
          type="button"
          :class="['option', `option--${option.key}`, { current: selectedApp?.key === option.key }]"
          :data-testid="`button-select-app-${option.key}`"
          @click="choose(option.key)"
        >
          <span class="option-icon"><component :is="icons[option.key]" :size="22" /></span>
          <span class="option-copy"><strong>{{ option.label }}</strong></span>
          <ArrowRight :size="18" class="option-arrow" />
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.select-page { display: grid; min-height: 100dvh; padding: 24px 16px; place-items: center; background: var(--background); }
.select-card { display: flex; width: 100%; max-width: 560px; flex-direction: column; gap: 20px; padding: 32px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.select-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.select-back { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 12.5px; font-weight: 500; transition: color .15s, border-color .15s; }
.select-back:hover { color: var(--foreground); border-color: var(--primary); }
.select-back:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.select-brand { display: flex; align-items: center; gap: 10px; color: var(--foreground); font-size: 15px; font-weight: 600; }
.brand-mark { position: relative; display: grid; width: 26px; height: 26px; place-items: center; border-radius: var(--radius-sm); background: var(--primary); }
.brand-mark span { width: 10px; height: 10px; border: 2px solid var(--primary-foreground); border-radius: 2px; transform: rotate(45deg); }
h1 { color: var(--foreground); font-family: var(--font-display); font-size: 24px; font-weight: 700; letter-spacing: -.015em; }
.select-hint { margin-top: 4px; color: var(--muted-foreground); font-size: 13px; }
.options { display: flex; flex-direction: column; gap: 12px; }
.option { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px; text-align: left; color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; }
.option:hover { border-color: var(--primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.option:focus-visible { outline: 0; border-color: var(--primary); box-shadow: var(--focus-glow); }
.option.current { border-color: var(--primary); }
.option-icon { display: grid; width: 44px; height: 44px; flex: none; place-items: center; color: var(--primary); border-radius: var(--radius-md); background: color-mix(in srgb, var(--primary) 12%, transparent); }
.option--ngo .option-icon { color: var(--secondary); background: color-mix(in srgb, var(--secondary) 14%, transparent); }
.option-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.option-copy strong { font-size: 15px; font-weight: 600; }
.option-arrow { flex: none; color: var(--muted-foreground); }
@media (max-width: 480px) { .select-card { padding: 20px; } }
</style>
