import { AsyncLocalStorage } from "node:async_hooks";

export type AuthRequestState = {
  failed: boolean;
  deadline?: number;
  rsc?: boolean;
  verifiedUsers?: Map<string, Promise<Response>>;
};
// The Node entry and separately bundled App Router share the container, never
// the state: each HTTP request owns its deadline and outage result.
const key = Symbol.for("riparim.auth.request-context");
const contexts =
  (Reflect.get(globalThis, key) as
    AsyncLocalStorage<AuthRequestState> | undefined) ??
  new AsyncLocalStorage<AuthRequestState>();
Reflect.set(globalThis, key, contexts);
export function withAuthRequest<T>(run: () => T, rsc = false) {
  return contexts.run({ failed: false, rsc }, run);
}
export function authRequestState(): AuthRequestState {
  return contexts.getStore() ?? { failed: false };
}
