import { writable } from 'svelte/store';

export const selectedDate = writable<string | null>(null);
export const modalOpen = writable(false);
export const toastMessage = writable<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.set({ text, type });
  setTimeout(() => toastMessage.set(null), 3000);
}

export function openModal(date: string) {
  selectedDate.set(date);
  modalOpen.set(true);
}

export function closeModal() {
  modalOpen.set(false);
  selectedDate.set(null);
}
