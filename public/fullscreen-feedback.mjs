import { attachButtonMotion, attachDirectionalReveal } from './button-motion.mjs';

// Compatibility entry points: the player keeps its existing interaction API.
export function attachFullscreenFeedback(button, doc = document) {
  return attachButtonMotion(button, doc, { particles: true });
}
export function attachPipFeedback(button, doc = document) {
  attachDirectionalReveal(button, button.querySelector('.pip-border'), doc);
}
