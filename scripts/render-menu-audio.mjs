// Original console menu score. Reproduce: node scripts/render-menu-audio.mjs <ffmpeg>
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const rate = 48000, bpm = 96, beat = 60 / bpm, duration = 64 * beat;
const length = Math.round(rate * duration), tau = 2 * Math.PI;
const folder = 'public/audio', temp = '.tools/audio-render';
fs.mkdirSync(temp, { recursive: true });
const stems = Object.fromEntries(['atmosphere', 'motif', 'pulse'].map(n => [n, [new Float32Array(length), new Float32Array(length)]]));
const hz = n => 440 * 2 ** ((n - 69) / 12);
let seed = 100926;
const noise = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
function add(name, start, seconds, pan, synth) {
  const gains = [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];
  for (let i = 0; i < seconds * rate; i++) {
    const x = synth(i / rate, i / (seconds * rate));
    const index = ((Math.round(start * rate) + i) % length + length) % length;
    for (let c = 0; c < 2; c++) stems[name][c][index] += x * gains[c];
  }
}
// Eight two-bar phrases: warmer inversions, a short hook and a spacious answer.
const chords = [[48,55,59,62,64], [47,55,59,62,67], [45,52,55,59,60], [43,52,55,59,62],
  [41,48,52,55,57], [40,48,52,55,59], [43,50,55,57,59], [43,50,55,59,62]];
const phrases = [
  [[.5,67],[1.5,72],[3,76],[5.5,74]],
  [[.5,71],[2,67],[5,74]],
  [[.5,64],[1.5,69],[3,72],[5.5,71]],
  [[1,67],[3,64],[6,62]],
  [[.5,65],[1.5,69],[3,72],[5.5,76]],
  [[.5,71],[2,67],[5,64]],
  [[.5,67],[2,71],[3.5,74],[5.5,72]],
  [[1,71],[3,69],[5,67]],
];
for (let section = 0; section < 8; section++) {
  const chord = chords[section];
  chord.forEach((note, voice) => add('atmosphere', (section * 8 - .5) * beat, beat * 9, (voice - 2) * .25, (t,p) => {
    const f = hz(note);
    return .065 * Math.sin(Math.PI * p) ** 2 * (Math.sin(tau*f*t) + .09*Math.sin(tau*f*2*t));
  }));
  // Rounded bass and softly brushed drum accents leave room for UI sounds.
  for (const [b,n] of [[0,chord[0]],[3,chord[1]],[4.5,chord[0]],[6.5,chord[1]]]) {
    add('pulse', (section*8+b)*beat, .48, 0, (t,p) => .17*(1-Math.exp(-t*110))*Math.exp(-t*6)*(1-p)*Math.sin(tau*hz(n-12)*t));
    add('pulse', (section*8+b)*beat, .16, 0, (t,p) => .08*Math.sin(Math.PI*p)*Math.exp(-t*22)*Math.sin(tau*(55*t+2*(1-Math.exp(-t*25)))));
  }
  for (const b of [1,3,5,7]) add('pulse',(section*8+b)*beat,.09,b%3?.18:-.18,(t,p)=>.018*Math.sin(Math.PI*p)*Math.exp(-t*42)*noise());
  // A quiet repeating mallet accompaniment, alternating across the stereo field.
  for (const b of [0,2,4,6]) {
    const f=hz(chord[1+(b/2)%4]);
    add('motif',(section*8+b+.75)*beat,.85,b%4?.3:-.3,(t,p)=>.042*(1-Math.exp(-t*90))*Math.exp(-t*5)*(1-p)*Math.sin(tau*f*t));
  }
  for (const [b,n] of phrases[section]) for (let echo=0;echo<3;echo++) {
    const f=hz(n);
    add('motif',(section*8+b+echo*.75)*beat,1.8,echo%2?.22:-.22,(t,p)=>
      .19*.19**echo*(1-Math.exp(-t*85))*Math.exp(-t*2.5)*Math.min(1,(1-p)*8)*
      (Math.sin(tau*f*t+.23*Math.exp(-t*8)*Math.sin(tau*f*2*t))+.07*Math.exp(-t*6)*Math.sin(tau*f*3*t)));
  }
}
// Wrap note tails and reflections around the loop, rather than cutting them off.
for (const channels of Object.values(stems)) {
  const original = channels.map(c=>c.slice());
  for (const [seconds,gain] of [[.083,.13],[.173,.08],[.281,.04]]) {
    const delay=Math.round(seconds*rate);
    for(let c=0;c<2;c++) for(let i=0;i<length;i++) channels[c][(i+delay)%length]+=original[1-c][i]*gain;
  }
}
function wav(channels,file) {
  const data=Buffer.alloc(44+length*4);
  data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);
  data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(2,22);
  data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*4,28);data.writeUInt16LE(4,32);data.writeUInt16LE(16,34);
  data.write('data',36);data.writeUInt32LE(length*4,40);
  for(let i=0;i<length;i++) for(let c=0;c<2;c++) data.writeInt16LE(Math.round(channels[c][i]*32767),44+i*4+c*2);
  fs.writeFileSync(file,data);
}
const metrics={}, mix=[new Float32Array(length),new Float32Array(length)];
for(const [name,channels] of Object.entries(stems)) {
  let peak=0,square=0;
  for(let c=0;c<2;c++) for(let i=0;i<length;i++) { const x=channels[c][i];peak=Math.max(peak,Math.abs(x));square+=x*x;mix[c][i]+=x*[.9,.72,.65][['atmosphere','motif','pulse'].indexOf(name)]; }
  if(!Number.isFinite(square)||peak>=.95||peak<.01) throw Error(`Invalid stem ${name}: ${peak}`);
  metrics[name]={peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(square/(length*2)),seamDelta:Math.max(...channels.map(c=>Math.abs(c[0]-c[length-1])))};
  const file=`${temp}/menu-${name}.wav`;wav(channels,file);
  if(process.argv[2])execFileSync(process.argv[2],['-y','-v','error','-i',file,'-c:a','libvorbis','-q:a','5',`${folder}/${name}.ogg`]);
}
wav(mix,`${temp}/menu-preview.wav`);
if(process.argv[2])execFileSync(process.argv[2],['-y','-v','error','-i',`${temp}/menu-preview.wav`,'-af','afade=t=in:d=0.6,afade=t=out:st=38:d=2','-c:a','libmp3lame','-b:a','192k',`${folder}/menu-preview.mp3`]);
fs.writeFileSync(`${folder}/score.json`,JSON.stringify({title:'待机乐园 / Menu Garden',revision:2,bpm,duration,rate,seed:100926,metrics},null,2)+'\n');
console.log(JSON.stringify({duration,metrics},null,2));
