// js/state.js
// Tiny pub-sub store. Holds current user and ephemeral UI state (filters, cart).

const _state = {
  user: null,
  data: { cart: {} },
};

const _listeners = new Map(); // key -> Set<fn>

export const state = {
  get user() { return _state.user; },

  setUser(u) {
    _state.user = u;
    state.emit("user");
  },

  get(key) { return _state.data[key]; },
  set(key, value) {
    _state.data[key] = value;
    state.emit(key);
  },

  on(key, fn) {
    if (!_listeners.has(key)) _listeners.set(key, new Set());
    _listeners.get(key).add(fn);
    return () => _listeners.get(key)?.delete(fn);
  },

  emit(key) {
    const subs = _listeners.get(key);
    if (subs) subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
