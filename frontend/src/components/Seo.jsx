import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE, SITE_URL } from '../lib/seo';

/**
 * Per-page SEO/AEO head manager.
 *
 * Props:
 *  - title        page title (will be suffixed with the brand unless `bareTitle`)
 *  - description  meta description (<=160 chars ideal)
 *  - path         canonical path, e.g. "/pricing" (defaults to current path)
 *  - image        absolute or root-relative OG image
 *  - type         og:type ("website" | "article" | "profile")
 *  - keywords     optional comma string
 *  - noindex      set true for thin/private pages
 *  - jsonLd       a pre-serialized JSON-LD string (use builders from lib/seo)
 *  - bareTitle    don't append the brand suffix
 */
export const Seo = ({
  title,
  description = SITE.description,
  path,
  image = SITE.ogImage,
  type = 'website',
  keywords,
  noindex = false,
  jsonLd,
  bareTitle = false,
}) => {
  const fullTitle = !title
    ? `${SITE.name} — ${SITE.tagline}`
    : bareTitle
    ? title
    : `${title} | ${SITE.name}`;
  const canonical = `${SITE_URL}${path || (typeof window !== 'undefined' ? window.location.pathname : '/')}`;
  const ogImage = image?.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content={SITE.twitter} />

      {jsonLd && <script type="application/ld+json">{jsonLd}</script>}
    </Helmet>
  );
};

export default Seo;
