// import fs from 'fs';
import itwriter from "itwriter";
import { midiToFreq, tokenizeNote, evalScope, controls } from "@strudel/core";
import { midi2note } from "@strudel/tonal/tonleiter.mjs";
import { buf, adsr, sin, saw } from "./dsp.js";
import { evaluate } from "@strudel/transpiler";
// import { ChiptuneJsPlayer } from "chiptune3/chiptune3.js";
import { ChiptuneJsPlayer } from "https://DrSnuggles.github.io/chiptune/chiptune3.js";

let chiptune;
let init = Promise.all([
  evalScope(
    controls,
    import("@strudel/core"),
    import("@strudel/mini"),
    import("@strudel/tonal")
  ),
  // first interaction policy...
  new Promise((resolve) => {
    document.addEventListener("click", function firstClick() {
      chiptune = new ChiptuneJsPlayer();
      chiptune.onInitialized(() => resolve());
      document.removeEventListener("click", firstClick);
    });
  }),
]);

let f = midiToFreq(72); // 72 = c5 seems to match
const sine = buf(1, (t) => sin(t, f) * adsr(t, 0.01, 0.1, 0.5, 0.1, 1));
const sawtooth = buf(1, (t) => saw(t, f) * adsr(t, 0.01, 0.1, 0.5, 0.1, 1));
const samples = [
  {
    // samples can be stereo or mono floating point format
    filename: "sine.wav",
    name: "sine",
    samplerate: 44100,
    channels: [sine, sine], // stereo
  },
  {
    // samples can be stereo or mono floating point format
    filename: "sawtooth.wav",
    name: "sawtooth",
    samplerate: 44100,
    channels: [sawtooth, sawtooth], // stereo
  },
];

async function pattern2it(code, cycles, samples) {
  const { pattern } = await evaluate(code);
  const rowsPerCycle = 32;
  let ticks = 3; // ticks per row
  const rows = rowsPerCycle * cycles;

  const haps = pattern.sortHapsByPart().queryArc(0, cycles);
  // console.log(haps.map((h) => h.show(true)));

  const sounds = [...new Set(haps.map((h) => h.value.s))];
  // console.log('sounds', sounds);
  let channels = [];

  haps.forEach((hap) => {
    let _note = hap.value.note;
    if (typeof _note === "number") {
      _note = midi2note(hap.value.note);
    }
    const [letter, acc, oct] = tokenizeNote(_note);
    const pc = letter.toUpperCase() + acc;
    const note = `${pc.padEnd(2, "-")}${oct || 3}`;
    const rowIndex = Math.round(hap.whole.begin * rowsPerCycle);
    const instrument = samples.findIndex(
      (sample) => sample.name === hap.value.s
    );
    const velocity = hap.value.velocity ?? 1;
    const vol = `v${Math.round(velocity * 64)}` || "v64";
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
    title: "itwriter example", // track title
    bpm: 120, // how fast to play in bpm
    ticks, // how many ticks to fit in each row
    message: "hello!\n\nthis is my song message.", // optional embedded message
    samples,
    channelnames: {
      // zero-indexed channel names (optional)
      1: "thingo",
    },
    order: [0], // what order to play the patterns
    patterns: [
      {
        rows, // pattern length in rows
        channels,
      },
    ],
  });
}

let initialCode = `n(run(8))
.chord("<Dm7 G7 C^7 <F^7 A7b9>>")
.voicing()
.s("sine")
.velocity(isaw.range(0.25, 0.75).fast(2))
.jux(rev)
.add(note("-12,0,12"))`;

let textarea = document.getElementById("code");

if (window.location.hash) {
  textarea.value = atob(window.location.hash.slice(1));
} else {
  textarea.value = initialCode;
}

async function play() {
  await init;
  const it = await pattern2it(textarea.value, 8, samples);
  await chiptune.context.resume();
  chiptune.play(it);
}

function stop() {
  chiptune.stop();
}

async function download() {
  await init;
  const it = await pattern2it(textarea.value, 8, samples);
  console.log(it);
  const url = URL.createObjectURL(new Blob([it]));
  const link = document.createElement("a");
  link.href = url;
  link.download = "example.it";
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

textarea.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    window.location.hash = btoa(e.target.value);
    play();
  }
  if (e.key === "." && e.ctrlKey) {
    stop();
  }
});

textarea.innerHTML = initialCode;
document.getElementById("stop").addEventListener("click", () => stop());
document.getElementById("play").addEventListener("click", () => play());
document.getElementById("download").addEventListener("click", () => download());
