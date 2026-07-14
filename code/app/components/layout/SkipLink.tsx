export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:border focus:border-blue-600 focus:bg-white focus:px-4 focus:py-2 focus:text-blue-600 focus:ring-2 focus:ring-blue-600 focus:outline-none"
    >
      Salta al contenuto principale
    </a>
  );
}
