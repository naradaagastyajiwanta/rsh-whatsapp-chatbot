import { id } from './id';
import { en } from './en';

export const translations = {
  id,
  en
};

export type Language = 'id' | 'en';
export type TranslationKeys = typeof id;
