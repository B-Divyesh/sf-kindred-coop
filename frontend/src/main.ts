import './styles.css';
import { connectRoom, createRoom, joinRoom, unlockRoom, type Credentials, type RoomState } from './api';
import { cachedLicenseState, captureLicenseFromUrl, checkoutUrl, saveLicense, verifyLicense, type LicenseState } from './license';

const app = document.querySelector<HTMLDivElement>('#app')!;
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || 'development';
const DEMO_KEY = 'demo:kindred-coop';

let license: LicenseState = { token: null, unlocked: false, checking: false, notice: '' };
let credentials: Credentials | null = null;
let room: RoomState | null = null;
let socket: WebSocket | null = null;
let network = navigator.onLine ? 'Ready' : 'Offline';
let notice = '';

const symbols: Record<string, string> = {
  moon: '☾', leaf: '⌁', star: '✦', ripple: '≋', up: '↑', down: '↓', left: '←', right: '→',
  crescent: '◔', fern: '♧', amber: '◆', speckle: '⠿',
};
const puzzleOptions = [
  ['moon', 'leaf', 'star', 'ripple'],
  ['up', 'left', 'right', 'down'],
  ['crescent', 'fern', 'amber', 'speckle'],
];
const puzzleLabels = [
  { moon: 'Moon', leaf: 'Leaf', star: 'Star', ripple: 'Ripple' },
  { up: 'Up', left: 'Left', right: 'Right', down: 'Down' },
  { crescent: 'Crescent', fern: 'Fern', amber: 'Amber', speckle: 'Speckle' },
] as Array<Record<string, string>>;
const puzzleSolutions = [
  ['moon', 'leaf', 'star', 'ripple'],
  ['right', 'down', 'right', 'up'],
  ['crescent', 'fern', 'amber'],
];

type DemoState = { matched: string[]; signal: string | null; attempts: number; notice: string };

const sampleState = (): DemoState => ({
  matched: ['moon', 'leaf'],
  signal: 'star',
  attempts: 0,
  notice: 'Moon and Leaf are already matched. Match the Star signal next.',
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
}

function setPageMeta(title: string, description: string, path: string): void {
  document.title = title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute('content', description);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `${location.origin}${path}`);
}

function shell(content: string, page: 'home' | 'legal' | 'room' | 'demo' | 'not-found' = 'home'): void {
  const roomHelp = page === 'room' ? '<button class="text-button" data-action="how">How to play</button>' : '';
  app.innerHTML = `
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Kindred Co-op home"><span aria-hidden="true">✦</span> Kindred Co-op</a>
      <nav aria-label="Main navigation">
        ${roomHelp}<a href="/demo">Demo</a><a href="/#play">Play</a><a href="/privacy">Privacy</a>
      </nav>
    </header>
    <main id="main" tabindex="-1">${content}</main>
    <div class="visually-hidden" role="status" aria-live="polite">${page === 'demo' ? 'Sample demo loaded' : ''}</div>
    <footer>
      <p><strong>Play three picture puzzles with someone in another place.</strong></p>
      <nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:support@sociobot.in">Help</a></nav>
      <p class="fine-print">Built by Param Factory · Build ${escapeHtml(BUILD_SHA.slice(0, 12))} · Original artwork generated for Kindred Co-op with Azure OpenAI.</p>
    </footer>`;
}

