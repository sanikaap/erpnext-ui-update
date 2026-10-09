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
.base-button { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; border-radius: var(--radius-md); font-weight: 500; white-space: nowrap; transition: background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease), filter var(--dur-fast) var(--ease), transform 80ms var(--ease); }
.base-button:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.base-button:active:not(:disabled) { transform: translateY(1px); }
.base-button:disabled { cursor: not-allowed; opacity: .5; box-shadow: none; filter: none; }
.base-button[aria-busy='true'] { cursor: progress; }
.base-button--xs { height: 28px; padding: 0 10px; font-size: 12px; }
.base-button--sm { height: var(--control-height-sm); padding: 0 12px; font-size: var(--text-base); }
.base-button--md { height: var(--control-height); padding: 0 16px; font-size: var(--text-base); }

/* Primary: the one main action on a surface. Solid teal, no glow. */
.base-button--primary { color: var(--primary-foreground); background: var(--primary); box-shadow: var(--shadow-primary); font-weight: 600; }
.base-button--primary:hover:not(:disabled) { background: var(--primary-hover); }
.base-button--primary:active:not(:disabled) { background: var(--primary-strong); }

/* Secondary: positive confirmation (Submit) */
.base-button--secondary { color: var(--secondary-foreground); background: var(--secondary); box-shadow: var(--shadow-sm); font-weight: 600; }
.base-button--secondary:hover:not(:disabled) { background: var(--secondary-hover); }
.base-button--secondary:active:not(:disabled) { background: var(--secondary); }

/* Quiet: neutral secondary action (white surface, dark text, subtle border) */
.base-button--quiet { color: var(--foreground); border-color: var(--input-border); background: var(--surface); box-shadow: var(--shadow-sm); }
.base-button--quiet:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-2); }
.base-button--quiet :deep(svg), .base-button--ghost :deep(svg) { color: var(--icon-foreground); transition: color var(--dur-fast) var(--ease); }
.base-button--quiet:hover:not(:disabled) :deep(svg), .base-button--ghost:hover:not(:disabled) :deep(svg) { color: var(--primary); }
.base-button--quiet:active:not(:disabled), .base-button--ghost:active:not(:disabled) { background: var(--border); }

/* Outline: accent-tinted secondary action */
.base-button--outline { color: var(--primary-soft-foreground); border-color: color-mix(in srgb, var(--primary) 35%, transparent); background: var(--primary-softer); }
.base-button--outline:hover:not(:disabled), .base-button--outline:active:not(:disabled) { background: var(--primary-soft); }

/* Ghost: toolbar / inline action */
.base-button--ghost { color: var(--muted-foreground); background: transparent; }
.base-button--ghost:hover:not(:disabled) { color: var(--foreground); background: var(--muted); }

/* Danger: destructive action */
.base-button--danger { color: var(--danger-soft-foreground); border-color: var(--input-border); background: var(--surface); box-shadow: var(--shadow-sm); }
.base-button--danger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--danger) 45%, transparent); background: var(--danger-soft); }
</style>
