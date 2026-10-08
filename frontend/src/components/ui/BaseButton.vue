<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'quiet' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}>(), { variant: 'quiet', size: 'md', loading: false, disabled: false, type: 'button' });
</script>

<template>
  <button :type="type" :disabled="loading || disabled" :aria-busy="loading || undefined" :class="['base-button', `base-button--${variant}`, `base-button--${size}`]" data-testid="button-action">
    <LoaderCircle v-if="loading" :size="14" class="spin" />
    <slot />
  </button>
</template>

<style scoped>
.base-button { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; border-radius: var(--radius-md); font-weight: 500; white-space: nowrap; transition: background-color .15s, border-color .15s, color .15s, box-shadow .15s, transform .08s; }
.base-button:active:not(:disabled) { transform: translateY(1px); }
.base-button:disabled { cursor: not-allowed; opacity: .55; }
.base-button--xs { height: 28px; padding: 0 10px; font-size: 12px; }
.base-button--sm { height: 32px; padding: 0 12px; font-size: 13px; }
.base-button--md { height: 36px; padding: 0 16px; font-size: 13px; }

/* Primary: the one main action on a surface */
.base-button--primary { color: var(--primary-foreground); background: var(--primary-gradient); box-shadow: var(--shadow-primary), inset 0 1px 0 rgba(255, 255, 255, .18); font-weight: 600; }
.base-button--primary:hover:not(:disabled) { filter: brightness(1.06); }

/* Secondary: positive confirmation (Submit) */
.base-button--secondary { color: #fff; background: var(--secondary); box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, .15); font-weight: 600; }
.base-button--secondary:hover:not(:disabled) { background: var(--secondary-hover); }

/* Quiet: neutral secondary action */
.base-button--quiet { color: var(--foreground); border-color: var(--border); background: var(--surface); box-shadow: var(--shadow-sm); }
.base-button--quiet:hover:not(:disabled) { border-color: var(--border-strong); background: var(--muted); }

/* Outline: accent-tinted secondary action */
.base-button--outline { color: var(--primary-soft-foreground); border-color: color-mix(in srgb, var(--primary) 35%, transparent); background: var(--primary-softer); }
.base-button--outline:hover:not(:disabled) { background: var(--primary-soft); }

/* Ghost: toolbar / inline action */
.base-button--ghost { color: var(--muted-foreground); background: transparent; }
.base-button--ghost:hover:not(:disabled) { color: var(--foreground); background: var(--muted); }

/* Danger: destructive action */
.base-button--danger { color: var(--danger); border-color: var(--border); background: var(--surface); box-shadow: var(--shadow-sm); }
.base-button--danger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--danger) 45%, transparent); background: var(--danger-soft); }
</style>
