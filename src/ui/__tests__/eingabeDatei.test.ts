import { describe, expect, it } from 'vitest';
import { defaultInput } from '../defaults';
import { DATEI_FORMAT, eingabenAlsJson, eingabenAusJson } from '../eingabeDatei';
import { zeitraumStandard } from '../../zeitraum/zeitraum';

describe('Eingaben als Datei', () => {
  it('speichert und lädt verlustfrei (inkl. Szenarien)', () => {
    const input = defaultInput();
    input.parents.A.netIncome = 4321;
    input.parents.A.deductions.wohnvorteil = 250;
    input.children[0].care = 'wechsel';
    input.children[0].wechselWohnkosten = { A: 300, B: 150 };
    input.children[0].age = { kind: 'birthdate', birthdate: '2018-05-01' };
    const szenario = { id: 'x', name: 'Variante', input: defaultInput() };
    const g = eingabenAusJson(eingabenAlsJson(input, [szenario]));
    expect(g.input).toEqual(input);
    expect(g.szenarien).toHaveLength(1);
    expect(g.szenarien[0].name).toBe('Variante');
    expect(g.hinweise).toEqual([]);
  });

  it('ergänzt fehlende Felder älterer Dateien mit Standardwerten', () => {
    const datei = JSON.parse(eingabenAlsJson(defaultInput(), []));
    delete datei.input.parents.A.deductions.wohnvorteil;
    delete datei.input.children[0].wechselWohnkosten;
    delete datei.input.options;
    const g = eingabenAusJson(JSON.stringify(datei));
    expect(g.input.parents.A.deductions.wohnvorteil).toBe(0);
    expect(g.input.children[0].wechselWohnkosten).toEqual({ A: 0, B: 0 });
    expect(g.input.options.haushaltskinderEinbeziehen).toBe(true);
  });

  it('ersetzt ungültige Werte', () => {
    const datei = JSON.parse(eingabenAlsJson(defaultInput(), []));
    datei.input.children[0].care = 'X';
    datei.input.children[0].age = { kind: 'stage', stage: 9 };
    datei.input.parents.B.netIncome = 'viel';
    datei.input.jahr = 1999;
    const g = eingabenAusJson(JSON.stringify(datei));
    expect(g.input.children[0].care).toBe('B');
    expect(g.input.children[0].age).toEqual({ kind: 'stage', stage: 0 });
    expect(g.input.parents.B.netIncome).toBe(0);
    expect(g.hinweise[0]).toContain('1999');
  });

  it('lehnt fremde, defekte und neuere Dateien mit verständlicher Meldung ab', () => {
    expect(() => eingabenAusJson('kein json')).toThrow('keine gültige JSON-Datei');
    expect(() => eingabenAusJson('{"foo":1}')).toThrow('nicht aus dem Unterhaltsrechner');
    expect(() => eingabenAusJson(JSON.stringify({ format: DATEI_FORMAT, formatVersion: 99 }))).toThrow('neueren Version');
  });

  it('speichert den Zeitraum mit und lädt ihn wieder; ältere Dateien ohne Zeitraum ergeben null', () => {
    const zeitraum = {
      ...zeitraumStandard(new Date('2026-11-26')),
      aktiv: true,
      mitGezahlt: true,
      betragMonatlich: 300,
      aenderungen: [{ id: 'a1', ab: '2026-05', elternteil: 'B' as const, betrag: 2100 }],
    };
    const g = eingabenAusJson(eingabenAlsJson(defaultInput(), [], new Date(), zeitraum));
    expect(g.zeitraum).toEqual(zeitraum);
    expect(eingabenAusJson(eingabenAlsJson(defaultInput(), [])).zeitraum).toBeNull();

    const kaputt = JSON.parse(eingabenAlsJson(defaultInput(), [], new Date(), zeitraum));
    kaputt.zeitraum.von = 'gestern';
    kaputt.zeitraum.aenderungen.push({ ab: 'irgendwann', elternteil: 'X', betrag: 1 });
    const k = eingabenAusJson(JSON.stringify(kaputt));
    expect(k.zeitraum!.von).toMatch(/^\d{4}-\d{2}$/);
    expect(k.zeitraum!.aenderungen).toHaveLength(1);
  });
});
