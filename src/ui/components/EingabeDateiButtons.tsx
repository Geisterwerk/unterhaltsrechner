import { useRef, useState } from 'react';
import type { Szenario } from '../../compare/vergleich';
import type { CalculationInput } from '../../types';
import type { ZeitraumEinstellung } from '../../zeitraum/zeitraum';
import { dateinameFuer, eingabenAlsJson, eingabenAusJson, type GeladeneEingaben } from '../eingabeDatei';

interface Props {
  input: CalculationInput;
  szenarien: Szenario[];
  zeitraum: ZeitraumEinstellung;
  onLoad: (geladen: GeladeneEingaben) => void;
}

type Meldung = { art: 'ok' | 'fehler'; text: string; details?: string[] };

/** Eingaben (inkl. gemerkter Szenarien) als Datei sichern bzw. aus einer Datei laden */
export function EingabeDateiButtons({ input, szenarien, zeitraum, onLoad }: Props) {
  const dateiRef = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);

  const speichern = () => {
    const blob = new Blob([eingabenAlsJson(input, szenarien, new Date(), zeitraum)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dateinameFuer();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMeldung({
      art: 'ok',
      text: `Eingaben gespeichert${szenarien.length > 0 ? ` (inkl. ${szenarien.length} Szenario${szenarien.length > 1 ? 's' : ''})` : ''}.`,
    });
  };

  const laden = async (datei: File) => {
    try {
      const geladen = eingabenAusJson(await datei.text());
      onLoad(geladen);
      const stand = geladen.gespeichertAm ? ` vom ${new Date(geladen.gespeichertAm).toLocaleDateString('de-DE')}` : '';
      setMeldung({ art: 'ok', text: `„${datei.name}“${stand} geladen.`, details: geladen.hinweise });
    } catch (e) {
      setMeldung({ art: 'fehler', text: e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.' });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={speichern} title="Alle Eingaben als Datei auf diesem Gerät speichern">
          Eingaben speichern
        </button>
        <button type="button" className="btn-secondary" onClick={() => dateiRef.current?.click()} title="Gespeicherte Datei öffnen">
          Eingaben laden
        </button>
        <input
          ref={dateiRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Gespeicherte Eingaben auswählen"
          onChange={(e) => {
            const datei = e.target.files?.[0];
            if (datei) void laden(datei);
            e.target.value = '';
          }}
        />
      </div>
      {meldung && (
        <div
          role="status"
          className={`flex items-start justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs ${
            meldung.art === 'ok' ? 'bg-petrol-50 text-petrol-800' : 'bg-red-50 text-red-700'
          }`}
        >
          <div>
            {meldung.text}
            {meldung.details && meldung.details.length > 0 && (
              <ul className="mt-0.5 list-inside list-disc">
                {meldung.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="shrink-0 font-semibold" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
            ×
          </button>
        </div>
      )}
      <p className="text-[11px] text-slate-500">Die Datei bleibt auf diesem Gerät – es wird nichts hochgeladen.</p>
    </div>
  );
}
