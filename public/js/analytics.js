(() => {
  'use strict';

  const config = window.MINHOS_CONFIG || {};
  const CONSENT_KEY = 'minhos_analytics_consent_v1';
  const SESSION_KEY = 'minhos_session_id_v1';
  const UTM_KEY = 'minhos_utm_v1';
  const validId = /^[a-z0-9][a-z0-9_:-]{0,99}$/;
  const validUtm = /^[a-z0-9][a-z0-9_-]{0,99}$/;
  const allowedParamKeys = new Set([
    'component_id', 'section_id', 'cta_id', 'form_id', 'faq_id', 'placement',
    'destination_type', 'error_code'
  ]);
  const allowedEvents = new Set([
    'page_view', 'hero_impression', 'section_view', 'cta_impression', 'cta_click',
    'faq_open', 'web_error'
  ]);

  let consentState = 'unknown';
  let gaLoaded = false;
  let gaReady = false;
  let sessionId = '';
  let campaign = {};
  const observedOnce = new Set();

  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
    );
  }

  function safeSessionStorageGet(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  function safeSessionStorageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* no-op */ }
  }
  function safeLocalStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeLocalStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* no-op */ }
  }

  function sanitizeId(value, fallback) {
    const candidate = String(value || '').toLowerCase();
    return validId.test(candidate) ? candidate : fallback;
  }

  function sanitizeUtm(value) {
    const candidate = String(value || '').toLowerCase();
    return validUtm.test(candidate) ? candidate : undefined;
  }

  function getDeviceCategory() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  function initSession() {
    sessionId = safeSessionStorageGet(SESSION_KEY) || uuid();
    safeSessionStorageSet(SESSION_KEY, sessionId);

    const query = new URLSearchParams(location.search);
    const current = {
      utm_source: sanitizeUtm(query.get('utm_source')),
      utm_medium: sanitizeUtm(query.get('utm_medium')),
      utm_campaign: sanitizeUtm(query.get('utm_campaign')),
      utm_content: sanitizeUtm(query.get('utm_content'))
    };
    const hasCurrent = Object.values(current).some(Boolean);
    if (hasCurrent) safeSessionStorageSet(UTM_KEY, JSON.stringify(current));

    try {
      campaign = hasCurrent ? current : JSON.parse(safeSessionStorageGet(UTM_KEY) || '{}');
    } catch {
      campaign = {};
    }
  }

  function referrerHost() {
    if (!document.referrer) return undefined;
    try { return new URL(document.referrer).hostname || undefined; } catch { return undefined; }
  }

  function createPayload(eventName, params = {}) {
    const pagePath = location.pathname.startsWith('/') ? location.pathname : '/';
    const payload = {
      event_id: uuid(),
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      session_id: sessionId,
      consent_state: consentState,
      page_path: pagePath.split('?')[0].split('#')[0],
      page_type: 'LP',
      content_id: sanitizeId(config.contentId, 'lp_homecare_edema_program_2026'),
      campaign_id: sanitizeId(campaign.utm_campaign || config.campaignIdDefault, 'homecare_edema_program_2026'),
      variant_id: sanitizeId(config.variantId, 'visual_reference_v2'),
      device_category: getDeviceCategory(),
      schema_version: '1.0.0',
      ...campaign,
      referrer_host: referrerHost()
    };

    Object.entries(params).forEach(([key, value]) => {
      if (allowedParamKeys.has(key)) {
        payload[key] = sanitizeId(value, key === 'error_code' ? 'unknown_error' : 'unknown');
      }
    });

    // Remove undefined values and reject any accidental non-scalar free text.
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === '') delete payload[key];
    });
    return payload;
  }

  function sendFirstParty(payload) {
    const endpoint = String(config.firstPartyAnalyticsEndpoint || '');
    if (!endpoint || consentState !== 'analytics_granted') return;
    try {
      const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (!navigator.sendBeacon(endpoint, body)) {
        fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true, credentials: 'omit' }).catch(() => {});
      }
    } catch { /* analytics must never break UX */ }
  }

  function gaParams(payload) {
    const keys = [
      'content_id', 'component_id', 'section_id', 'cta_id', 'form_id', 'faq_id',
      'placement', 'destination_type', 'campaign_id', 'variant_id', 'device_category',
      'consent_state', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
      'error_code', 'schema_version'
    ];
    return keys.reduce((acc, key) => {
      if (payload[key] !== undefined) acc[key] = payload[key];
      return acc;
    }, { event_id: payload.event_id });
  }

  function track(eventName, params = {}) {
    if (!allowedEvents.has(eventName)) return;
    if (consentState !== 'analytics_granted') return;
    const payload = createPayload(eventName, params);
    sendFirstParty(payload);
    if (gaReady && typeof window.gtag === 'function') {
      window.gtag('event', eventName, gaParams(payload));
    }
  }

  function loadGoogleAnalytics() {
    const measurementId = String(config.ga4MeasurementId || '').trim();
    if (gaLoaded || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;
    gaLoaded = true;

    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=None;Secure'
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.onload = () => {
      gaReady = true;
      track('page_view', { component_id: 'lp_document' });
    };
    script.onerror = () => { gaLoaded = false; };
    document.head.appendChild(script);
  }

  function setConsent(nextState) {
    consentState = nextState === 'granted' ? 'analytics_granted' : 'analytics_denied';
    safeLocalStorageSet(CONSENT_KEY, nextState);
    const banner = document.getElementById('consent-banner');
    if (banner) banner.hidden = true;
    document.dispatchEvent(new CustomEvent('minhos:consent-visibility', { detail: { visible: false } }));

    if (nextState === 'granted') {
      loadGoogleAnalytics();
    } else {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }

  function initConsent() {
    const banner = document.getElementById('consent-banner');
    const stored = safeLocalStorageGet(CONSENT_KEY);
    if (stored === 'granted') {
      consentState = 'analytics_granted';
      loadGoogleAnalytics();
    } else if (stored === 'denied') {
      consentState = 'analytics_denied';
    } else if (banner) {
      consentState = 'unknown';
      banner.hidden = false;
      document.dispatchEvent(new CustomEvent('minhos:consent-visibility', { detail: { visible: true } }));
    }

    document.getElementById('consent-allow')?.addEventListener('click', () => setConsent('granted'));
    document.getElementById('consent-deny')?.addEventListener('click', () => setConsent('denied'));
    document.getElementById('cookie-settings-button')?.addEventListener('click', () => {
      if (banner) {
        banner.hidden = false;
        document.dispatchEvent(new CustomEvent('minhos:consent-visibility', { detail: { visible: true } }));
        document.getElementById('consent-title')?.focus?.();
      }
    });
  }

  function observeOnce(element, key, callback, options = { threshold: 0.5 }) {
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || observedOnce.has(key)) return;
        observedOnce.add(key);
        callback();
        observer.disconnect();
      });
    }, options);
    observer.observe(element);
  }

  function initImpressions() {
    observeOnce(document.getElementById('hero'), 'hero_impression', () => track('hero_impression', {
      component_id: 'hero', section_id: 'hero'
    }), { threshold: 0.4 });

    document.querySelectorAll('[data-cta-id]').forEach((element) => {
      if (element.dataset.disabled === 'true') return;
      const placement = sanitizeId(element.dataset.placement, 'other');
      const key = `cta_impression:${placement}:${element.dataset.componentId || ''}`;
      observeOnce(element, key, () => track('cta_impression', {
        cta_id: sanitizeId(element.dataset.ctaId, 'consult_edema_program'),
        component_id: sanitizeId(element.dataset.componentId, 'primary_cta'),
        placement
      }), { threshold: 0.6 });
    });
  }

  function initSectionViews() {
    if (!('IntersectionObserver' in window)) return;
    const timers = new WeakMap();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const sectionId = sanitizeId(entry.target.dataset.sectionId, 'section');
        const key = `section:${sectionId}`;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !observedOnce.has(key)) {
          const timer = window.setTimeout(() => {
            observedOnce.add(key);
            track('section_view', { section_id: sectionId, component_id: `${sectionId}_section` });
          }, 800);
          timers.set(entry.target, timer);
        } else {
          const timer = timers.get(entry.target);
          if (timer) window.clearTimeout(timer);
        }
      });
    }, { threshold: [0, 0.5, 1] });
    document.querySelectorAll('[data-section-id]').forEach((section) => observer.observe(section));
  }

  function initClicks() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-cta-id]') : null;
      if (!target || target.dataset.disabled === 'true') return;
      track('cta_click', {
        cta_id: sanitizeId(target.dataset.ctaId, 'consult_edema_program'),
        component_id: sanitizeId(target.dataset.componentId, 'primary_cta'),
        placement: sanitizeId(target.dataset.placement, 'other'),
        destination_type: sanitizeId(target.dataset.destinationType, 'form')
      });
    }, { capture: true });
  }

  function initFaq() {
    document.querySelectorAll('.faq-item[data-faq-id]').forEach((item) => {
      const button = item.querySelector('button[aria-expanded]');
      if (!button) return;
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-expanded') === 'true') return;
        track('faq_open', {
          faq_id: sanitizeId(item.dataset.faqId, 'faq_item'),
          component_id: 'faq_accordion',
          section_id: 'faq'
        });
      });
    });
  }

  function initErrors() {
    window.addEventListener('error', () => track('web_error', {
      error_code: 'window_error', component_id: 'document'
    }));
    window.addEventListener('unhandledrejection', () => track('web_error', {
      error_code: 'unhandled_rejection', component_id: 'document'
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSession();
    initConsent();
    initImpressions();
    initSectionViews();
    initClicks();
    initFaq();
    initErrors();
  });

  window.MINHOS_ANALYTICS = Object.freeze({ track });
})();
