import './styles.css';
import { connectRoom, createRoom, joinRoom, type Credentials, type RoomState } from './api';
import { cachedLicenseState, captureLicenseFromUrl, checkoutUrl, saveLicense, verifyLicense, type LicenseState } from './license';

const app = document.querySelector<HTMLDivElement>('#app')!;
let license: LicenseState = cachedLicenseState(captureLicenseFromUrl());
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
}

function shell(content: string, page: 'home' | 'legal' | 'room' = 'home'): void {
  app.innerHTML = `
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Kindred Co-op home"><span aria-hidden="true">✦</span> Kindred Co-op</a>
      <nav aria-label="Main navigation">
        ${page === 'room' ? '<button class="text-button" data-action="how">How to play</button>' : '<a href="/#play">Play</a>'}
        <a href="/privacy">Privacy</a>
      </nav>
    </header>
    <main id="main">${content}</main>
    <footer>
      <p><strong>Made for two, not for metrics.</strong> No ads, accounts, chat, or behavioral tracking.</p>
      <nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:support@sociobot.in">Help</a></nav>
      <p class="fine-print">Original artwork generated for Kindred Co-op with Azure OpenAI; game symbols are hand-drawn in code.</p>
    </footer>`;
}

function renderHome(): void {
  document.title = 'Kindred Co-op — a little game for two';
  const fullGame = license.unlocked ? '<span class="stamp success">Family game unlocked</span>' : `<a class="button secondary" href="${checkoutUrl}">Get all 3 puzzles — $8 once</a>`;
  shell(`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A small signal across the distance</p>
        <h1>Two places.<br><em>One little adventure.</em></h1>
        <p class="lede">A parent and child guide each other through three gentle picture puzzles. One link, about 15 minutes, nothing following you home.</p>
        <div class="hero-actions"><a class="button primary" href="#play">Light a room</a><button class="text-button" data-action="how">See the 3 controls</button></div>
        <ul class="trust-strip" aria-label="Game promises"><li>No account</li><li>No ads</li><li>Room disappears</li></ul>
      </div>
      <figure class="hero-art">
        <picture>
          <source media="(max-width: 720px)" srcset="/assets/kindred-hills-720.webp">
          <img src="/assets/kindred-hills.webp" width="1200" height="800" alt="Two lanterns on distant flowered hills with a friendly moth carrying light between them" fetchpriority="high">
        </picture>
        <figcaption>Pass a signal from Lantern to Moth.</figcaption>
      </figure>
    </section>
    <section class="play-start" id="play" aria-labelledby="play-title">
      <div>
        <p class="eyebrow">Start together</p>
        <h2 id="play-title">Make a private room</h2>
        <p>You’ll send one invite link. The host decides when it disappears.</p>
      </div>
      <form id="create-form" class="create-form">
        <label for="expiry">Room lifetime</label>
        <select id="expiry" name="expiry"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select>
        <button class="button primary" type="submit">Create invite link</button>
      </form>
      <form id="join-form" class="join-form">
        <label for="join-code">Or enter an invite code</label>
        <div class="inline-form"><input id="join-code" name="code" autocomplete="off" inputmode="text" maxlength="7" pattern="[A-Za-z0-9]{7}" required><button class="button paper" type="submit">Join room</button></div>
      </form>
      <p class="form-status" role="status" aria-live="polite">${escapeHtml(notice || network)}</p>
    </section>
    <section class="how" aria-labelledby="ritual-title">
      <p class="eyebrow">The whole ritual</p><h2 id="ritual-title">Look. Signal. Match.</h2>
      <ol class="control-cards">
        <li><span class="card-number">1</span><span class="control-icon" aria-hidden="true">◉</span><h3>Look</h3><p>Lantern sees the secret field note.</p></li>
        <li><span class="card-number">2</span><span class="control-icon" aria-hidden="true">✦</span><h3>Signal</h3><p>Send one clear shape across the room.</p></li>
        <li><span class="card-number">3</span><span class="control-icon" aria-hidden="true">☝</span><h3>Match</h3><p>Moth taps the same shape. That’s it.</p></li>
      </ol>
    </section>
    <section class="purchase" aria-labelledby="purchase-title">
      <div><p class="eyebrow">Own the little journey</p><h2 id="purchase-title">One puzzle is free.<br>All three are $8 once.</h2></div>
      <div><p>The family unlock includes every puzzle on this device. No subscription, ads, account, or recurring fee. Sociobot/Dodo is the merchant of record.</p>${fullGame}
      <details><summary>Have a license? Restore it</summary><form id="license-form"><label for="license-token">License token</label><div class="inline-form"><input id="license-token" name="license" required autocomplete="off"><button class="button paper" type="submit">Verify license</button></div></form></details>
      <p class="form-status" role="status">${escapeHtml(license.notice)}</p></div>
    </section>
  `);
  bindCommon();
  document.querySelector<HTMLFormElement>('#create-form')?.addEventListener('submit', startRoom);
  document.querySelector<HTMLFormElement>('#join-form')?.addEventListener('submit', joinByCode);
  document.querySelector<HTMLFormElement>('#license-form')?.addEventListener('submit', restoreLicense);
}

