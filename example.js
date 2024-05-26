import fs from 'fs';
import itwriter from 'itwriter';
import { midiToFreq, tokenizeNote, evalScope } from '@strudel/core';
import '@strudel/tonal';
import { midi2note } from '@strudel/tonal/tonleiter.mjs';
import { buf, adsr, sin, saw } from './dsp.js';
import { evaluate } from '@strudel/transpiler';

await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'));

async function pattern2it(code, cycles) {
  let f = midiToFreq(72); // 72 = c5 seems to match
  const _sine = buf(1, (t) => sin(t, f) * adsr(t, 0.1, 0.1, 0.5, 0.1, 1));
  const sawtooth = buf(1, (t) => saw(t, f) * adsr(t, 0.01, 0.1, 0.5, 0.1, 1));
  const samples = [
    {
      // samples can be stereo or mono floating point format
      filename: 'sine.wav',
      name: 'sine',
      samplerate: 44100,
      channels: [_sine, _sine], // stereo
    },
    {
      // samples can be stereo or mono floating point format
      filename: 'sawtooth.wav',
      name: 'sawtooth',
      samplerate: 44100,
      channels: [sawtooth, sawtooth], // stereo
    },
  ];

  const { pattern } = await evaluate(code);

  const rowsPerCycle = 32;
  let ticks = 3; // ticks per row
  const rows = rowsPerCycle * cycles;

  const haps = pattern.sortHapsByPart().queryArc(0, cycles);
  console.log(haps.map((h) => h.show(true)));

  let channels = [];

  haps.forEach((hap) => {
    let _note = hap.value.note;
    if (typeof _note === 'number') {
      _note = midi2note(hap.value.note);
    }
    const [letter, acc, oct] = tokenizeNote(_note);
    const pc = letter.toUpperCase() + acc;
    const note = `${pc.padEnd(2, '-')}${oct || 3}`;
    const rowIndex = Math.round(hap.whole.begin * rowsPerCycle);
    const instrument = samples.findIndex((sample) => sample.name === hap.value.s);
    const velocity = hap.value.velocity ?? 1;
    const vol = `v${Math.round(velocity * 64)}` || 'v64';
    // very simple voice allocation.. (ignores event duration so far)
    let channelIndex = channels.findIndex((channel) => !channel[rowIndex]);
    if (channelIndex === -1) {
      channelIndex = channels.length;
      channels.push({});
    }
    channels[channelIndex][rowIndex] = {
      note,
      instrument,
      vol,
    };
  });

  /* Create an impulse tracker file from JSON structure. */
  return itwriter({
    title: 'itwriter example', // track title
    bpm: 120, // how fast to play in bpm
    ticks, // how many ticks to fit in each row
    message: 'hello!\n\nthis is my song message.', // optional embedded message
    samples,
    channelnames: {
      // zero-indexed channel names (optional)
      1: 'thingo',
    },
    order: [0, 0, 0], // what order to play the patterns
    patterns: [
      {
        rows, // pattern length in rows
        channels,
      },
    ],
  });
}

const it = await pattern2it(
  `
n(run(8))
  .chord("<Dm7 G7 C^7 <F^7 A7b9>>")
  .voicing()
  .s('sawtooth')
  .velocity(isaw.range(0.25, 0.75).fast(2))
  .jux(rev)
  .add(note("-12,0,12"))
`,
  8,
);
console.log(it);
// in Node we can write to disk
fs.writeFileSync('example.it', Buffer.from(it));
// in the browser we can download a blob
// document.location.href = URL.createObjectURL(new File([it], {"name": "example.it"}))
