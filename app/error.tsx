'use client';

import { AppErrorState } from '@/components/feedback/app-error-state';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      title="The app shell hit an unexpected error"
      description={error.message || 'Try reloading the page.'}
      actionLabel="Retry"
      onAction={reset}
    />
  );
}

