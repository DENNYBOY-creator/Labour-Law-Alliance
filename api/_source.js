// Shared helper (not a route: files starting with "_" are ignored by Vercel).
// Turns a referrer URL and UTM tags into a plain traffic source name.
const OWN = /(^|\.)labourlawalliance\.co\.za$|^labour-kappa\.vercel\.app$/;

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

export function classify(referrer, utmSource, utmMedium) {
  const s = String(utmSource || '').toLowerCase(), m = String(utmMedium || '').toLowerCase();
  if (s) {
    if (/google/.test(s) && /cpc|ppc|paid|ads/.test(m)) return 'Google Ads';
    if (/gbp|business|maps/.test(s) || /gbp|maps/.test(m)) return 'Google Business Profile';
    if (/google/.test(s)) return 'Google search';
    if (/facebook|fb|meta/.test(s)) return 'Facebook';
    if (/instagram|ig/.test(s)) return 'Instagram';
    if (/linkedin/.test(s)) return 'LinkedIn';
    if (/whatsapp|wa/.test(s)) return 'WhatsApp';
    if (/email|newsletter|mail/.test(s) || /email/.test(m)) return 'Email';
    return s.slice(0, 40);
  }
  const h = hostOf(referrer);
  if (!h || OWN.test(h)) return 'Direct';
  if (/(^|\.)google\./.test(h)) return /maps|business/.test(h) ? 'Google Business Profile' : 'Google search';
  if (/bing\.com$|duckduckgo\.com$|yahoo\.|ecosia\.org$|brave\.com$/.test(h)) return 'Other search engines';
  if (/facebook\.com$|fb\.com$|fb\.me$|m\.facebook\.com$|l\.facebook\.com$/.test(h)) return 'Facebook';
  if (/instagram\.com$/.test(h)) return 'Instagram';
  if (/linkedin\.com$|lnkd\.in$/.test(h)) return 'LinkedIn';
  if (/whatsapp\.(com|net)$|wa\.me$/.test(h)) return 'WhatsApp';
  if (/t\.co$|twitter\.com$|x\.com$/.test(h)) return 'X (Twitter)';
  if (/tiktok\.com$/.test(h)) return 'TikTok';
  if (/chatgpt\.com$|openai\.com$|perplexity\.ai$|claude\.ai$|gemini\.google\.com$|copilot\.microsoft\.com$/.test(h)) return 'AI assistants';
  if (/mail\.|outlook\.|gmail\./.test(h)) return 'Email';
  return 'Other websites';
}
