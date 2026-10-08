import { ref } from 'vue';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'secondary';
}

// One dialog for the app, rendered by ConfirmHost; callers just await confirm().
const request = ref<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);

export function useConfirm() {
  function confirm(options: ConfirmRequest) {
    request.value?.resolve(false);
    return new Promise<boolean>((resolve) => { request.value = { ...options, resolve }; });
  }
  function settle(ok: boolean) {
    request.value?.resolve(ok);
    request.value = null;
  }
  return { request, confirm, settle };
}
