export function linseg(s, ...args) {
  let [v, ...rest] = args;
  let a = 0;
  let lerp = (a, b, n) => n * (b - a) + a;
  while (a < rest.length) {
    const dur = rest[a];
    const next = rest[a + 1];
    if (s < dur) {
      return lerp(v, next, s / dur);
    }
    s -= dur;
    v = next;
    a += 2;
  }
  return args[args.length - 1];
}

export let adsr = (t, a, d, s, r, sustainTime) => linseg(t, 0, a, 1, d, s, sustainTime, s, r, 0);
export let buf = (seconds, fn, sr = 44100) => {
  return Array.from({ length: sr * seconds }, (_, i) => fn(i / sr));
};

export let sin = (t, f) => Math.sin(f * t * 2 * Math.PI);
export let saw = (t, f) => (((f * t) % 1) - 0.5) * 2;
