// Mock window for node environment
const _store = {};

global.window = {
  document: {
    getElementById: (_id) => null,
    addEventListener: (_evt, _fn) => {},
    removeEventListener: () => {},
    createElement: (_tag) => ({ style: {}, dataset: {}, classList: { add: () => {}, remove: () => {} } })
  },
  AudioContext: class { constructor() { this.state = 'running'; } resume() { this.state = 'running'; } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  navigator: { vibrate: () => {} },
  localStorage: {
    getItem: (k) => (_store[k] ?? null),
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); }
  },
  addEventListener: (_evt, _fn) => {},
  removeEventListener: () => {}
};

global.document = global.window.document;
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;
global.AudioContext = global.window.AudioContext;
global.webkitAudioContext = global.window.AudioContext;
global.navigator = global.window.navigator;
global.localStorage = global.window.localStorage;
// Prevent auto-boot in test environment
global.__TETRIS_NO_BOOT__ = true;
