import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '@/pages/DashboardPage.vue';
import ModulePage from '@/pages/ModulePage.vue';
import ListPage from '@/pages/ListPage.vue';
import DocumentPage from '@/pages/document/DocumentPage.vue';
import SettingsPage from '@/pages/SettingsPage.vue';
import ProfilePage from '@/pages/ProfilePage.vue';
import ModuleReportsPage from '@/pages/reports/ModuleReportsPage.vue';
import ReportPage from '@/pages/reports/ReportPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import { authGuard } from '@/router/auth-guard';
import { documentConfigs, legacyRedirects } from '@/config/navigation';
import { moduleRegistry } from '@/app/module-registry';

const moduleRoutes = moduleRegistry.flatMap((module) => [
  { path: module.route, component: ModulePage, meta: { moduleKey: module.key } },
  { path: module.reportsRoute, component: ModuleReportsPage, meta: { moduleKey: module.key } },
]);
const documentRoutes = Object.keys(documentConfigs).map((path) => ({
  path,
  component: ListPage,
  meta: { config: documentConfigs[path] },
}));
const redirects = Object.entries(legacyRedirects).map(([path, redirect]) => ({ path, redirect }));

/** Resolves to `top` as soon as the document can scroll that far (or after ~1.5s). */
function restoreScroll(top: number) {
  return new Promise<{ top: number }>((resolve) => {
    const started = performance.now();
    const check = () => {
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= top;
      if (reachable || performance.now() - started > 1500) resolve({ top });
      else requestAnimationFrame(check);
    };
    check();
  });
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { name: 'login', path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/', component: DashboardPage },
    ...redirects,
    ...moduleRoutes,
    ...documentRoutes,
    // Any DocType, including ones added to ERPNext later: list, new, and record pages from metadata.
    { name: 'document-list', path: '/list/:doctype', component: ListPage },
    { name: 'report', path: '/report/:report', component: ReportPage },
    { name: 'document-create', path: '/new/:doctype', component: DocumentPage, meta: { mode: 'create' } },
    { name: 'document-detail', path: '/record/:doctype/:name', component: DocumentPage },
    { name: 'document-edit', path: '/record/:doctype/:name/edit', redirect: (to) => ({ name: 'document-detail', params: to.params }) },
    { path: '/settings', component: SettingsPage },
    { path: '/profile', component: ProfilePage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to, from, savedPosition) => {
    // Back/forward: return to where the viewer was, once the page has grown tall enough
    // (lists load asynchronously). New pages start at the top.
    if (savedPosition) return restoreScroll(savedPosition.top);
    return to.path === from.path ? undefined : { top: 0 };
  },
});

router.beforeEach(authGuard);

export default router;
