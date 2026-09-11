import { useCallback, useEffect, useState } from 'react';
import type { ScoreboardResponse } from '../../../shared/types.js';

interface State {
  data: ScoreboardResponse | null;
  loading: boolean;
  error: string | null;
}

export function useScoreboard() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  const load = useCallback(async (forceRefresh = false) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/scoreboard${forceRefresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = (await res.json()) as ScoreboardResponse;
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return { ...state, refresh: () => load(true) };
}
