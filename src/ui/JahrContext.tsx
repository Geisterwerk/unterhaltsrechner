import { createContext, useContext } from 'react';
import { JAHRE } from '../config';
import type { JahresKonfiguration } from '../types';

/** Konfiguration des gewählten Berechnungsjahres für alle Eingabekomponenten */
export const JahrContext = createContext<JahresKonfiguration>(JAHRE[0]);

export function useJahr(): JahresKonfiguration {
  return useContext(JahrContext);
}
