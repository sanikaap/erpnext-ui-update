import type { NavigationGuard } from 'vue-router';
import { authApi } from '@/services/auth-api';
import { selectedApp } from '@/app/app-context';

// Cached so the session is checked with Frappe once, not on every navigation.
let authenticated: boolean | null = null;

export function markAuthenticated() {
  authenticated = true;
}

export function markLoggedOut() {
  authenticated = false;
}

export const authGuard: NavigationGuard = async (to) => {
  if (to.meta.public) return true;
  if (authenticated === null) authenticated = (await authApi.checkSession()).authenticated;
  if (!authenticated) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.name === 'select-app') return true;
  // Signed in but no app chosen yet: ask first (ERPNext or NGO).
  if (!selectedApp.value) return { name: 'select-app', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  // Each app has its own home page.
  if (to.path === '/' && selectedApp.value.home !== '/') return selectedApp.value.home;
  return true;
};
