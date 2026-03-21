'use client';

const STORAGE_KEY = 'gospelpad-web-show-delete-warning';

export function getShowDeleteWarningPreference() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setShowDeleteWarningPreference(show: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, show ? 'true' : 'false');
}
