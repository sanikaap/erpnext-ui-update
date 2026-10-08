import { onMounted, watch } from 'vue';
import { useThemeStore } from '@/stores/theme';

export function useTheme() {
  const theme = useThemeStore();
  onMounted(() => theme.initialize());
  watch(() => theme.isDark, () => theme.initialize());
  return theme;
}