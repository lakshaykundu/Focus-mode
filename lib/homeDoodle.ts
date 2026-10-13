/**
 * The doodle shown where YouTube's home feed used to be: a hand-drawn, two-panel "nope / yep"
 * meme with stick figures. It's an inline SVG data URI, so it needs no network request and no
 * web-accessible resources, and it's drawn in mid-gray strokes that read on both of YouTube's
 * light and dark themes.
 */

const INK = '#7c7c7c';
const NOPE = '#ef4444';
const YEP = '#10b981';
const FONT = "'Comic Sans MS','Chalkboard SE','Comic Neue','Segoe Print',cursive";

const DOODLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 300" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M12 11 C120 8 300 12 428 9 L430 144 C300 147 140 143 10 146 Z" fill="${NOPE}" fill-opacity="0.07" stroke="${INK}" stroke-width="2.5"/>
<path d="M171 12 C169 60 172 100 170 144" stroke="${INK}" stroke-width="2"/>
<path d="M11 156 C140 153 310 158 429 155 L428 290 C300 293 120 288 12 291 Z" fill="${YEP}" fill-opacity="0.09" stroke="${INK}" stroke-width="2.5"/>
<path d="M170 157 C172 200 168 250 171 290" stroke="${INK}" stroke-width="2"/>
<g stroke="${INK}" stroke-width="3">
  <circle cx="84" cy="46" r="20"/>
  <path d="M74 43 l7 3 M93 46 l7 -3"/>
  <path d="M77 58 q7 -5 14 0"/>
  <path d="M84 66 L86 107 M86 107 L74 134 M86 107 L100 133 M85 79 L67 97 M85 79 L116 62"/>
  <path d="M116 62 L117 47 M116 62 L124 50 M117 63 L128 56 M116 63 L127 65"/>
</g>
<path d="M134 34 q6 -4 10 -10 M138 44 q8 -2 14 -6" stroke="${INK}" stroke-width="2"/>
<g stroke="${INK}" stroke-width="3">
  <circle cx="84" cy="192" r="20"/>
  <circle cx="77" cy="188" r="1.6" fill="${INK}"/>
  <circle cx="91" cy="188" r="1.6" fill="${INK}"/>
  <path d="M75 197 q9 10 18 0"/>
  <path d="M84 212 L85 252 M85 252 L73 279 M85 252 L99 278 M84 224 L66 241 M84 224 L128 213 L142 210"/>
</g>
<path d="M124 172 v12 M118 178 h12 M146 190 v8 M142 194 h8" stroke="${YEP}" stroke-width="2.5"/>
<path d="M403 22 l14 14 M417 22 l-14 14" stroke="${NOPE}" stroke-width="3.5"/>
<path d="M401 180 l7 8 l12 -16" stroke="${YEP}" stroke-width="3.5"/>
<g fill="${INK}" stroke="none" font-family="${FONT}" font-size="21">
  <text x="192" y="70">Shorts, memes &amp;</text>
  <text x="192" y="98">just one more video</text>
  <text x="192" y="215">The tutorial you</text>
  <text x="192" y="243">actually came for</text>
</g>
<path d="M192 251 C220 247 250 254 290 249" stroke="${YEP}" stroke-width="2.5"/>
</svg>`;

// encodeURIComponent leaves ' ( ) unescaped; encode them too so the URI is safe inside CSS url().
export const DOODLE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(DOODLE_SVG.replace(/\n\s*/g, ''))
  .replace(/'/g, '%27')
  .replace(/\(/g, '%28')
  .replace(/\)/g, '%29')}`;

export const HOME_HEADLINE = "You came here to learn. Don't look for fun.";

/** One per day, so the joke stays fresh without changing on every page load. */
export const HOME_QUIPS = [
  'Search for the tutorial, not the trailer.',
  'The algorithm misses you. Stay strong.',
  'Future you just said thanks.',
  'Nothing to scroll here. Literally nothing.',
  'Main character energy: finishing the tutorial.',
  'Your watch later list can wait. Forever, ideally.',
  'Plot twist: the search bar is the fun part.',
] as const;

/** Day-of-year rotation in the user's local time. */
export function quipForDate(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1).getTime();
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = Math.round((local - start) / 86_400_000);
  return HOME_QUIPS[day % HOME_QUIPS.length]!;
}

/** Escape text for a CSS `content` string (backslashes and double quotes). */
function cssString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The pseudo-element that replaces the hidden home feed: doodle, headline and the daily quip,
 * centred on screen.
 * Text colour follows YouTube's own theme switch (`html[dark]`); its CSS variables aren't
 * reliably defined at this element.
 */
export function buildHomeDoodleCss(date: Date): string {
  return `ytd-browse[page-subtype="home"]::before {
  content: "${cssString(HOME_HEADLINE)}\\A ${cssString(quipForDate(date))}";
  white-space: pre-line;
  display: block;
  box-sizing: content-box;
  /* Fixed and centred in the area below YouTube's 56px header, so YouTube's own home-page
     layout (which differs signed in vs. out) can never push it under the header. */
  position: fixed;
  top: calc(28px + 50vh);
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  width: min(440px, 90vw);
  padding-top: min(300px, 61vw);
  background: url("${DOODLE_DATA_URI}") no-repeat top center / contain;
  text-align: center;
  font: 600 18px/1.6 Roboto, Arial, sans-serif;
  color: #0f0f0f;
}
html[dark] ytd-browse[page-subtype="home"]::before {
  color: #f1f1f1;
}`;
}
