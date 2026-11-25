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
  ja: {
    'app.title': 'AegisAi Harness',
    'chat.send': '送信',
    'chat.placeholder': 'メッセージを入力... (Shift+Enterで改行)',
    'chat.newChat': '新しいチャット',
    'chat.clear': 'チャットをクリア',
    'config.save': '保存',
    'config.close': '閉じる',
    'files.open': 'ファイルブラウザ',
    'search.title': '会話を検索',
    'theme.cycle': 'テーマ切替',
    'compare.title': 'モデル比較',
    'export.title': 'チャットをエクスポート',
    'help.title': 'ヘルプとショートカット',
    'onboarding.welcome': 'AegisAi Harnessへようこそ',
    'onboarding.done': 'セットアップ完了！チャットを始めましょう。',
    'toast.updateAvailable': 'アップデート利用可能: v{version}',
    'toast.exported': '{path} にエクスポートしました',
    'toast.configSaved': '設定を保存しました',
    'toast.scanFound': '{n} 個のモデルが見つかりました',
    'error.unauthorized': '認証が必要です',
  },
  zh: {
    'app.title': 'AegisAi Harness',
    'chat.send': '发送',
    'chat.placeholder': '输入消息... (Shift+Enter换行)',
    'chat.newChat': '新对话',
    'chat.clear': '清空对话',
    'config.save': '保存',
    'config.close': '关闭',
    'files.open': '文件浏览器',
    'search.title': '搜索对话',
    'theme.cycle': '切换主题',
    'compare.title': '模型对比',
    'export.title': '导出对话',
    'help.title': '帮助与快捷键',
    'onboarding.welcome': '欢迎使用 AegisAi Harness',
    'onboarding.done': '设置完成！开始聊天吧。',
    'toast.updateAvailable': '有新版本可用: v{version}',
    'toast.exported': '已导出到 {path}',
    'toast.configSaved': '配置已保存',
    'toast.scanFound': '找到 {n} 个模型',
    'error.unauthorized': '需要认证',
  },
  ko: {
    'app.title': 'AegisAi Harness',
    'chat.send': '전송',
    'chat.placeholder': '메시지 입력... (Shift+Enter로 줄바꿈)',
    'chat.newChat': '새 채팅',
    'chat.clear': '채팅 지우기',
    'config.save': '저장',
    'config.close': '닫기',
    'files.open': '파일 브라우저',
    'search.title': '대화 검색',
    'theme.cycle': '테마 전환',
    'compare.title': '모델 비교',
    'export.title': '채팅 내보내기',
    'help.title': '도움말 및 단축키',
    'onboarding.welcome': 'AegisAi Harness에 오신 것을 환영합니다',
    'onboarding.done': '설정 완료! 채팅을 시작하세요.',
    'toast.updateAvailable': '업데이트 가능: v{version}',
    'toast.exported': '{path}로 내보냈습니다',
    'toast.configSaved': '설정이 저장되었습니다',
    'toast.scanFound': '{n}개의 모델을 찾았습니다',
    'error.unauthorized': '인증이 필요합니다',
  },
  pt: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Enviar',
    'chat.placeholder': 'Digite uma mensagem... (Shift+Enter para nova linha)',
    'chat.newChat': 'Novo chat',
    'chat.clear': 'Limpar chat',
    'config.save': 'Salvar',
    'config.close': 'Fechar',
    'files.open': 'Navegador de arquivos',
    'search.title': 'Buscar conversas',
    'theme.cycle': 'Alternar tema',
    'compare.title': 'Comparar modelos',
    'export.title': 'Exportar chat',
    'help.title': 'Ajuda e atalhos',
    'onboarding.welcome': 'Bem-vindo ao AegisAi Harness',
    'onboarding.done': 'Configuração concluída! Comece a conversar.',
    'toast.updateAvailable': 'Atualização disponível: v{version}',
    'toast.exported': 'Exportado para {path}',
    'toast.configSaved': 'Configuração salva',
    'toast.scanFound': '{n} modelos encontrados',
    'error.unauthorized': 'Autenticação necessária',
  },
  ru: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'Отправить',
    'chat.placeholder': 'Введите сообщение... (Shift+Enter для новой строки)',
    'chat.newChat': 'Новый чат',
    'chat.clear': 'Очистить чат',
    'config.save': 'Сохранить',
    'config.close': 'Закрыть',
    'files.open': 'Файловый менеджер',
    'search.title': 'Поиск бесед',
    'theme.cycle': 'Сменить тему',
    'compare.title': 'Сравнить модели',
    'export.title': 'Экспорт чата',
    'help.title': 'Справка и горячие клавиши',
    'onboarding.welcome': 'Добро пожаловать в AegisAi Harness',
    'onboarding.done': 'Настройка завершена! Начните общение.',
    'toast.updateAvailable': 'Доступно обновление: v{version}',
    'toast.exported': 'Экспортировано в {path}',
    'toast.configSaved': 'Конфигурация сохранена',
    'toast.scanFound': 'Найдено моделей: {n}',
    'error.unauthorized': 'Требуется авторизация',
  },
  ar: {
    'app.title': 'AegisAi Harness',
    'chat.send': 'إرسال',
    'chat.placeholder': 'اكتب رسالة... (Shift+Enter لسطر جديد)',
    'chat.newChat': 'محادثة جديدة',
    'chat.clear': 'مسح المحادثة',
    'config.save': 'حفظ',
    'config.close': 'إغلاق',
    'files.open': 'مستعرض الملفات',
    'search.title': 'البحث في المحادثات',
    'theme.cycle': 'تبديل السمة',
    'compare.title': 'مقارنة النماذج',
    'export.title': 'تصدير المحادثة',
    'help.title': 'المساعدة والاختصارات',
    'onboarding.welcome': 'مرحباً بك في AegisAi Harness',
    'onboarding.done': 'اكتمل الإعداد! ابدأ المحادثة.',
    'toast.updateAvailable': 'تحديث متاح: v{version}',
    'toast.exported': 'تم التصدير إلى {path}',
    'toast.configSaved': 'تم حفظ الإعدادات',
    'toast.scanFound': 'تم العثور على {n} نماذج',
    'error.unauthorized': 'المصادقة مطلوبة',
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
