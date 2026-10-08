import type { NavigationGuard } from 'vue-router';
import { authApi } from '@/services/auth-api';

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
  return authenticated ? true : { name: 'login', query: { redirect: to.fullPath } };
};
