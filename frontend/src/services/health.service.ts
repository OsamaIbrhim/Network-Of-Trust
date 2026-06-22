import api from './api';

export const healthService = {
  get: () => fetch('/health').then((r) => {
    if (!r.ok) throw new Error(`Health check failed (${r.status})`);
    return r.json();
  }),
};
