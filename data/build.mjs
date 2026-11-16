import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync('data/all.json','utf8'));
const pl = JSON.parse(fs.readFileSync('data/playlists.json','utf8'));
const crateOf = {};
for (const [c, ids] of Object.entries(pl)) for (const id of ids) crateOf[id] = c;
const decadeOf = {}; 
for (const id of pl['soul-60s']) decadeOf[id]='60s';
for (const id of pl['soul-70s']) decadeOf[id]='70s';
for (const id of pl['vault']) decadeOf[id]='70s';
for (const id of pl['disco']) decadeOf[id]='70s';
decadeOf['kqsHjTG2268']='40s';
for (const id of ['wgjOpUs8AEQ','ipXFgZ-RZnM']) decadeOf[id]='70s';
for (const id of ['07caLJBNFZE','bEO-FhcU-TA']) decadeOf[id]='60s';
const tracks = all.map((v, i) => {
  const [artist, ...rest] = v.title.split(/\s[-–]\s/);
  const title = rest.join(' - ') || v.title;
  let crate = crateOf[v.id];
  let decade = decadeOf[v.id];
  if (!crate && /^Scientist/.test(v.title)) { crate = 'dub'; decade = '80s'; }
  if (crate === 'jazz' && !decade) decade = '50s';
  if (!crate) { crate = /^The Moments/.test(v.title) ? 'soul-70s' : 'soul-60s'; decade = crate === 'soul-70s' ? '70s' : '60s'; }
  const [m, s] = v.length.split(':').map(Number);
  return { id: v.id, artist: artist.trim(), title: title.trim(), crate, decade, seconds: m*60+s, order: i };
});
const crates = [
  { slug:'soul-60s', name:'60s Soul', blurb:'Northern stompers, Motown offcuts, group harmony.', color:'#c9542b' },
  { slug:'soul-70s', name:'70s Soul', blurb:'Sweet soul, Sylvia and the Moments, All Platinum deep cuts.', color:'#d4a03a' },
  { slug:'vault', name:'The Vault', blurb:'Rare soul we keep behind the counter.', color:'#7a4b2a' },
  { slug:'disco', name:'70s Disco', blurb:'Philly strings and four-on-the-floor.', color:'#b8336a' },
  { slug:'jazz', name:'Jazz', blurb:'James Moody, 40s and 50s sides.', color:'#2f5d8a' },
  { slug:'library', name:'Library & OST', blurb:'KPM and Bruton, 60s and 70s production music.', color:'#4d7c4a' },
  { slug:'dub', name:'Dub', blurb:'Scientist at the controls. Horror, space, Coxsone.', color:'#1f7a6d' },
];
const counts = {}; for (const t of tracks) counts[t.crate]=(counts[t.crate]||0)+1;
console.log(counts, tracks.length);
fs.mkdirSync('src/data', {recursive:true});
fs.writeFileSync('src/data/catalogue.json', JSON.stringify({ channel: { handle:'@selekkyyy', url:'https://www.youtube.com/@selekkyyy', id:'UC9x7T75Qne_rUyz5rjK3Ajg' }, crates, tracks }, null, 1));
