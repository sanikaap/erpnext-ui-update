import { computed, ref } from 'vue';
import { authApi } from '@/services/auth-api';

interface CurrentUser {
  id: string;
  fullName: string;
  email?: string;
  image?: string;
}

// Shared across components so the session user is fetched once per page load.
const user = ref<CurrentUser | null>(null);
let pending: Promise<void> | null = null;

async function fetchUser() {
  const session = await authApi.checkSession();
  if (!session.authenticated || !session.user) return;
  const id = String(session.user);
  user.value = { id, fullName: id };
  try {
    const profile = (await authApi.getUser(id)).data as { full_name?: string; email?: string; user_image?: string };
    user.value = { id, fullName: profile.full_name || id, email: profile.email, image: profile.user_image || undefined };
  } catch {
    // The User record may be unreadable for restricted roles; the session id is still a usable name.
  }
}

export function useCurrentUser() {
  if (!pending) pending = fetchUser().catch(() => undefined);
  const initials = computed(() => {
    const parts = (user.value?.fullName || '').split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  });
  const firstName = computed(() => user.value?.fullName.split(/\s+/)[0] || '');
  return { user, initials, firstName };
}
