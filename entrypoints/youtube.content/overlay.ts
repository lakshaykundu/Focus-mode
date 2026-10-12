/**
 * The "not part of this focus session" cover shown over YouTube's player. It lives in a shadow
 * root so YouTube's styles can't touch it; page-provided strings (channel names, categories) are
 * only ever set via textContent, and buttons ignore untrusted (scripted) clicks.
 */

export interface OverlayModel {
  reason: 'category' | 'unknown';
  /** Category name as YouTube reports it. */
  category: string | null;
  channelName: string | null;
  allowedLabels: string[];
  /** Strict Mode hides the override buttons. */
  canOverride: boolean;
  canAllowChannel: boolean;
}

export interface OverlayHandlers {
  onAllowVideo(): Promise<string | null>;
  onAllowChannel(): Promise<string | null>;
}

const STYLES = `
:host { all: initial; }
.backdrop {
  position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
  background: rgb(10 10 11 / 0.95); backdrop-filter: blur(14px);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #ededef; text-align: center; -webkit-font-smoothing: antialiased;
}
.card { max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.icon { width: 40px; height: 40px; }
h2 { margin: 4px 0 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
p { margin: 0; font-size: 13px; line-height: 1.5; color: #a1a1aa; }
strong { color: #ededef; font-weight: 600; }
.channel { font-size: 12px; color: #71717a; }
.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
button {
  all: unset; box-sizing: border-box; cursor: pointer; height: 34px; padding: 0 14px; border-radius: 8px;
  font-size: 13px; font-weight: 500; border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(255 255 255 / 0.05); color: #ededef; transition: background 120ms;
}
button:hover { background: rgb(255 255 255 / 0.09); }
button:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
button[disabled] { opacity: 0.5; cursor: default; }
.strict { display: flex; gap: 8px; align-items: flex-start; text-align: left; margin-top: 6px;
  padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 1.45;
  border: 1px solid rgb(251 191 36 / 0.25); background: rgb(251 191 36 / 0.1); color: #fde68a; }
.error { font-size: 12px; color: #f87171; min-height: 1em; }
.note { margin-top: 4px; font-size: 11px; color: #52525b; }
`;

const SHIELD_SVG = `<svg viewBox="0 0 512 512" class="icon" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#10b981"/></linearGradient></defs><path d="M256 72 L392 124 V240 C392 332 333 400 256 432 C179 400 120 332 120 240 V124 Z" fill="none" stroke="url(#g)" stroke-width="30" stroke-linejoin="round"/><circle cx="256" cy="246" r="44" fill="url(#g)"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function listLabels(labels: string[]): string {
  if (labels.length === 0) return 'no categories';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

export function createVideoOverlay(handlers: OverlayHandlers) {
  let host: HTMLElement | null = null;
  let renderedKey = '';

  function mountPoint(): { parent: HTMLElement; fixed: boolean } {
    const player = document.getElementById('movie_player');
    return player ? { parent: player, fixed: false } : { parent: document.body, fixed: true };
  }

  function render(model: OverlayModel): HTMLElement {
    const node = document.createElement('focusguard-video-overlay');
    const root = node.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = STYLES;
    const backdrop = el('div', 'backdrop');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-label', 'Video blocked by FocusGuard');
    const card = el('div', 'card');

    const icon = el('div');
    icon.innerHTML = SHIELD_SVG; // static, extension-authored markup
    card.append(icon.firstElementChild!);
    card.append(el('h2', undefined, 'Not part of this focus session'));

    const reason = el('p');
    if (model.reason === 'category' && model.category) {
      reason.append('YouTube lists this video as ', el('strong', undefined, model.category), '. ');
    } else {
      reason.append("FocusGuard couldn't read this video's category. ");
    }
    reason.append(`Your filter allows ${listLabels(model.allowedLabels)}.`);
    card.append(reason);
    if (model.channelName) card.append(el('p', 'channel', `Channel: ${model.channelName}`));

    const error = el('p', 'error');
    error.setAttribute('role', 'alert');

    if (model.canOverride) {
      const actions = el('div', 'actions');
      const buttons: HTMLButtonElement[] = [];
      const wire = (label: string, action: () => Promise<string | null>) => {
        const button = el('button', undefined, label);
        button.type = 'button';
        button.addEventListener('click', async (event) => {
          // Only real user clicks count; the page can't script its way past the overlay.
          if (!event.isTrusted) return;
          buttons.forEach((b) => (b.disabled = true));
          error.textContent = '';
          const message = await action();
          if (message) {
            error.textContent = message;
            buttons.forEach((b) => (b.disabled = false));
          }
        });
        buttons.push(button);
        actions.append(button);
      };
      wire('Allow this video', handlers.onAllowVideo);
      if (model.canAllowChannel && model.channelName) {
        wire(`Always allow ${model.channelName}`, handlers.onAllowChannel);
      }
      card.append(actions, error);
    } else {
      card.append(
        el('div', 'strict', "Strict Mode is on, so this video can't be allowed until the session ends."),
      );
    }
    card.append(el('p', 'note', 'Based on the category the uploader chose on YouTube.'));

    backdrop.append(card);
    root.append(style, backdrop);
    // Keep clicks and keys inside the overlay from reaching YouTube's player shortcuts.
    for (const type of ['click', 'dblclick', 'keydown', 'keyup', 'pointerdown'] as const) {
      node.addEventListener(type, (event) => event.stopPropagation());
    }
    return node;
  }

  return {
    show(model: OverlayModel) {
      const key = JSON.stringify(model);
      const { parent, fixed } = mountPoint();
      if (host && host.isConnected && host.parentElement === parent && key === renderedKey) return;
      host?.remove();
      host = render(model);
      renderedKey = key;
      Object.assign(host.style, {
        position: fixed ? 'fixed' : 'absolute',
        inset: '0',
        zIndex: '2147483000',
        display: 'block',
      });
      parent.append(host);
    },
    hide() {
      host?.remove();
      host = null;
      renderedKey = '';
    },
    get visible() {
      return host?.isConnected ?? false;
    },
  };
}