function renderHome(): void {
  setPageMeta('Kindred Co-op — play picture puzzles together', 'Play a short, private picture-puzzle game with a parent or child in another place.', '/');
  const fullGame = license.unlocked
    ? '<span class="stamp success">All three puzzles are available</span>'
    : `<a class="button secondary" href="${checkoutUrl}">Buy all 3 puzzles — $8 once</a>`;
  shell(`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Remote co-op for two</p>
        <h1>Play picture puzzles together</h1>
        <p class="lede">For a parent and child playing apart who want a short game without ads or accounts.</p>
        <div class="hero-actions"><a class="button primary" href="/demo">Try it with sample data</a><a class="text-link" href="#play">Create a private room</a></div>
        <p class="action-note">See both roles and finish a sample puzzle by yourself.</p>
        <ul class="trust-strip" aria-label="Game facts"><li>No account or ads</li><li>Instructions work offline; live play needs internet</li><li>All three puzzles cost $8 once</li></ul>
      </div>
      <figure class="hero-art">
        <picture>
          <source media="(max-width: 720px)" srcset="/assets/kindred-hills-720.webp">
          <img src="/assets/kindred-hills.webp" width="1200" height="800" alt="Two lanterns on separate hills send a shape between two devices" fetchpriority="high">
        </picture>
        <figcaption>Two devices share one shape at a time.</figcaption>
      </figure>
    </section>
    <section class="play-start" id="play" aria-labelledby="play-title">
      <div><p class="eyebrow">Play with someone else</p><h2 id="play-title">Create a private room</h2><p>Choose how long it stays open, then send one invite link.</p></div>
      <form id="create-form" class="create-form">
        <label for="expiry">Room lifetime</label>
        <select id="expiry" name="expiry"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select>
        <button class="button primary" type="submit">Create invite link</button>
      </form>
      <form id="join-form" class="join-form">
        <label for="join-code">Or enter an invite code</label>
        <div class="inline-form"><input id="join-code" name="code" aria-describedby="join-help" autocomplete="off" inputmode="text" maxlength="7" pattern="[A-Za-z0-9]{7}" required><button class="button paper" type="submit">Join room</button></div>
        <small id="join-help">Enter the seven letters and numbers from the host.</small>
      </form>
      <p class="form-status" role="status" aria-live="polite">${escapeHtml(notice || network)}</p>
    </section>
    <section class="how" aria-labelledby="how-title">
      <p class="eyebrow">How it works</p><h2 id="how-title">Read, send, and match shapes</h2>
      <ol class="control-cards">
        <li><span class="card-number">1</span><span class="control-icon" aria-hidden="true">◉</span><h3>Read the clue</h3><p>The clue giver sees the shape order.</p></li>
        <li><span class="card-number">2</span><span class="control-icon" aria-hidden="true">✦</span><h3>Send a shape</h3><p>The clue giver sends one shape.</p></li>
        <li><span class="card-number">3</span><span class="control-icon" aria-hidden="true">☝</span><h3>Match the shape</h3><p>The matcher chooses the same shape.</p></li>
      </ol>
    </section>
    <section class="privacy-summary" aria-labelledby="privacy-summary-title">
      <p class="eyebrow">Privacy</p><h2 id="privacy-summary-title">What the game does not collect</h2>
      <p>There are no names, accounts, open chat, ads, or behavior profiles. Temporary rooms use random keys and expire.</p>
      <a href="/privacy">Read how data is handled</a>
    </section>
    <section class="purchase" aria-labelledby="purchase-title">
      <div><p class="eyebrow">Price</p><h2 id="purchase-title">Buy all three puzzles for $8 once</h2></div>
      <div><p>One puzzle is free. The family license adds two puzzles on this device. There is no subscription or recurring fee.</p><p>Sociobot and Dodo handle checkout and refunds.</p>${fullGame}
      <details><summary>Restore a license</summary><form id="license-form"><label for="license-token">License token</label><div class="inline-form"><input id="license-token" name="license" required autocomplete="off"><button class="button paper" type="submit">Verify license</button></div></form></details>
      <p class="form-status" role="status" aria-live="polite">${escapeHtml(license.notice)}</p></div>
    </section>`);
  bindCommon();
  document.querySelector<HTMLFormElement>('#create-form')?.addEventListener('submit', startRoom);
  document.querySelector<HTMLFormElement>('#join-form')?.addEventListener('submit', joinByCode);
  document.querySelector<HTMLFormElement>('#license-form')?.addEventListener('submit', restoreLicense);
}

function readDemoState(): DemoState {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_KEY) || 'null') as DemoState | null;
    if (saved && Array.isArray(saved.matched) && typeof saved.attempts === 'number') return saved;
  } catch { /* Reset malformed sample data below. */ }
  const state = sampleState();
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(state));
  return state;
}

function writeDemoState(state: DemoState): void {
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(state));
  renderDemo();
}

