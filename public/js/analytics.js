const measurementIdPattern = /^G-[A-Z0-9]{6,15}$/;
const occurrencePattern = /^[a-z][a-z0-9_-]{0,59}$/;
const ctaContract = {
  wellbe_consult: { locations: ['hero', 'education', 'final'], type: 'consultation_form' },
  wellbe_next_register: { locations: ['next'], type: 'lecture_registration' }
};

export function analyticsAvailable(config, location) {
  return config.mode === 'release' && location.protocol === 'https:' && location.origin === config.origin &&
    location.pathname.startsWith(config.basePath) && measurementIdPattern.test(config.measurementId ?? '');
}

function onLanding(config, location) {
  return location.pathname === config.basePath || location.pathname === config.basePath + 'index.html';
}

export function clickParams(config, anchor) {
  if (anchor.tagName !== 'A' || !anchor.href || anchor.hidden || anchor.getAttribute('aria-disabled') === 'true') return null;
  const { cta, ctaLoc, targetType, occurrenceId, lpSlug } = anchor.dataset;
  if (!Object.hasOwn(ctaContract, cta)) return null;
  const contract = ctaContract[cta];
  if (!contract.locations.includes(ctaLoc) || contract.type !== targetType || lpSlug !== 'wellbe') return null;
  if (cta === 'wellbe_next_register' && !occurrencePattern.test(occurrenceId ?? '')) return null;
  let destination;
  try { destination = new URL(anchor.href); } catch { return null; }
  if (destination.protocol !== 'https:' || destination.username || destination.password) return null;
  const label = config.ctaLabels?.[cta];
  if (!label) return null;
  const params = {
    page_type: 'lp',
    page_path: config.basePath,
    lp_slug: 'wellbe',
    cta_id: cta,
    cta_loc: ctaLoc,
    cta_label: label,
    target_type: targetType,
    target_domain: destination.hostname,
    // A form identifier or a token embedded in a URL path is not an analytics field.
    target_path: destination.hostname === 'docs.google.com' && destination.pathname.startsWith('/forms/') ? '/forms/' : '/'
  };
  if (cta === 'wellbe_next_register') params.occurrence_id = occurrenceId;
  return params;
}

// The transport is created only after an opt-in on the canonical production LP.
export function createTracker(config, location, connect) {
  const eligible = analyticsAvailable(config, location) && onLanding(config, location);
  const page = {
    page_type: 'lp',
    page_path: config.basePath,
    lp_slug: 'wellbe',
    page_location: config.origin + config.basePath,
    page_referrer: ''
  };
  let optedIn = false;
  let transport;

  return {
    consent(allowed) {
      if (!eligible) return;
      optedIn = allowed;
      if (optedIn && !transport) {
        transport = connect(config, page);
        transport.send('page_view', page);
      } else {
        transport?.setEnabled(optedIn);
      }
    },
    click(anchor) {
      if (!optedIn || !transport) return;
      const params = clickParams(config, anchor);
      if (params) transport.send('lp_cta_click', { ...page, ...params });
    }
  };
}

function googleTag(config, page) {
  const id = config.measurementId;
  const disableKey = 'ga-disable-' + id;
  window[disableKey] = false;
  window.dataLayer ||= [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  gtag('set', { page_location: page.page_location, page_referrer: '' });
  gtag('js', new Date());
  gtag('config', id, {
    page_location: page.page_location,
    page_referrer: '',
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_prefix: 'wellbe',
    cookie_path: config.basePath
  });
  const script = document.createElement('script');
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.append(script);
  return {
    send(name, parameters) { gtag('event', name, { ...parameters, send_to: id }); },
    setEnabled(enabled) { window[disableKey] = !enabled; }
  };
}

export function initAnalytics(config) {
  const dialog = document.getElementById('cookie-dialog');
  const settings = document.getElementById('cookie-settings');
  if (!dialog?.showModal || !settings) return;
  const notice = document.getElementById('consent-notice');
  const available = analyticsAvailable(config, window.location);
  const onLp = onLanding(config, window.location);
  const tracker = createTracker(config, window.location, googleTag);
  let preference = null;
  let opener = null;

  if (available) {
    try { preference = localStorage.getItem(config.consentKey); } catch { /* The choice lasts for this page. */ }
    if (!['accepted', 'declined'].includes(preference)) preference = null;
  }

  function update() {
    tracker.consent(preference === 'accepted');
    notice.hidden = !available || !onLp || preference !== null;
    document.getElementById('cookie-description').textContent = !available
      ? '現在、このページではアクセス解析を行っていません。'
      : '同意すると、ページ閲覧と相談・参加登録の案内リンクの利用状況を計測します。' +
        (preference === 'accepted' ? ' 現在は同意しています。' : preference === 'declined' ? ' 現在は同意していません。' : '');
  }

  function show(event) {
    opener = event.currentTarget;
    if (!dialog.open) dialog.showModal();
  }

  settings.hidden = false;
  settings.addEventListener('click', show);
  document.getElementById('consent-open').addEventListener('click', show);
  dialog.addEventListener('close', () => (opener?.offsetParent ? opener : settings).focus({ preventScroll: true }));
  for (const button of dialog.querySelectorAll('[data-consent]')) {
    button.hidden = !available;
    button.addEventListener('click', () => {
      preference = button.dataset.consent;
      try { localStorage.setItem(config.consentKey, preference); } catch { /* The choice lasts for this page. */ }
      update();
      dialog.close();
    });
  }
  if (available) {
    window.addEventListener('storage', (event) => {
      if (event.key !== config.consentKey && event.key !== null) return;
      preference = ['accepted', 'declined'].includes(event.newValue) ? event.newValue : null;
      update();
    });
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[data-cta]');
      if (anchor && !anchor.closest('[hidden]')) tracker.click(anchor);
    });
  }
  update();
}
