import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import ht from '../locales/ht.json';

const timezoneDetector = {
  name: 'timezoneDetector',
  lookup(options: any) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'America/Port-au-Prince') return 'ht';
      if (tz === 'America/Santo_Domingo' || tz === 'America/Havana') return 'es';
      if (tz.includes('America/New_York') || tz.includes('America/Chicago')) return 'en';
    } catch (e) {
      // Ignore
    }
    return undefined;
  }
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(timezoneDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      ht: { translation: ht },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'ht', 'en', 'es'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      escapeValue: false, // React already safeguards from xss
    },
    detection: {
      order: ['localStorage', 'timezoneDetector', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;
