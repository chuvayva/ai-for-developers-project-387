import { useEffect, useState } from 'react';

export type Loading = 'loading' | 'loaded' | 'failed';

/**
 * Loads a value once, when the component mounts. `value` is `initial` until
 * the load succeeds.
 */
export function useLoadOnMount<T>(load: () => Promise<T>, initial: T) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState<Loading>('loading');

  useEffect(() => {
    let current = true;

    load().then(
      (loaded) => {
        if (current) {
          setValue(loaded);
          setLoading('loaded');
        }
      },
      () => {
        if (current) {
          setLoading('failed');
        }
      },
    );

    return () => {
      current = false;
    };
  }, [load]);

  /** Changes the value from the page. The value then counts as loaded. */
  function update(change: (current: T) => T) {
    setValue(change);
    setLoading('loaded');
  }

  return { value, loading, update };
}
