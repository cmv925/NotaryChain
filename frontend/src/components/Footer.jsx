// Legacy Footer component — deprecated.
// PlatformFooter is now rendered globally in App.js for every route,
// so this legacy footer (which used off-brand bg-blue / text-white-on-cream)
// is intentionally a no-op to prevent stacked / off-brand duplicates.
// All pages still importing `Footer` from this path will silently render nothing,
// while the global PlatformFooter handles brand-aligned site navigation.
const Footer = () => null;

export default Footer;
