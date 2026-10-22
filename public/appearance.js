// Appearance is the only unencrypted preference. No identity data belongs here.
try {
  const prefs = JSON.parse(localStorage.getItem('shadowfence.appearance') || '{}');
  const modes = ['system', 'light', 'dark', 'amoled'];
  document.documentElement.dataset.theme = modes.includes(prefs.mode) ? prefs.mode : 'system';
  document.documentElement.dataset.accent = ['violet', 'blue', 'teal', 'green', 'rose', 'neutral'].includes(prefs.accent) ? prefs.accent : 'violet';
} catch { /* Use the CSS defaults if the preference is damaged. */ }