function renderDemo(): void {
  setPageMeta('Demo — Kindred Co-op', 'Try both roles in a populated picture puzzle without creating a real room.', '/demo');
  const state = readDemoState();
  const complete = state.matched.length === puzzleSolutions[0].length;
  const expected = puzzleSolutions[0][state.matched.length];
  const latest = state.signal ? puzzleLabels[0][state.signal] : null;
  shell(`
    <aside class="demo-banner" aria-label="Demo status">
      <strong>Demo — sample data, nothing is saved</strong>
      <span><button class="text-button" data-demo-reset>Reset demo</button><a href="/#play" data-demo-exit>Start for real</a></span>
    </aside>
    <section class="demo-intro">
      <p class="eyebrow">Sample room · Both players connected</p>
      <h1>Try a two-player picture puzzle</h1>
      <p class="lede">You control both roles here. Moon and Leaf are already matched.</p>
    </section>
    <section class="sample-game" aria-labelledby="sample-progress-title">
      <div class="demo-role clue-giver">
        <p class="role-label lantern">Role 1 · Clue giver</p><h2>Send the next shape</h2><p>The sample clue is Moon, Leaf, Star, then Ripple.</p>
        <div class="clue-strip" aria-label="Sample shape order">${puzzleSolutions[0].map((value, index) => `<span><small>${index + 1}</small><b aria-hidden="true">${symbols[value]}</b>${puzzleLabels[0][value]}</span>`).join('')}</div>
        <div class="signal-pad demo-pad" role="group" aria-label="Clue giver controls">${puzzleOptions[0].map(value => `<button class="symbol-button" data-demo-send="${value}" aria-label="Send ${puzzleLabels[0][value]} sample signal" ${complete ? 'disabled' : ''}><span aria-hidden="true">${symbols[value]}</span><small>${puzzleLabels[0][value]}</small></button>`).join('')}</div>
      </div>
      <div class="demo-role matcher">
        <p class="role-label moth">Role 2 · Matcher</p><h2>Match the latest shape</h2>
        <div class="signal-window ${latest ? '' : 'empty-signal'}">${latest ? `<p>Latest sample signal</p><strong><span aria-hidden="true">${symbols[state.signal!]}</span> ${latest}</strong>` : '<span aria-hidden="true">···</span><p>Send a shape from the first panel.</p>'}</div>
        <div class="signal-pad demo-pad" role="group" aria-label="Matcher controls">${puzzleOptions[0].map(value => `<button class="symbol-button" data-demo-match="${value}" aria-label="Match ${puzzleLabels[0][value]} sample signal" ${!state.signal || complete ? 'disabled' : ''}><span aria-hidden="true">${symbols[value]}</span><small>${puzzleLabels[0][value]}</small></button>`).join('')}</div>
      </div>
      <div class="demo-progress">
        <h2 id="sample-progress-title">${complete ? 'Sample puzzle complete' : 'Sample progress'}</h2>
        <p>${state.matched.length} of 4 shapes matched${state.attempts ? ` · Restarts: ${state.attempts}` : ''}</p>
        <div class="progress-track" role="progressbar" aria-label="Sample puzzle progress" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${state.matched.length}"><span style="width:${state.matched.length / 4 * 100}%"></span></div>
        <ul class="matched-list" aria-label="Matched sample shapes">${state.matched.map(value => `<li><span aria-hidden="true">✓</span> ${puzzleLabels[0][value]} matched</li>`).join('')}</ul>
        <p class="demo-notice" role="status" aria-live="polite">${escapeHtml(complete ? 'You finished the sample. Reset it or start a real room.' : state.notice)}</p>
        ${!complete && expected ? `<p class="fine-print">Next clue: ${puzzleLabels[0][expected]}</p>` : ''}
      </div>
    </section>`, 'demo');
  bindCommon();
  document.querySelectorAll<HTMLButtonElement>('[data-demo-send]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.demoSend!;
    writeDemoState({ ...state, signal: value, notice: `${puzzleLabels[0][value]} was sent to the matcher.` });
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-demo-match]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.demoMatch!;
    if (state.signal === expected && value === expected) {
      writeDemoState({ ...state, matched: [...state.matched, value], signal: null, notice: `${puzzleLabels[0][value]} matched. Send the next shape.` });
    } else {
      writeDemoState({ matched: [], signal: null, attempts: state.attempts + 1, notice: 'That shape did not match. Start again with Moon.' });
    }
  }));
  document.querySelector<HTMLButtonElement>('[data-demo-reset]')?.addEventListener('click', () => {
    sessionStorage.setItem(DEMO_KEY, JSON.stringify(sampleState()));
    renderDemo();
    document.querySelector<HTMLButtonElement>('[data-demo-reset]')?.focus();
  });
  document.querySelector<HTMLAnchorElement>('[data-demo-exit]')?.addEventListener('click', () => sessionStorage.removeItem(DEMO_KEY));
}

