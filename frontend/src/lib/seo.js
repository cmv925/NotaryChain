/**
 * SEO / AEO (Answer Engine Optimization) constants and JSON-LD builders.
 *
 * These power per-page <Seo> tags and structured data so search engines AND
 * answer engines (Google AI Overviews, Perplexity, ChatGPT, Bing) can
 * understand, cite, and rank NotaryChain content.
 */

export const SITE_URL =
  process.env.REACT_APP_SITE_URL ||
  (typeof window !== 'undefined' && window.location && window.location.origin) ||
  'https://notarychain.app';

export const SITE = {
  name: 'NotaryChain',
  tagline: 'AI-Powered Online Notarization & Blockchain Escrow',
  description:
    'NotaryChain is the AI-powered online notarization platform. Every document is scanned by AI forensics for tampering, every signer is biometrically identity-proofed, and every seal is cryptographically anchored on the Hedera public blockchain — court-admissible the moment it is complete. Florida RON-compliant.',
  logo: '/icon-512.png',
  ogImage: '/icon-512.png',
  twitter: '@notarychain',
  knowsAbout: [
    'Remote Online Notarization',
    'Blockchain notarization',
    'Florida RON compliance',
    'Document verification',
    'Digital escrow',
    'Identity proofing (KBA)',
    'Hedera Hashgraph',
    'Smart contract escrow',
  ],
};

const abs = (path = '/') => `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

/** Organization — the publisher entity behind every page. */
export const orgSchema = () => ({
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE.name,
  url: SITE_URL,
  logo: abs(SITE.logo),
  description: SITE.description,
  areaServed: { '@type': 'Country', name: 'United States' },
  knowsAbout: SITE.knowsAbout,
});

/** WebSite — names the site for sitelinks/branding. */
export const websiteSchema = () => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE.name,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
});

/** SoftwareApplication — describes the product itself. */
export const softwareSchema = () => ({
  '@type': 'SoftwareApplication',
  name: SITE.name,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: SITE.description,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
});

/** BreadcrumbList from [{name, path}] (path omitted for the current page). */
export const breadcrumbSchema = (items = []) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    ...(it.path ? { item: abs(it.path) } : {}),
  })),
});

/** FAQPage from [{q, a}] — heavily used by answer engines for direct citations. */
export const faqSchema = (qas = []) => ({
  '@type': 'FAQPage',
  mainEntity: qas.map((qa) => ({
    '@type': 'Question',
    name: qa.q,
    acceptedAnswer: { '@type': 'Answer', text: qa.a },
  })),
});

/** Service — for offering pages (e.g. RON in a given state). */
export const serviceSchema = ({ name, description, areaServed, serviceType }) => ({
  '@type': 'Service',
  name,
  description,
  serviceType: serviceType || 'Online Notarization',
  provider: { '@id': `${SITE_URL}/#organization` },
  ...(areaServed ? { areaServed } : { areaServed: { '@type': 'Country', name: 'United States' } }),
});

/** ProfessionalService / notary public profile (local SEO). */
export const notarySchema = ({ name, state, url, id }) => ({
  '@type': ['ProfessionalService', 'LegalService'],
  name,
  url,
  identifier: id,
  serviceType: 'Notary Public',
  areaServed: state ? { '@type': 'State', name: state } : undefined,
  provider: { '@id': `${SITE_URL}/#organization` },
});

/** Product/Offer list — for the pricing page. */
export const offerCatalogSchema = (plans = []) => ({
  '@type': 'Product',
  name: `${SITE.name} Plans`,
  description: 'Subscription plans for AI-powered online notarization and blockchain escrow.',
  brand: { '@type': 'Brand', name: SITE.name },
  offers: plans.map((p) => ({
    '@type': 'Offer',
    name: p.name,
    price: String(p.price ?? 0),
    priceCurrency: 'USD',
    url: abs('/pricing'),
    availability: 'https://schema.org/InStock',
  })),
});

/** Wrap a list of node objects into a single JSON-LD @graph string. */
export const graph = (...nodes) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) });
