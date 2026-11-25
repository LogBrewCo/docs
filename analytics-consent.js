// The cookie banner and Google Analytics, with the same choice and rules as logbrew.co. Nothing from
// Google loads until the visitor selects Accept. After Accept, Consent Mode starts with every
// storage type denied and turns on analytics storage only: ads storage, ads data, ads
// personalization, and Google signals stay off. Reject sends nothing. Cookie Settings in the footer
// opens the banner again, and a Reject after an Accept removes the Google Analytics cookies.
(() => {
  const MEASUREMENT_ID = "G-4S00TDZX4M";
  const CHOICE_KEY = "logbrew_analytics";
  const CHOICE_DAYS = 183;
  const GA_COOKIE_DAYS = 395;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CAMPAIGN_PARAMETERS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"];
  const CAMPAIGN_VALUE = /^[\w .+-]{1,100}$/u;

  // The wording of the logbrew.co banner in each docs language.
  const COPY = {
    en: { label: "Analytics cookies", body: "Allow analytics cookies? Google Analytics shows LogBrew which pages help. No ads.", privacy: "Privacy Policy", accept: "Accept", reject: "Reject", settings: "Cookie Settings" },
    tr: { label: "Analiz çerezleri", body: "Analiz çerezlerine izin veriyor musun? Google Analytics, LogBrew'a hangi sayfaların işe yaradığını gösterir. Reklam yok.", privacy: "Gizlilik Politikası", accept: "Kabul Et", reject: "Reddet", settings: "Çerez Ayarları" },
    de: { label: "Analyse-Cookies", body: "Analyse-Cookies erlauben? Google Analytics zeigt LogBrew, welche Seiten helfen. Keine Werbung.", privacy: "Datenschutzrichtlinie", accept: "Akzeptieren", reject: "Ablehnen", settings: "Cookie-Einstellungen" },
    es: { label: "Cookies de analítica", body: "¿Permites cookies de analítica? Google Analytics muestra a LogBrew qué páginas ayudan. Sin anuncios.", privacy: "Política de privacidad", accept: "Aceptar", reject: "Rechazar", settings: "Configuración de cookies" },
    ja: { label: "分析用 Cookie", body: "分析用 Cookie を許可しますか？Google Analytics で、役立つページを LogBrew が把握します。広告はありません。", privacy: "プライバシーポリシー", accept: "許可", reject: "拒否", settings: "Cookie 設定" },
    fr: { label: "Cookies d’analyse", body: "Autoriser les cookies d’analyse ? Google Analytics montre à LogBrew les pages utiles. Aucune publicité.", privacy: "Politique de confidentialité", accept: "Accepter", reject: "Refuser", settings: "Paramètres des cookies" },
    "pt-BR": { label: "Cookies de analytics", body: "Permitir cookies de analytics? O Google Analytics mostra ao LogBrew quais páginas ajudam. Sem anúncios.", privacy: "Política de Privacidade", accept: "Aceitar", reject: "Recusar", settings: "Configurações de Cookies" },
    it: { label: "Cookie analitici", body: "Consenti i cookie analitici? Google Analytics mostra a LogBrew quali pagine aiutano. Niente pubblicità.", privacy: "Informativa sulla privacy", accept: "Accetta", reject: "Rifiuta", settings: "Impostazioni cookie" },
    nl: { label: "Analysecookies", body: "Analysecookies toestaan? Google Analytics laat LogBrew zien welke pagina's helpen. Geen advertenties.", privacy: "Privacybeleid", accept: "Accepteren", reject: "Weigeren", settings: "Cookie-instellingen" },
    vi: { label: "Cookie phân tích", body: "Cho phép cookie phân tích? Google Analytics cho LogBrew biết trang nào hữu ích. Không có quảng cáo.", privacy: "Chính sách quyền riêng tư", accept: "Chấp nhận", reject: "Từ chối", settings: "Cài đặt cookie" },
    "zh-Hans": { label: "分析 Cookie", body: "允许分析 Cookie 吗？Google Analytics 帮 LogBrew 了解哪些页面有用。没有广告。", privacy: "隐私政策", accept: "接受", reject: "拒绝", settings: "Cookie 设置" },
    ko: { label: "분석 쿠키", body: "분석 쿠키를 허용할까요? Google Analytics로 LogBrew가 도움이 되는 페이지를 알 수 있어요. 광고는 없어요.", privacy: "개인정보 처리방침", accept: "허용", reject: "거부", settings: "쿠키 설정" },
    id: { label: "Cookie analitik", body: "Izinkan cookie analitik? Google Analytics menunjukkan ke LogBrew halaman mana yang membantu. Tanpa iklan.", privacy: "Kebijakan Privasi", accept: "Terima", reject: "Tolak", settings: "Pengaturan Cookie" },
    pl: { label: "Analityczne pliki cookie", body: "Zezwolić na analityczne pliki cookie? Google Analytics pokazuje LogBrew, które strony pomagają. Bez reklam.", privacy: "Polityka prywatności", accept: "Akceptuj", reject: "Odrzuć", settings: "Ustawienia cookie" },
    ar: { label: "ملفات تعريف الارتباط التحليلية", body: "هل تسمح بملفات تعريف الارتباط التحليلية؟ يُظهر Google Analytics لـ LogBrew الصفحات المفيدة. لا إعلانات.", privacy: "سياسة الخصوصية", accept: "قبول", reject: "رفض", settings: "إعدادات ملفات تعريف الارتباط" },
  };

  const localeOf = (path) => {
    const first = path.split("/")[1] ?? "";
    return Object.hasOwn(COPY, first) ? first : "en";
  };

  // The saved choice, or null when there is none or it is older than 6 months.
  const savedChoice = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "null");
      const known = saved?.choice === "granted" || saved?.choice === "denied";
      return known && saved.expires > Date.now() ? saved.choice : null;
    } catch {
      return null;
    }
  };

  const saveChoice = (choice) => {
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify({ choice, expires: Date.now() + CHOICE_DAYS * DAY_MS }));
    } catch {
      // Blocked storage keeps the choice for this page only.
    }
  };

  // A page address with no query value except the campaign tags, and no fragment.
  const safeLocation = (href) => {
    const url = new URL(href);
    const safe = new URL(url.pathname, url.origin);
    for (const name of CAMPAIGN_PARAMETERS) {
      const value = url.searchParams.get(name);
      if (value !== null && CAMPAIGN_VALUE.test(value)) safe.searchParams.set(name, value);
    }
    return safe.href;
  };

  // Another site's origin as the browser sent it, or a docs page made safe.
  const safeReferrer = (referrer) => {
    try {
      const url = new URL(referrer);
      return url.origin === location.origin ? safeLocation(referrer) : `${url.origin}/`;
    } catch {
      return "";
    }
  };

  const pageView = (referrer) => ({
    locale: localeOf(location.pathname),
    page_location: safeLocation(location.href),
    page_referrer: referrer,
    page_title: document.title.slice(0, 100),
    page_type: "docs",
  });

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  let started = false;
  let lastPath = location.pathname;
  let lastLocation = "";

  // The tag of this property ignores the fields of an on-page `config` and honors them from `set`.
  const start = () => {
    if (started) return;
    started = true;
    const page = pageView(safeReferrer(document.referrer));
    lastLocation = page.page_location;
    gtag("consent", "default", {
      ad_personalization: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      analytics_storage: "denied",
    });
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("set", {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      cookie_expires: GA_COOKIE_DAYS * 24 * 60 * 60,
      send_page_view: false,
    });
    gtag("set", page);
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID);
    gtag("event", "page_view", page);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.append(script);
  };

  // The docs change pages without a page load; each new path is a page view.
  window.addEventListener("mintlify:navigate", () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (!started) return;
    // The new page's title is in place one frame after the route changes.
    requestAnimationFrame(() => {
      const page = pageView(lastLocation);
      lastLocation = page.page_location;
      gtag("set", page);
      gtag("event", "page_view", page);
    });
  });

  const removeAnalyticsCookies = () => {
    const host = location.hostname;
    const domains = ["", host, host.split(".").slice(-2).join(".")];
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (!name.startsWith("_ga")) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/${domain && `; Domain=${domain}`}`;
      }
    }
  };

  let banner = null;
  let opener = null;

  const closeBanner = () => {
    banner?.remove();
    banner = null;
    document.body.style.removeProperty("padding-bottom");
    opener?.focus();
    opener = null;
  };

  const decide = (choice) => {
    const withdrawn = choice === "denied" && started;
    saveChoice(choice);
    closeBanner();
    if (choice === "granted") start();
    // The loaded tag keeps listening to the page, so only a new page load removes it. Until then,
    // denied storage stops it from writing its cookies again after they are removed.
    if (withdrawn) {
      gtag("consent", "update", { analytics_storage: "denied" });
      removeAnalyticsCookies();
      location.reload();
    }
  };

  const button = (text, choice) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = text;
    element.addEventListener("click", () => decide(choice));
    return element;
  };

  // The banner sits at the bottom of the window. The page gets room below its footer for it, so
  // every line of the page can still scroll into view above it.
  const openBanner = () => {
    if (banner) return;
    const locale = localeOf(location.pathname);
    const copy = COPY[locale];
    banner = document.createElement("section");
    banner.className = "lb-consent";
    banner.setAttribute("aria-label", copy.label);
    const text = document.createElement("p");
    const privacy = document.createElement("a");
    privacy.href = `https://logbrew.co/${locale}/privacy`;
    privacy.textContent = copy.privacy;
    text.append(`${copy.body} `, privacy);
    const actions = document.createElement("div");
    actions.className = "lb-consent-actions";
    actions.append(button(copy.reject, "denied"), button(copy.accept, "granted"));
    banner.append(text, actions);
    document.body.prepend(banner);
    new ResizeObserver(() => {
      if (banner) document.body.style.paddingBottom = `${banner.offsetHeight + 16}px`;
    }).observe(banner);
  };

  // Cookie Settings in the footer. The docs render the footer again on page changes, so it is
  // added back whenever it is missing.
  let pending = false;
  const addSettingsButton = () => {
    pending = false;
    const footer = document.getElementById("footer");
    if (!footer) return;
    const label = COPY[localeOf(location.pathname)].settings;
    const existing = footer.querySelector(".lb-cookie-settings");
    if (existing) {
      if (existing.textContent !== label) existing.textContent = label;
      return;
    }
    const settings = document.createElement("button");
    settings.type = "button";
    settings.className = "lb-cookie-settings";
    settings.textContent = label;
    settings.addEventListener("click", () => {
      opener = settings;
      openBanner();
      banner?.querySelector("button")?.focus();
    });
    const row = document.createElement("div");
    row.className = "lb-cookie-row";
    row.append(settings);
    footer.append(row);
  };

  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(addSettingsButton);
  }).observe(document.body, { childList: true, subtree: true });
  addSettingsButton();

  const choice = savedChoice();
  if (choice === "granted") start();
  else if (choice === null) openBanner();
})();
