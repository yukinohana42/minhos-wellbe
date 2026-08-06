(() => {
  'use strict';

  const config = window.MINHOS_CONFIG || {};
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isUsableHttpsUrl(value = '') {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }

  function showToast(message) {
    const toast = document.getElementById('config-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 7000);
  }

  function configureApplicationLinks() {
    const ready = isUsableHttpsUrl(config.applicationUrl);
    document.querySelectorAll('.js-application-link').forEach((link) => {
      link.dataset.destinationType = 'form';
      if (ready) {
        link.href = config.applicationUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.disabled = 'false';
        link.removeAttribute('aria-disabled');
        return;
      }
      link.href = '#application';
      link.dataset.disabled = 'true';
      link.setAttribute('aria-disabled', 'true');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById('application')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        showToast('導入相談フォームは現在準備中です。');
      });
    });
    document.querySelectorAll('.form-status').forEach((status) => { status.hidden = ready; });
  }

  function initFaq() {
    document.querySelectorAll('.faq-item button[aria-controls]').forEach((button) => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      button.addEventListener('click', () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!isOpen));
        panel.hidden = isOpen;
      });
    });
  }

  function initNavigation() {
    const button = document.querySelector('.menu-button');
    const nav = document.getElementById('primary-nav');
    if (!button || !nav) return;
    const setOpen = (open) => {
      button.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (event) => { if (event.target instanceof HTMLAnchorElement) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 820) setOpen(false); }, { passive: true });
  }

  function initStickyCta() {
    const sticky = document.getElementById('sticky-cta');
    const heroCta = document.querySelector('[data-component-id="hero_primary_cta"]');
    const footer = document.getElementById('footer');
    if (!sticky || !heroCta || !footer) return;
    let ticking = false;
    const update = () => {
      const mobile = window.innerWidth <= 820;
      const heroPassed = heroCta.getBoundingClientRect().bottom < 0;
      const footerReached = footer.getBoundingClientRect().top < window.innerHeight;
      sticky.hidden = !mobile || !heroPassed || footerReached;
      ticking = false;
    };
    const requestUpdate = () => {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function initScrollProgress() {
    const bar = document.getElementById('scroll-progress-bar');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0) * 100}%`;
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  function initCopyright() {
    const year = document.getElementById('copyright-year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  document.addEventListener('DOMContentLoaded', () => {
    configureApplicationLinks();
    initNavigation();
    initFaq();
    initStickyCta();
    initScrollProgress();
    initCopyright();
  });

  document.addEventListener('minhos:consent-visibility', (event) => {
    document.body.classList.toggle('consent-open', Boolean(event.detail?.visible));
  });
})();
