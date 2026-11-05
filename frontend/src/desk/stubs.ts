/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Desk form scripts reach into a very large API surface. What affects a document is
 * implemented for real; purely cosmetic Desk internals (DOM tweaks on Desk's own markup)
 * land on these stubs, so a script keeps running instead of failing on a call that has
 * no meaning in the Vue form.
 */
const reported = new Set<string>();

export function stub(path: string): any {
  const stored = new Map<PropertyKey, unknown>();
  const target = function () { /* callable */ };
  const proxy: any = new Proxy(target, {
    get(fn, key) {
      if (key === 'prototype') return (fn as any).prototype;
      if (stored.has(key)) return stored.get(key);
      if (key === 'then' || key === 'catch' || key === 'finally' || typeof key === 'symbol') return undefined;
      if (key === 'length') return 0;
      if (key === 'toString' || key === 'valueOf') return () => '';
      const child = stub(`${path}.${String(key)}`);
      stored.set(key, child);
      return child;
    },
    set(_fn, key, value) { stored.set(key, value); return true; },
    has(_fn, key) { return stored.has(key); },
    deleteProperty(_fn, key) { stored.delete(key); return true; },
    apply() {
      if (!reported.has(path)) { reported.add(path); console.debug(`[desk] no-op: ${path}()`); }
      return stub(`${path}()`);
    },
    construct(_fn, _args, newTarget) {
      // `new Stub()` gives another stub, so its methods can be called. A script class that
      // extends a stub keeps its own prototype chain.
      if (newTarget === proxy) return stub(`new ${path}`);
      return Reflect.construct(function () { /* base */ }, [], newTarget);
    },
  });
  return proxy;
}

/** An object with real members; anything else resolves to a stub. */
export function namespace<T extends object>(members: T, path: string): T & Record<string, any> {
  const children = new Map<PropertyKey, unknown>();
  return new Proxy(members, {
    get(obj, key, receiver) {
      if (key in obj) return Reflect.get(obj, key, receiver);
      if (children.has(key)) return children.get(key);
      if (key === 'then' || typeof key === 'symbol') return undefined;
      const child = stub(`${path}.${String(key)}`);
      children.set(key, child);
      return child;
    },
  }) as T & Record<string, any>;
}
