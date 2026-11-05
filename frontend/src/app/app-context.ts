import { computed, ref } from 'vue';

/*
 * Which app the user chose to work in after signing in. The sidebar, ⌘K palette and
 * home page only show the modules of that app (navigation `workspace`).
 */
export type AppKey = 'erpnext' | 'ngo';

export interface AppOption {
  key: AppKey;
  label: string;
  /** Navigation workspace (see config/navigation.ts) whose modules belong to this app. */
  workspace: string;
  description: string;
  /** Page the app opens on. */
  home: string;
}

export const appOptions: AppOption[] = [
  { key: 'erpnext', label: 'ERPNext', workspace: 'ERPNext', description: 'CRM, selling, buying, accounts, stock, manufacturing, HR and more.', home: '/' },
  { key: 'ngo', label: 'NGO', workspace: 'NGO', description: 'Projects, programmes, beneficiaries, centres, donors, expenses and impact.', home: '/ngo/projects/' },
];

const STORAGE_KEY = 'erp-selected-app';

function read(): AppKey | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return appOptions.some((option) => option.key === value) ? (value as AppKey) : null;
  } catch {
    return null;
  }
}

const selected = ref<AppKey | null>(read());

export const selectedApp = computed(() => appOptions.find((option) => option.key === selected.value) ?? null);

export function selectApp(key: AppKey) {
  selected.value = key;
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* keep in memory only */ }
}

export function clearSelectedApp() {
  selected.value = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Home page of the selected app ('/' when none is chosen). */
export const appHome = computed(() => selectedApp.value?.home ?? '/');
