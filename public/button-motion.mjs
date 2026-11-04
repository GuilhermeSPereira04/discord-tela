const attached = new WeakSet();

// Shared by filled buttons and PiP's contour. The real action stays in its own
// synchronous listener; this controller never waits on an animation.
export function attachDirectionalReveal(button, surface, doc) {
  const view = doc.defaultView;
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');
  let pointed = finePointer.matches && button.matches(':hover');
  function refreshFill() {
    const active = !button.disabled && ((pointed && finePointer.matches) || button.matches(':focus-visible'));
    if (active) button.dataset.fillState = 'hover';
    else if (button.dataset.fillState !== 'idle') button.dataset.fillState = reducedMotion.matches ? 'idle' : 'out';
  }
  button.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch' || !finePointer.matches) return;
    pointed = true; refreshFill();
  });
  button.addEventListener('pointerleave', () => { pointed = false; refreshFill(); });
  button.addEventListener('focus', refreshFill);
  button.addEventListener('blur', refreshFill);
  surface.addEventListener('transitionend', event => {
    if (event.propertyName.endsWith('clip-path') && button.dataset.fillState === 'out') button.dataset.fillState = 'idle';
  });
  reducedMotion.addEventListener('change', refreshFill);
  finePointer.addEventListener('change', refreshFill);
  refreshFill();
  return reducedMotion;
}

export function attachButtonMotion(button, doc = document, { particles = false } = {}) {
  if (attached.has(button)) return;
  attached.add(button);
  button.classList.add('motion-button');
  button.dataset.fillState = 'idle';
  let content = button.querySelector('.button-motion-content, .player-control-content');
  if (!content) {
    content = doc.createElement('span');
    content.append(...button.childNodes);
    button.append(content);
  }
  content.classList.add('button-motion-content');
  const surface = doc.createElement('span');
  surface.className = 'button-motion-surface'; surface.setAttribute('aria-hidden', 'true');
  const wipe = doc.createElement('span'); wipe.className = 'button-motion-wipe';
  const ink = content.cloneNode(true);
  // Alias retained for the player's dynamic Tela cheia / Voltar icon labels.
  ink.classList.add('button-motion-ink', 'fullscreen-ink');
  ink.removeAttribute('id');
  ink.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  wipe.append(ink); surface.append(wipe); button.append(surface);
  const reducedMotion = attachDirectionalReveal(button, wipe, doc);
  if (!particles) return;
  const layer = doc.createElement('span');
  layer.className = 'button-motion-particles'; layer.setAttribute('aria-hidden', 'true');
  button.append(layer);
  const active = new Set();
  const duration = Number.parseFloat(doc.defaultView.getComputedStyle(button).getPropertyValue('--duration-click-particles')) || 350;
  const routes = [{x:12,dx:-9,dy:-15},{x:30,dx:-5,dy:-22},{x:50,dx:1,dy:-18},{x:70,dx:5,dy:-23},{x:88,dx:9,dy:-15}];
  const dots = routes.map(route => {
    const dot = doc.createElement('span'); dot.className = 'button-motion-particle';
    dot.style.left = `${route.x}%`; layer.append(dot); return dot;
  });
  function cancel() { for (const animation of Array.from(active)) animation.cancel(); active.clear(); }
  button.addEventListener('click', () => {
    cancel();
    if (reducedMotion.matches || button.disabled) return;
    dots.forEach((dot, index) => {
      if (typeof dot.animate !== 'function') return;
      const {dx,dy} = routes[index];
      const animation = dot.animate([
        {opacity:0,transform:'translate3d(0, 2px, 0) scale(.6)'},
        {offset:.14,opacity:.6,transform:`translate3d(${dx*.2}px, ${dy*.2}px, 0) scale(1)`},
        {opacity:0,transform:`translate3d(${dx}px, ${dy}px, 0) scale(.2)`},
      ], {duration,easing:'cubic-bezier(.2,.7,.3,1)'});
      active.add(animation);
      animation.onfinish = () => { active.delete(animation); animation.cancel(); };
      animation.oncancel = () => active.delete(animation);
    });
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) cancel(); });
}