function renderRoom(): void {
  if (!credentials) return;
  const active = document.activeElement as HTMLElement | null;
  const restoreFocus = active?.dataset.value ? `[data-value="${active.dataset.value}"]` : active?.dataset.send ? `[data-send="${active.dataset.send}"]` : '';
  setPageMeta(room ? `${room.puzzleName} — Kindred Co-op` : 'Connecting to room — Kindred Co-op', 'Send and match picture clues in a private two-player room.', '/');
  if (!room) {
    shell(`<section class="room-loading"><p class="eyebrow">Room ${credentials.code}</p><h1>Connecting to the room</h1><p role="status">${escapeHtml(network)}</p><a class="button paper" href="/">Return home</a></section>`, 'room');
    bindCommon(); return;
  }
  const isHost = room.role === 'host';
  const invite = `${location.origin}/?join=${room.code}`;
  const mins = Math.max(0, Math.ceil((room.expiresAt * 1000 - Date.now()) / 60000));
  const connected = room.hostConnected && room.guestConnected;
  const roleName = isHost ? 'Clue giver' : 'Matcher';
  const options = puzzleOptions[room.puzzle] || puzzleOptions[2];
  const labels = puzzleLabels[room.puzzle] || puzzleLabels[2];
  let play = '';
  if (room.status === 'expired') {
    play = `<div class="end-note"><span class="big-symbol" aria-hidden="true">◌</span><h2>This room has ended</h2><p>No room progress was saved. The host can create another room.</p><a class="button primary" href="/">Create another room</a></div>`;
  } else if (room.status === 'complete') {
    play = `<div class="end-note celebration"><span class="big-symbol" aria-hidden="true">✦</span><h2>You finished all three puzzles</h2><p>Both players matched every clue. This room will expire on schedule.</p><a class="button primary" href="/">Return home</a></div>`;
  } else if (room.status === 'locked') {
    play = isHost ? `<div class="end-note"><span class="big-symbol" aria-hidden="true">❧</span><h2>The free puzzle is complete</h2><p>Buy the two remaining puzzles for $8 once. Only the host needs the family license.</p><a class="button primary" href="${checkoutUrl}">Buy all 3 puzzles — $8 once</a><details><summary>Restore a license</summary><form id="room-license-form"><label for="room-license-token">License token</label><div class="inline-form"><input id="room-license-token" name="license" required autocomplete="off"><button class="button paper" type="submit">Verify license</button></div></form></details></div>`
      : `<div class="end-note"><span class="big-symbol" aria-hidden="true">❧</span><h2>Waiting for the host</h2><p>The free puzzle is complete. The host can add the two paid puzzles.</p></div>`;
  } else if (room.status === 'solved') {
    play = `<div class="end-note celebration"><span class="big-symbol" aria-hidden="true">✓</span><h2>Puzzle complete</h2><p>You matched every clue in ${escapeHtml(room.puzzleName.toLowerCase())}.</p>${isHost ? `<button class="button primary" data-send="next">${room.puzzle === 2 ? 'Finish the game' : 'Start the next puzzle'}</button>` : '<p class="waiting-mark">The host will start the next puzzle.</p>'}</div>`;
  } else {
    play = `<div class="puzzle-instructions"><p class="role-label ${isHost ? 'lantern' : 'moth'}">Your role · ${roleName}</p><h2>${escapeHtml(room.roleNote)}</h2>${isHost ? `<div class="clue-strip" aria-label="Shape order">${puzzleSolutions[room.puzzle].map((value, index) => `<span><small>${index + 1}</small><b aria-hidden="true">${symbols[value]}</b>${labels[value]}</span>`).join('')}</div>` : ''}</div>
      ${isHost && room.status === 'waiting' ? `<div class="invite-sheet"><p>Your room is ready. Send this private link to the other player.</p><code>${escapeHtml(invite)}</code><button class="button primary" data-copy="${escapeHtml(invite)}">Copy invite link</button><p class="fine-print">Invite code: <strong>${room.code}</strong></p></div>` : ''}
      ${!isHost && !room.lastSignal ? '<div class="signal-window empty-signal"><span aria-hidden="true">···</span><p>Wait here for the next shape.</p></div>' : ''}
      ${!isHost && room.lastSignal ? `<div class="signal-window"><p>Latest shape</p><strong aria-live="polite"><span aria-hidden="true">${symbols[room.lastSignal]}</span> ${escapeHtml(labels[room.lastSignal] || room.lastSignal)}</strong></div>` : ''}
      <div class="signal-pad" role="group" aria-label="${isHost ? 'Send a shape' : 'Match the shape'}">${options.map(value => `<button class="symbol-button" data-value="${value}" aria-label="${isHost ? 'Send' : 'Choose'} ${labels[value]}"><span aria-hidden="true">${symbols[value]}</span><small>${labels[value]}</small></button>`).join('')}</div>
      <div class="progress-row" aria-live="polite"><span>${room.step} of ${room.totalSteps} matched</span><div class="progress-track" role="progressbar" aria-label="${escapeHtml(room.puzzleName)} progress" aria-valuemin="0" aria-valuemax="${room.totalSteps}" aria-valuenow="${room.step}"><span style="width:${room.step / room.totalSteps * 100}%"></span></div>${room.attempts ? `<span>Restarts: ${room.attempts}</span>` : ''}</div>`;
  }
  shell(`<section class="room-head"><div><p class="eyebrow">Puzzle ${Math.min(room.puzzle + 1, 3)} of 3</p><h1>${escapeHtml(room.puzzleName)}</h1></div><div class="room-marks"><span class="network-mark ${connected ? 'online' : ''}">${connected ? 'Both connected' : network}</span><span>Room ${room.code}</span><span>${mins} min left</span></div></section>
    <section class="game-sheet">${play}</section>
    ${isHost && room.status !== 'expired' ? `<details class="room-controls"><summary>Room controls</summary><div><p>Only the clue giver can change or end this room.</p><button class="button paper" data-extend="15">Keep for 15 min</button><button class="button paper" data-extend="30">Keep for 30 min</button><button class="text-button danger" data-send="end">End room now</button></div></details>` : ''}
    <p class="room-live" role="status" aria-live="polite">${escapeHtml(notice)}</p>`, 'room');
  bindCommon(); bindRoom();
  if (restoreFocus) {
    const target = document.querySelector<HTMLElement>(restoreFocus);
    if (target) target.focus();
    else if (room.status === 'solved' || room.status === 'complete') {
      const heading = document.querySelector<HTMLElement>('.end-note h2');
      heading?.setAttribute('tabindex', '-1'); heading?.focus();
    }
  }
}

