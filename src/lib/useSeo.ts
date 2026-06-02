import { useEffect } from 'react';

const BASE_URL = 'https://juxmusicfree.lovable.app';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

interface SeoOptions {
  title: string;
  description: string;
  path?: string;
}

/**
 * Met à jour le titre, la description et les balises og/canonical pour la route courante.
 * Restaure les valeurs par défaut de index.html au démontage.
 */
export function useSeo({ title, description, path }: SeoOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    const url = path ? `${BASE_URL}${path}` : window.location.href;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setCanonical(url);

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, path]);
}
