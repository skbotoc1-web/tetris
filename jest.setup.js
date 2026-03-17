// Mock window for node environment
global.window = {
  document: {
    getElementById: (id) => null,
    addEventListener: (evt, fn) => {},
    removeEventListener: () => {},
    createElement: (tag) => ({ style: {}, dataset: {}, classList: { add: () => {}, remove: () => {} } })
  },
  AudioContext: class { constructor() { this.state = 'running'; } resume() { this.state = 'running'; } },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  navigator: { vibrate: () => {} },
  localStorage: {
    _data: {},
    getItem: (k) => this._data[k] ?? null,
    setItem: (k, v) => { this._data[k] = String(v); },
    removeItem: (k) => delete this._data[k],
    clear: () => { this._data = {}; }
  },
  addEventListener: (evt, fn) => {},
  removeEventListener: () => {}
};

global.document = global.window.document;
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;
global.AudioContext = global.window.AudioContext;
global.webkitAudioContext = global.window.AudioContext;
global.navigator = global.window.navigator;
global.localStorage = global.window.localStorage;