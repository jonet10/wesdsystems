import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import ht from '../locales/ht.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      ht: { translation: ht },
    },
    lng: 'fr', // Force French as the native app language
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'ht', 'en', 'es'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      escapeValue: false, // React already safeguards from xss
    }
  });

export default i18n;