function bindCommon(): void {
  document.querySelectorAll<HTMLElement>('[data-action="how"]').forEach(button => button.addEventListener('click', showHow));
}

function bindRoom(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => button.addEventListener('click', () => send(room?.role === 'host' ? 'signal' : 'answer', button.dataset.value)));
  document.querySelectorAll<HTMLButtonElement>('[data-send]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.send === 'end' && !confirm('End this room now for both players? This cannot be undone.')) return;
    send(button.dataset.send!);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-extend]').forEach(button => button.addEventListener('click', () => send('extend', undefined, Number(button.dataset.extend))));
  document.querySelector<HTMLButtonElement>('[data-copy]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try { await navigator.clipboard.writeText(button.dataset.copy!); button.textContent = 'Invite copied'; }
    catch { notice = 'Copy was blocked. Select and copy the link above.'; renderRoom(); }
  });
  document.querySelector<HTMLFormElement>('#room-license-form')?.addEventListener('submit', restoreLicense);
}

function showHow(): void {
  const old = document.querySelector('dialog'); if (old) old.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'how-dialog';
  dialog.innerHTML = `<form method="dialog"><button class="dialog-close" aria-label="Close how to play">×</button><p class="eyebrow">How to play</p><h2>Read, send, and match</h2><ol class="control-cards"><li><span class="control-icon" aria-hidden="true">◉</span><h3>Read the clue</h3><p>The clue giver reads the order.</p></li><li><span class="control-icon" aria-hidden="true">✦</span><h3>Send a shape</h3><p>The clue giver chooses one shape.</p></li><li><span class="control-icon" aria-hidden="true">☝</span><h3>Match the shape</h3><p>The matcher chooses the same shape.</p></li></ol><button class="button primary" value="close">Close instructions</button></form>`;
  document.body.append(dialog); dialog.showModal(); dialog.addEventListener('close', () => dialog.remove());
}

