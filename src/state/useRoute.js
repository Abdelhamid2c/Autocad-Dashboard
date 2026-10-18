import { useCallback, useEffect, useState } from 'react';

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { page: path || 'dashboard', params: Object.fromEntries(new URLSearchParams(query)) };
}

/** Tiny hash router: #/page?key=value. */
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((page, params) => {
    const q = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
    window.location.hash = `/${page}${q}`;
  }, []);
  return { ...route, navigate };
}

export const href = (page, params) => `#/${page}${params ? `?${new URLSearchParams(params)}` : ''}`;
