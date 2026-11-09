import type { Language } from '../settings/settings.ts';
import { en } from './en.ts';
import { es, type MessageKey } from './es.ts';

export type { MessageKey };
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { es, en };

/** Reemplaza {nombre} por su valor. Un parámetro que falta queda visible, para notarlo al probar. */
export function format(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function createTranslator(language: Language): Translate {
  const dictionary = DICTIONARIES[language];
  return (key, params) => format(dictionary[key] ?? es[key], params);
}