async function startRoom(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector('button')!; button.setAttribute('disabled', ''); button.textContent = 'Creating room…';
  try {
    credentials = await createRoom(Number(new FormData(form).get('expiry')), license.token);
    sessionStorage.setItem(`kindred:${credentials.code}:host`, JSON.stringify(credentials));
    history.pushState({}, '', `/?room=${credentials.code}`); connect(credentials);
  } catch (error) { notice = (error as Error).message; renderHome(); }
}

async function joinByCode(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const code = String(new FormData(event.currentTarget as HTMLFormElement).get('code')).trim().toUpperCase();
  await beginJoin(code);
}

async function beginJoin(code: string): Promise<void> {
  notice = 'Opening the invite…'; renderHome();
  try {
    const saved = sessionStorage.getItem(`kindred:${code}:guest`);
    credentials = await joinRoom(code, saved ? (JSON.parse(saved) as Credentials).key : undefined);
    sessionStorage.setItem(`kindred:${code}:guest`, JSON.stringify(credentials));
    history.replaceState({}, '', `/?room=${code}`); connect(credentials);
  } catch (error) { notice = (error as Error).message; renderHome(); }
}

function connect(value: Credentials): void {
  socket?.close(); credentials = value; room = null; network = 'Connecting…'; renderRoom();
  socket = connectRoom(value, state => { room = state; renderRoom(); }, status => { network = status; if (room) renderRoom(); });
}

function send(type: string, value?: string, expiryMinutes?: number): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) { notice = 'You are offline. Reconnect before sending a shape.'; renderRoom(); return; }
  socket.send(JSON.stringify({ type, value, expiryMinutes }));
}

async function restoreLicense(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const token = String(new FormData(form).get('license') || form.querySelector<HTMLInputElement>('input')?.value || '').trim();
  if (!token) return;
  saveLicense(token); license = { token, unlocked: false, checking: true, notice: 'Checking your family license…' };
  room ? renderRoom() : renderHome();
  license = await verifyLicense(token);
  if (license.unlocked && room && credentials) {
    try { await unlockRoom(credentials, token); notice = 'All three puzzles are available in this room.'; }
    catch (error) { license = { ...license, unlocked: false, notice: (error as Error).message }; notice = license.notice; }
  }
  room ? renderRoom() : renderHome();
}

