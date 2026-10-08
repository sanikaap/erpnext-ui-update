import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

// One queue for the whole app, rendered by ToastHost in the shell.
const toasts = ref<ToastMessage[]>([]);
let nextId = 0;

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function push(tone: ToastTone, title: string, description?: string, timeout = tone === 'error' ? 7000 : 3500) {
  const id = (nextId += 1);
  toasts.value = [...toasts.value.slice(-3), { id, tone, title, description }];
  window.setTimeout(() => dismiss(id), timeout);
  return id;
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title: string, description?: string) => push('success', title, description),
    error: (title: string, description?: string) => push('error', title, description),
    info: (title: string, description?: string) => push('info', title, description),
    warning: (title: string, description?: string) => push('warning', title, description),
  };
}
