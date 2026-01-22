import { writable } from 'svelte/store';

export const selectedDate = writable<string | null>(null);
export const modalOpen = writable(false);
export const toastMessage = writable<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

// Track toast timeout to prevent memory leak from accumulated timeouts
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
  // Clear any existing timeout to prevent memory leak
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastMessage.set({ text, type });
  toastTimeout = setTimeout(() => {
    toastMessage.set(null);
    toastTimeout = null;
  }, 3000);
}

export function openModal(date: string) {
  selectedDate.set(date);
  modalOpen.set(true);
}

// Track modal close timeout to prevent race conditions
let modalCloseTimeout: ReturnType<typeof setTimeout> | null = null;

export function closeModal() {
  // Clear any pending close timeout
  if (modalCloseTimeout) {
    clearTimeout(modalCloseTimeout);
  }
  modalOpen.set(false);
  // Delay clearing selectedDate to prevent race condition with pending saves
  // This allows form submissions to complete before the date is cleared
  modalCloseTimeout = setTimeout(() => {
    selectedDate.set(null);
    modalCloseTimeout = null;
  }, 300); // Typical modal animation duration
}
