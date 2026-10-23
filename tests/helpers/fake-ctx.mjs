// ctx ปลอมสำหรับทดสอบ render.js — บันทึกทุกการเรียกเมธอดและการตั้งค่า property
export function createFakeCtx() {
  const calls = [];
  const sets = [];
  const state = {
    font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
  };
  const fontPx = () => {
    const m = /(\d+(?:\.\d+)?)px/.exec(state.font);
    return m ? Number(m[1]) : 10;
  };
  const gradient = () => ({ stops: [], addColorStop(o, c) { this.stops.push([o, c]); } });
  const methods = {
    measureText(text) {
      const f = fontPx();
      return { width: String(text).length * 0.55 * f, actualBoundingBoxAscent: 0.8 * f, actualBoundingBoxDescent: 0.25 * f };
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  };
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'calls') return calls;
      if (k === 'sets') return sets;
      if (k in state) return state[k];
      if (k === 'then') return undefined;
      return (...args) => {
        calls.push({ name: k, args, font: state.font });
        return methods[k] ? methods[k](...args) : undefined;
      };
    },
    set(_, k, v) {
      sets.push({ name: k, value: v });
      state[k] = v;
      return true;
    },
    has(_, k) { return k in state || k in methods || k === 'roundRect'; },
  });
  return ctx;
}