function renderLegal(kind: 'privacy' | 'terms'): void {
  const privacy = `<article class="legal"><p class="eyebrow">Updated 6 September 2026</p><h1>How Kindred Co-op handles data</h1><p class="lede">The game works without names, accounts, open chat, ads, or behavior profiles.</p><h2>Data in a room</h2><p>The server holds a random invite code, two random device keys, puzzle progress, and an expiry time in memory. It sends shapes only between the two devices in that room. Expired rooms are removed from memory within six minutes.</p><h2>Data on your device</h2><p>Your browser stores the app files for offline instructions. It also stores a license token if you buy or restore the full game. You can remove both by clearing site data.</p><h2>Sample demo data</h2><p>The demo uses a separate session-storage key that starts with <code>demo:</code>. It never creates a room or reads your license and room keys. Closing the browser session removes its sample progress.</p><h2>Analytics</h2><p>The game does not send analytics requests, set tracking cookies, or build visitor profiles.</p><h2>Purchases</h2><p>Sociobot and Dodo handle checkout and refunds under their own privacy terms. The server sends a license token to Sociobot only when a paid room starts or a license is restored. The game never receives card details.</p><h2>Adult responsibility</h2><p>An adult should decide who receives an invite link and use normal device safety controls. Anyone with a live link can claim the second place until the room expires.</p><h2>Questions</h2><p>Email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>.</p></article>`;
  const terms = `<article class="legal"><p class="eyebrow">Updated 5 September 2026</p><h1>Terms for using Kindred Co-op</h1><p class="lede">Kindred Co-op is a family game with one free puzzle and a one-time paid license.</p><h2>Using the game</h2><p>You may use Kindred Co-op for personal and family play. Do not disrupt the service, probe other rooms, automate requests, or share an invite publicly. An adult is responsible for a child’s device, connection, and choice of play partner.</p><h2>Family game license</h2><p>The $8 one-time purchase adds two puzzles on devices where the license is restored. It is not a subscription. Sociobot and Dodo handle checkout and refunds. A refunded, expired, revoked, or wrong-product license will not open paid puzzles.</p><h2>Availability</h2><p>A room ends when its timer runs out or when the host ends it. Two-player play needs internet access. Cached instructions and the sample demo may load offline, but room shapes cannot.</p><h2>Limits</h2><p>Where the law allows, the service is supplied without warranties. Liability is limited to the amount paid for the license. These terms do not limit rights that cannot legally be limited.</p><h2>Contact</h2><p>Email <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p></article>`;
  const isPrivacy = kind === 'privacy';
  setPageMeta(`${isPrivacy ? 'Privacy' : 'Terms'} — Kindred Co-op`, isPrivacy ? 'How temporary rooms, browser storage, analytics, and licenses are handled.' : 'Terms for the free puzzle and one-time family game license.', isPrivacy ? '/privacy' : '/terms');
  shell(isPrivacy ? privacy : terms, 'legal'); bindCommon();
}

function renderNotFound(): void {
  setPageMeta('Page not found — Kindred Co-op', 'The requested Kindred Co-op page was not found.', location.pathname);
  shell(`<section class="not-found"><p class="eyebrow">Error 404</p><h1>Page not found</h1><p>This address does not match a game page.</p><a class="button primary" href="/">Return home</a></section>`, 'not-found');
}

async function boot(): Promise<void> {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/demo') return renderDemo();
  if (path === '/privacy') return renderLegal('privacy');
  if (path === '/terms') return renderLegal('terms');
  if (path !== '/') return renderNotFound();
  license = cachedLicenseState(captureLicenseFromUrl());
  renderHome();
  if (license.token && license.checking) { license = await verifyLicense(license.token); renderHome(); }
  const params = new URLSearchParams(location.search);
  const join = params.get('join'); const existing = params.get('room');
  if (join) return beginJoin(join.toUpperCase());
  if (existing) {
    for (const role of ['host', 'guest']) {
      const saved = sessionStorage.getItem(`kindred:${existing}:${role}`);
      if (saved) { connect(JSON.parse(saved)); return; }
    }
    notice = 'This room key is not on this device. Ask for the invite link again.'; renderHome();
  }
}

addEventListener('online', () => {
  network = 'Back online';
  if (notice.startsWith('Offline')) notice = '';
  if (credentials && (!socket || socket.readyState > 1)) connect(credentials); else if (location.pathname === '/demo') renderDemo(); else room ? renderRoom() : renderHome();
});
addEventListener('offline', () => {
  network = 'Offline'; notice = 'Offline — reconnect to create, join, or send a shape.';
  if (location.pathname === '/demo') renderDemo(); else room ? renderRoom() : renderHome();
});
addEventListener('popstate', () => location.reload());
document.querySelector<HTMLAnchorElement>('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  const main = document.querySelector<HTMLElement>('#main'); main?.focus(); main?.scrollIntoView();
});
addEventListener('keydown', (event) => {
  if (!room || room.role !== 'guest' || room.puzzle !== 1 || room.status !== 'playing') return;
  const keys: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (keys[event.key]) { event.preventDefault(); send('answer', keys[event.key]); }
});
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}));
boot();
