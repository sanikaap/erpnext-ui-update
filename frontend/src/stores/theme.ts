import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ThemePreference } from '@/types/erp';

function readPreference(): ThemePreference | null {
  try { return localStorage.getItem('arcway-theme') as ThemePreference | null; } catch { return null; }
}

export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readPreference() || 'light');
  const systemPrefersDark = ref(false);
  const isDark = computed(() => preference.value === 'dark' || (preference.value === 'system' && systemPrefersDark.value));
  let mediaQuery: MediaQueryList | null = null;

  function setTheme(next: ThemePreference) {
    preference.value = next;
    try { localStorage.setItem('arcway-theme', next); } catch { /* storage unavailable: preference lasts this session */ }
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value);
  }

  function initialize() {
    if (typeof window === 'undefined' || mediaQuery) return;
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.value = mediaQuery.matches;
    mediaQuery.addEventListener('change', ({ matches }) => {
      systemPrefersDark.value = matches;
      if (preference.value === 'system') applyTheme();
    });
    applyTheme();
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  return { preference, isDark, setTheme, toggleTheme, initialize };
});