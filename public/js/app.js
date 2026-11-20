import { config } from './config.js';
import { initAnalytics } from './analytics.js';

const tokyoOffsetMs = 9 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

function initEventDate() {
  const event = document.querySelector('[data-event-date]');
  if (!event) return;
  const heading = event.querySelector('[data-next-heading]');
  const fallback = document.querySelector('.next-missing');
  const section = document.getElementById('next');
  const eventDate = event.dataset.eventDate;
  let timer;

  function refresh() {
    window.clearTimeout(timer);
    const shifted = Date.now() + tokyoOffsetMs;
    const today = new Date(shifted).toISOString().slice(0, 10);
    const elapsed = today > eventDate;
    event.hidden = elapsed;
    fallback.hidden = !elapsed;
    section.setAttribute('aria-labelledby', elapsed ? 'next-fallback-heading' : heading.id);
    heading.textContent = today === eventDate ? '本日の勉強会' : '次回の勉強会';
    if (!elapsed) timer = window.setTimeout(refresh, dayMs - shifted % dayMs + 100);
  }
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

initEventDate();
initAnalytics(config);