function renderRoom(): void {
  if (!credentials) return;
  const active = document.activeElement as HTMLElement | null;
  const restoreFocus = active?.dataset.value ? `[data-value="${active.dataset.value}"]`
    : active?.dataset.send ? `[data-send="${active.dataset.send}"]` : '';
  document.title = room ? `${room.puzzleName} — Kindred Co-op` : 'Joining room — Kindred Co-op';
  if (!room) {
    shell(`<section class="room-loading"><p class="eyebrow">Room ${credentials.code}</p><h1>Finding the other lantern…</h1><p role="status">${escapeHtml(network)}</p><a class="button paper" href="/">Return home</a></section>`, 'room');
    bindCommon(); return;
  }
  const isHost = room.role === 'host';
  const invite = `${location.origin}/?join=${room.code}`;
  const mins = Math.max(0, Math.ceil((room.expiresAt * 1000 - Date.now()) / 60000));
  const connected = room.hostConnected && room.guestConnected;
  const roleName = isHost ? 'Lantern' : 'Moth';
  const options = puzzleOptions[room.puzzle] || puzzleOptions[2];
  const labels = puzzleLabels[room.puzzle] || puzzleLabels[2];
  let play = '';
  if (room.status === 'expired') {
    play = `<div class="end-note"><span class="big-symbol" aria-hidden="true">◌</span><h2>This room has gone dark</h2><p>Nothing was saved. The host can light a fresh room when you want to play again.</p><a class="button primary" href="/">Make a new room</a></div>`;
  } else if (room.status === 'complete') {
    play = `<div class="end-note celebration"><span class="big-symbol" aria-hidden="true">✦</span><h2>You carried the light all the way!</h2><p>Three puzzles, two places, one fine team. Your room will disappear on schedule.</p><a class="button primary" href="/">Finish gently</a></div>`;
  } else if (room.status === 'locked') {
    play = isHost ? `<div class="end-note"><span class="big-symbol" aria-hidden="true">❧</span><h2>The free field note is complete</h2><p>Unlock the two remaining puzzles for $8 once. Your partner plays with you—only the host needs the family license.</p><a class="button primary" href="${checkoutUrl}">Get the family game</a><details><summary>I already have a license</summary><form id="room-license-form"><label for="room-license-token">License token</label><div class="inline-form"><input id="room-license-token" name="license" required autocomplete="off"><button class="button paper" type="submit">Verify license</button></div></form></details></div>`
      : `<div class="end-note"><span class="big-symbol" aria-hidden="true">❧</span><h2>Waiting for Lantern</h2><p>Your first field note is complete. Lantern can open the two remaining puzzles.</p></div>`;
  } else if (room.status === 'solved') {
    play = `<div class="end-note celebration"><span class="big-symbol" aria-hidden="true">✓</span><h2>Signal found!</h2><p>You matched the whole ${escapeHtml(room.puzzleName.toLowerCase())}.</p>${isHost ? `<button class="button primary" data-send="next">${room.puzzle === 2 ? 'Finish the journey' : 'Open the next field note'}</button>` : '<p class="waiting-mark">Lantern will turn the page.</p>'}</div>`;
  } else {
    play = `<div class="puzzle-instructions"><p class="role-label ${isHost ? 'lantern' : 'moth'}">Your role · ${roleName}</p><h2>${escapeHtml(room.roleNote)}</h2>${isHost ? `<div class="clue-strip" aria-label="Signal order">${puzzleSolutions[room.puzzle].map((value, index) => `<span><small>${index + 1}</small><b aria-hidden="true">${symbols[value]}</b>${labels[value]}</span>`).join('')}</div>` : ''}</div>
      ${isHost && room.status === 'waiting' ? `<div class="invite-sheet"><p>Your room is ready. Send this private link to your partner:</p><code>${escapeHtml(invite)}</code><button class="button primary" data-copy="${escapeHtml(invite)}">Copy invite link</button><p class="fine-print">Invite code: <strong>${room.code}</strong></p></div>` : ''}
      ${!isHost && !room.lastSignal ? '<div class="signal-window empty-signal"><span aria-hidden="true">···</span><p>Watch here for Lantern’s signal.</p></div>' : ''}
      ${!isHost && room.lastSignal ? `<div class="signal-window"><p>Latest signal</p><strong aria-live="polite"><span aria-hidden="true">${symbols[room.lastSignal]}</span> ${escapeHtml(labels[room.lastSignal] || room.lastSignal)}</strong></div>` : ''}
      <div class="signal-pad" role="group" aria-label="${isHost ? 'Send a signal' : 'Match the signal'}">
        ${options.map(value => `<button class="symbol-button" data-value="${value}" aria-label="${isHost ? 'Send' : 'Choose'} ${labels[value]}"><span aria-hidden="true">${symbols[value]}</span><small>${labels[value]}</small></button>`).join('')}
      </div>
      <div class="progress-row" aria-live="polite"><span>${room.step} of ${room.totalSteps} matched</span><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${room.totalSteps}" aria-valuenow="${room.step}"><span style="width:${room.step / room.totalSteps * 100}%"></span></div>${room.attempts ? `<span>Fresh starts: ${room.attempts}</span>` : ''}</div>`;
  }
  shell(`<section class="room-head">
      <div><p class="eyebrow">Field note ${Math.min(room.puzzle + 1, 3)} of 3</p><h1>${escapeHtml(room.puzzleName)}</h1></div>
      <div class="room-marks"><span class="network-mark ${connected ? 'online' : ''}">${connected ? 'Together' : network}</span><span>Room ${room.code}</span><span>${mins} min left</span></div>
    </section>
    <section class="game-sheet">${play}</section>
    ${isHost && room.status !== 'expired' ? `<details class="room-controls"><summary>Room controls</summary><div><p>Only Lantern can change or end this room.</p><button class="button paper" data-extend="15">Keep for 15 min</button><button class="button paper" data-extend="30">Keep for 30 min</button><button class="text-button danger" data-send="end">End room now</button></div></details>` : ''}
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
  dialog.innerHTML = `<form method="dialog"><button class="dialog-close" aria-label="Close how to play">×</button><p class="eyebrow">Only three controls</p><h2>Look. Signal. Match.</h2><ol class="control-cards"><li><span class="control-icon" aria-hidden="true">◉</span><h3>Look</h3><p>Lantern reads the note.</p></li><li><span class="control-icon" aria-hidden="true">✦</span><h3>Signal</h3><p>Lantern taps one mark.</p></li><li><span class="control-icon" aria-hidden="true">☝</span><h3>Match</h3><p>Moth taps the same mark.</p></li></ol><button class="button primary" value="close">Ready to play</button></form>`;
  document.body.append(dialog); dialog.showModal(); dialog.addEventListener('close', () => dialog.remove());
}

async function startRoom(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector('button')!; button.setAttribute('disabled', ''); button.textContent = 'Lighting room…';
  try {
    credentials = await createRoom(Number(new FormData(form).get('expiry')), license.unlocked);
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
  if (!socket || socket.readyState !== WebSocket.OPEN) { notice = 'You are offline. Reconnect before sending a signal.'; renderRoom(); return; }
  socket.send(JSON.stringify({ type, value, expiryMinutes }));
}

async function restoreLicense(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const token = String(new FormData(form).get('license') || form.querySelector<HTMLInputElement>('input')?.value || '').trim();
  if (!token) return;
  saveLicense(token); license = { token, unlocked: false, checking: true, notice: 'Checking your family license…' };
  room ? renderRoom() : renderHome();
  license = await verifyLicense(token);
  if (license.unlocked && room && socket?.readyState === WebSocket.OPEN) { send('unlock'); notice = license.notice; }
  room ? renderRoom() : renderHome();
}

function renderLegal(kind: 'privacy' | 'terms'): void {
  const privacy = `<article class="legal"><p class="eyebrow">Plain-language promise · Updated 27 August 2026</p><h1>Privacy, kept small</h1><p class="lede">Kindred Co-op works without names, accounts, chat, ads, or behavioral profiles.</p><h2>What the game handles</h2><p>When a host makes a room, our server keeps a random invite code, two random device keys, the current puzzle, and an expiry time in memory. Signals and puzzle progress are relayed only to that room. Rooms are deleted within five minutes after expiry.</p><h2>What stays on your device</h2><p>Your browser stores the app shell for offline loading, first-run status, and—if you buy or restore the game—a license token and its last verification result. You can remove these by clearing site data.</p><h2>The only measurement</h2><p>We increment one anonymous daily page-view number. We do not store IP addresses, invite links, device fingerprints, or event trails for analytics.</p><h2>Purchases</h2><p>Sociobot and Dodo are the merchant of record and handle checkout and refunds under their own privacy terms. This game receives only a license token; it never sees card details.</p><h2>Parent and device responsibility</h2><p>An adult should choose who receives an invite link and should use normal device safety controls. Anyone with the live link can claim the second seat until the room expires. There is no open chat or public discovery.</p><h2>Questions</h2><p>Email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>.</p></article>`;
  const terms = `<article class="legal"><p class="eyebrow">Fair play terms · Updated 27 August 2026</p><h1>Terms of play</h1><p class="lede">Kindred Co-op is a small family game, provided as-is with a straightforward one-time license.</p><h2>Using the game</h2><p>You may use Kindred Co-op for personal and family play. Do not disrupt the service, probe other rooms, automate requests, or share an invite publicly. A parent or guardian is responsible for a child’s device, connection, and choice of play partner.</p><h2>Family game license</h2><p>The $8 one-time purchase unlocks all three included puzzles on devices where the license is restored. It is not a subscription. Sociobot/Dodo is the merchant of record; checkout and refunds are handled there. A refunded, expired, revoked, or wrong-product license will stop unlocking paid puzzles.</p><h2>Availability</h2><p>Rooms are temporary and may end when their chosen timer runs out or when the host ends them. Internet access is required for two-player play. The cached shell and instructions may remain available offline, but room signals cannot.</p><h2>Limits</h2><p>To the extent the law allows, the service is supplied without warranties and liability is limited to the amount paid for the license. These terms do not limit rights that cannot legally be limited.</p><h2>Contact</h2><p>Email <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p></article>`;
  document.title = `${kind === 'privacy' ? 'Privacy' : 'Terms'} — Kindred Co-op`; shell(kind === 'privacy' ? privacy : terms, 'legal'); bindCommon();
}

async function boot(): Promise<void> {
  const path = location.pathname;
  if (path === '/privacy') return renderLegal('privacy');
  if (path === '/terms') return renderLegal('terms');
  renderHome();
  fetch('/api/page-view', { method: 'POST' }).catch(() => {});
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
  if (!localStorage.getItem('kindred:onboarded')) { localStorage.setItem('kindred:onboarded', 'yes'); showHow(); }
}

addEventListener('online', () => {
  network = 'Back online';
  if (notice.startsWith('Offline')) notice = '';
  if (credentials && (!socket || socket.readyState > 1)) connect(credentials); else room ? renderRoom() : renderHome();
});
addEventListener('offline', () => {
  network = 'Offline'; notice = 'Offline — reconnect to create, join, or send a signal.';
  room ? renderRoom() : renderHome();
});
addEventListener('popstate', () => location.reload());
addEventListener('keydown', (event) => {
  if (!room || room.role !== 'guest' || room.puzzle !== 1 || room.status !== 'playing') return;
  const keys: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (keys[event.key]) { event.preventDefault(); send('answer', keys[event.key]); }
});
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
boot();
