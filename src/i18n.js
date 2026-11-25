// src/i18n.js
// Tiny i18n: locale dictionaries + t(key, params) with interpolation.
const DICTS = {};
const FALLBACK = 'en';

const BUILTIN = {
  en: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Send',
    'chat.placeholder': 'Type a message... (Shift+Enter for new line)',
    'chat.newChat': 'New Chat',
    'chat.clear': 'Clear Chat',
    'config.save': 'Save',
    'config.close': 'Close',
    'files.open': 'File Browser',
    'search.title': 'Search Conversations',
    'theme.cycle': 'Cycle theme',
    'compare.title': 'Compare Models',
    'export.title': 'Export Chat',
    'help.title': 'Help & Shortcuts',
    'onboarding.welcome': 'Welcome to AegisAi Harness',
    'onboarding.done': 'Setup complete! You\'re ready to start chatting.',
    'toast.updateAvailable': 'Update available: v{version}',
    'toast.exported': 'Exported to {path}',
    'toast.configSaved': 'Configuration saved',
    'toast.scanFound': 'Found {n} models',
    'error.unauthorized': 'Authentication Required',
  },
  es: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Enviar',
    'chat.placeholder': 'Escribe un mensaje... (Shift+Enter para nueva línea)',
    'chat.newChat': 'Nuevo chat',
    'chat.clear': 'Limpiar chat',
    'config.save': 'Guardar',
    'config.close': 'Cerrar',
    'files.open': 'Explorador de archivos',
    'search.title': 'Buscar conversaciones',
    'theme.cycle': 'Cambiar tema',
    'compare.title': 'Comparar modelos',
    'export.title': 'Exportar chat',
    'help.title': 'Ayuda y atajos',
    'onboarding.welcome': 'Bienvenido a AegisAi Harness',
    'onboarding.done': '¡Configuración completa! Ya puedes chatear.',
    'toast.updateAvailable': 'Actualización disponible: v{version}',
    'toast.exported': 'Exportado a {path}',
    'toast.configSaved': 'Configuración guardada',
    'toast.scanFound': 'Se encontraron {n} modelos',
    'error.unauthorized': 'Autenticación requerida',
  },
  fr: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Envoyer',
    'chat.placeholder': 'Tapez un message... (Shift+Enter pour une nouvelle ligne)',
    'chat.newChat': 'Nouveau chat',
    'chat.clear': 'Effacer le chat',
    'config.save': 'Enregistrer',
    'config.close': 'Fermer',
    'files.open': 'Explorateur de fichiers',
    'search.title': 'Rechercher des conversations',
    'theme.cycle': 'Changer de thème',
    'compare.title': 'Comparer les modèles',
    'export.title': 'Exporter le chat',
    'help.title': 'Aide et raccourcis',
    'onboarding.welcome': 'Bienvenue dans AegisAi Harness',
    'onboarding.done': 'Configuration terminée ! Vous pouvez commencer à discuter.',
    'toast.updateAvailable': 'Mise à jour disponible : v{version}',
    'toast.exported': 'Exporté vers {path}',
    'toast.configSaved': 'Configuration enregistrée',
    'toast.scanFound': '{n} modèles trouvés',
    'error.unauthorized': 'Authentification requise',
  },
  de: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Senden',
    'chat.placeholder': 'Nachricht eingeben... (Shift+Enter für neue Zeile)',
    'chat.newChat': 'Neuer Chat',
    'chat.clear': 'Chat leeren',
    'config.save': 'Speichern',
    'config.close': 'Schließen',
    'files.open': 'Dateibrowser',
    'search.title': 'Konversationen durchsuchen',
    'theme.cycle': 'Thema wechseln',
    'compare.title': 'Modelle vergleichen',
    'export.title': 'Chat exportieren',
    'help.title': 'Hilfe und Tastenkürzel',
    'onboarding.welcome': 'Willkommen bei AegisAi Harness',
    'onboarding.done': 'Einrichtung abgeschlossen! Sie können jetzt chatten.',
    'toast.updateAvailable': 'Update verfügbar: v{version}',
    'toast.exported': 'Exportiert nach {path}',
    'toast.configSaved': 'Konfiguration gespeichert',
    'toast.scanFound': '{n} Modelle gefunden',
    'error.unauthorized': 'Authentifizierung erforderlich',
  },
};

let currentLocale = (typeof process !== 'undefined' && process.env && process.env.AEGISAI_LOCALE) || 'en';

function register(locale, dict) {
  DICTS[locale] = Object.assign({}, DICTS[locale] || {}, dict || {});
}

function setLocale(locale) {
  if (locale) currentLocale = locale;
  return currentLocale;
}

function getLocale() { return currentLocale; }

function t(key, params) {
  const dict = DICTS[currentLocale] || BUILTIN[currentLocale] || BUILTIN[FALLBACK] || {};
  let s = dict[key];
  if (s == null) {
    const fb = BUILTIN[FALLBACK] || {};
    s = fb[key];
  }
  if (s == null) s = key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : '{' + k + '}'));
  }
  return s;
}

function available() { return Object.keys(BUILTIN).concat(Object.keys(DICTS)).filter((v, i, a) => a.indexOf(v) === i); }

// Auto-register builtins.
for (const [loc, dict] of Object.entries(BUILTIN)) register(loc, dict);

function loadFromFile(filePath) {
  try {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data && data.locale && data.strings) register(data.locale, data.strings);
    return true;
  } catch (e) { return false; }
}

module.exports = { register, setLocale, getLocale, t, available, loadFromFile, BUILTIN };
