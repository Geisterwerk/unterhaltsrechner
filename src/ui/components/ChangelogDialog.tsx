import { useRef } from 'react';
import { APP_VERSION, CHANGELOG, CHANGELOG_ART_LABEL, type ChangelogArt } from '../../config/changelog';

const ART_STIL: Record<ChangelogArt, string> = {
  neu: 'bg-emerald-100 text-emerald-800',
  geaendert: 'bg-amber-100 text-amber-800',
  korrigiert: 'bg-sky-100 text-sky-800',
};

const datumDe = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE');

/** Link „Version x · Was ist neu?“ mit Dialog für das Änderungsprotokoll */
export function ChangelogButton() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-full border border-petrol-200 bg-petrol-50 px-2.5 py-0.5 text-xs font-medium text-petrol-700 hover:bg-petrol-100"
      >
        Version {APP_VERSION} · Was ist neu?
      </button>
      <dialog
        ref={ref}
        aria-labelledby="changelog-titel"
        className="w-[min(40rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
        onClick={(e) => {
          // Klick auf den abgedunkelten Hintergrund schließt den Dialog
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="changelog-titel" className="text-lg font-semibold text-slate-900">
            Änderungsprotokoll
          </h2>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => ref.current?.close()}>
            Schließen
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          {CHANGELOG.map((e) => (
            <section key={e.version}>
              <h3 className="text-sm font-semibold text-slate-900">
                Version {e.version} <span className="font-normal text-slate-500">· {datumDe(e.datum)}</span>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {e.aenderungen.map((a) => (
                  <li key={a.text} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ART_STIL[a.art]}`}>
                      {CHANGELOG_ART_LABEL[a.art]}
                    </span>
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
