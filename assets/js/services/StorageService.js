/** Local persistence for notebook pages and drawings. */
const STORAGE_KEY = 'message-on-paper:notebook:v2';

export const StorageService = {
  load() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  save(notebook) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook.serialize()));
      return true;
    } catch {
      return false;
    }
  },
};
