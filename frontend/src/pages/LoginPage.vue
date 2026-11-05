<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Boxes, LogIn, ShieldCheck, Workflow } from 'lucide-vue-next';
import { authApi } from '@/services/auth-api';
import { FrappeApiError } from '@/services/erpnext-api';
import { markAuthenticated } from '@/router/auth-guard';
import { clearSelectedApp } from '@/app/app-context';
import BaseButton from '@/components/ui/BaseButton.vue';

const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    await authApi.login(username.value, password.value);
    markAuthenticated();
    // Every sign-in starts on the app picker (ERPNext or NGO).
    clearSelectedApp();
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    await router.replace({ name: 'select-app', query: redirect && redirect !== '/' ? { redirect } : {} });
  } catch (cause) {
    error.value = cause instanceof FrappeApiError && cause.status === 401
      ? 'Incorrect username or password.'
      : 'Unable to reach ERPNext. Check that the Frappe server is running.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section class="brand-panel" aria-hidden="true">
      <div class="login-brand"><span class="brand-mark"><span /></span>ERPNext</div>
      <div class="brand-copy">
        <h2>Run the whole business from one calm, fast workspace.</h2>
        <ul>
          <li><span class="tone-violet"><Boxes :size="15" /></span><div><strong>Every module, one interface</strong><small>CRM, selling, stock, accounts and more.</small></div></li>
          <li><span class="tone-slate"><Workflow :size="15" /></span><div><strong>Live ERPNext data</strong><small>Your DocTypes, workflows and rules — unchanged.</small></div></li>
          <li><span class="tone-slate"><ShieldCheck :size="15" /></span><div><strong>Your permissions apply</strong><small>You see exactly what ERPNext allows.</small></div></li>
        </ul>
      </div>
      <p class="brand-foot">Powered by Frappe &amp; ERPNext</p>
    </section>
    <section class="form-panel">
      <form class="login-card" @submit.prevent="submit" data-testid="form-login">
        <div class="login-brand login-brand--compact"><span class="brand-mark"><span /></span>ERPNext</div>
        <div><h1>Welcome back</h1><p class="login-hint">Sign in with your ERPNext user account.</p></div>
        <label>Username or email<input v-model="username" autocomplete="username" required data-testid="input-username" /></label>
        <label>Password<input v-model="password" type="password" autocomplete="current-password" required data-testid="input-password" /></label>
        <p v-if="error" class="login-error" role="alert">{{ error }}</p>
        <BaseButton type="submit" variant="primary" :loading="loading" class="login-submit"><LogIn :size="15" />Sign in</BaseButton>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100dvh; background: var(--background); }
.login-card { padding: 32px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-md); }
.brand-panel {
  position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 32px; overflow: hidden;
  padding: 40px 48px; border-right: 1px solid var(--border);
  background: var(--surface);
}
/* Fine dot grid, faded toward the edges. */
.brand-panel::before {
  position: absolute; inset: 0; content: '';
  background-image: radial-gradient(color-mix(in srgb, var(--foreground) 10%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse at 40% 45%, #000 20%, transparent 75%);
  pointer-events: none;
}
.brand-panel > * { position: relative; }
.login-brand { display: flex; align-items: center; gap: 10px; color: var(--foreground); font-size: 15px; font-weight: 600; }
.login-brand--compact { display: none; }
.brand-mark { position: relative; display: grid; width: 26px; height: 26px; place-items: center; border-radius: var(--radius-sm); background: var(--primary); }
.brand-mark span { width: 10px; height: 10px; border: 2px solid var(--primary-foreground); border-radius: 2px; transform: rotate(45deg); }
.brand-mark::after { position: absolute; right: -2px; bottom: -2px; width: 8px; height: 8px; content: ''; border: 2px solid var(--surface); border-radius: 50%; background: var(--secondary); }
.brand-copy { max-width: 440px; }
.brand-copy h2 { color: var(--foreground); font-family: var(--font-display); font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1.18; }
.brand-copy ul { display: flex; flex-direction: column; gap: 18px; margin: 32px 0 0; padding: 0; list-style: none; }
.brand-copy li { display: flex; align-items: flex-start; gap: 12px; }
.brand-copy li > span { display: grid; width: 32px; height: 32px; flex: none; place-items: center; border-radius: var(--radius-md); }
.brand-copy li div { display: flex; flex-direction: column; gap: 2px; }
.brand-copy strong { color: var(--foreground); font-size: 14px; font-weight: 500; }
.brand-copy small { color: var(--muted-foreground); font-size: 13px; }
.brand-foot { color: var(--subtle-foreground); font-size: 12px; }

.form-panel { display: grid; padding: 24px 16px; place-items: center; }
.login-card { display: flex; width: 100%; max-width: 400px; flex-direction: column; gap: 16px; }
.login-card h1 { color: var(--foreground); font-family: var(--font-display); font-size: 24px; font-weight: 700; letter-spacing: -.015em; }
.login-hint { margin-top: 4px; color: var(--muted-foreground); font-size: 13px; }
.login-card label { display: flex; flex-direction: column; gap: 6px; color: var(--foreground); font-size: 12.5px; font-weight: 500; }
.login-card input { height: 40px; padding: 0 12px; color: var(--foreground); border: 1px solid var(--input-border); border-radius: var(--radius-md); outline: 0; background: var(--surface); box-shadow: var(--shadow-sm); font-size: 13.5px; transition: border-color .15s, box-shadow .15s; }
.login-card input:hover { border-color: var(--border-strong); }
.login-card input:focus { border-color: var(--primary); box-shadow: var(--focus-glow); }
.login-error { padding: 8px 10px; color: var(--danger); border-radius: var(--radius-md); background: var(--danger-soft); font-size: 12.5px; }
.login-submit { width: 100%; height: 40px; margin-top: 4px; }

@media (max-width: 900px) {
  .login-page { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
  .login-brand--compact { display: flex; margin-bottom: 8px; }
}
</style>
