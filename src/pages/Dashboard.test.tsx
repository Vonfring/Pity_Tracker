/**
 * @vitest-environment jsdom
 *
 * Acceptance criteria 20 (seluruh banner tampil tanpa perlu klik), kriteria 19
 * dari sisi UI (data masih ada setelah halaman dimuat ulang), plus struktur
 * desain Wish Counter: chart bulanan, tabel ringkasan, dan first-run state.
 */

import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { Dashboard } from "./Dashboard";
import { COPY, type Locale } from "../config/copy";
import { LocaleProvider } from "../hooks/useCopy";
import { computeAllPity } from "../lib/pity";
import { mergeImport, openDatabase } from "../lib/storage";
import { filler, fiveStar, fourStar, history, resetIdCursor } from "../test/fixtures";
import type { WishRecord } from "../types/wish";

const UID = "800000001";
const ID = COPY.id;
const EN = COPY.en;

function seedRecords(uid = UID): WishRecord[] {
  resetIdCursor();
  return history(
    filler(46, "301", { uid, time: "2026-07-05 10:00:00" }),
    filler(20, "400", { uid, time: "2026-07-20 10:00:00" }),
    fiveStar("301", "Qiqi", { uid, time: "2026-07-21 10:00:00" }),
    fourStar("301", "Bennett", { uid, time: "2026-08-01 10:00:00" }),
    filler(46, "301", { uid, time: "2026-08-02 10:00:00" }),
    filler(62, "302", { uid, time: "2026-08-03 10:00:00" }),
    filler(5, "200", { uid, time: "2026-08-04 10:00:00" }),
  );
}

function renderDashboard(records: WishRecord[], locale: Locale = "id") {
  render(
    <LocaleProvider initial={locale}>
      <Dashboard
        pity={computeAllPity(records)}
        records={records}
        onGoImport={() => {}}
        onCorrectGuaranteed={() => {}}
      />
    </LocaleProvider>,
  );
}

function cardOf(name: string): HTMLElement {
  return screen.getByRole("heading", { name }).closest("article")!;
}

/** Tabel ringkasan dikenali lewat nama aksesibelnya, bukan lewat heading —
 *  judulnya bisa sama persis dengan nama kartu banner. */
function tableOf(name: string): HTMLElement {
  return screen.getByRole("table", { name }).closest("article")!;
}

/** Angka satu baris statistik. Dicari lewat penanda baris, bukan lewat teks:
 *  pull, pity 5, dan pity 4 bisa kebetulan bernilai sama. */
function statValue(card: HTMLElement, stat: "pulls" | "pity5" | "pity4"): string {
  const row = card.querySelector(`[data-stat="${stat}"]`);
  return row?.querySelector("[data-stat-value]")?.textContent?.trim() ?? "";
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  globalThis.localStorage?.clear?.();
  if (globalThis.location) globalThis.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Kriteria 20
// ---------------------------------------------------------------------------

describe("kriteria 20: dashboard menampilkan seluruh banner sekaligus", () => {
  it("keempat banner beserta pity-nya tampil tanpa satu klik pun", () => {
    renderDashboard(seedRecords());

    for (const id of ["301", "302", "200", "500"] as const) {
      expect(screen.getByRole("heading", { name: ID.banner.names[id] })).toBeInTheDocument();
    }

    // Empat kartu, empat progress bar pity — semuanya sudah terender.
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
  });

  it("tiap kartu punya tiga baris statistik dengan angka yang benar", () => {
    renderDashboard(seedRecords());

    const karakter = cardOf(ID.banner.names["301"]!);
    expect(within(karakter).getByText(ID.banner.lifetimePulls)).toBeInTheDocument();
    expect(statValue(karakter, "pulls")).toBe("114"); // 46 + 20 + Qiqi + 4★ + 46
    expect(statValue(karakter, "pity5")).toBe("47"); // 4★ + 46 setelah Qiqi
    expect(statValue(karakter, "pity4")).toBe("46");
    expect(within(karakter).getByText(ID.banner.guaranteedAt(90))).toBeInTheDocument();

    const senjata = cardOf(ID.banner.names["302"]!);
    expect(statValue(senjata, "pity5")).toBe("62");
    // Hard pity senjata 80, bukan 90.
    expect(within(senjata).getByText(ID.banner.guaranteedAt(80))).toBeInTheDocument();
  });

  it("pill tag membedakan mekanik tiap banner", () => {
    renderDashboard(seedRecords());

    expect(within(cardOf(ID.banner.names["301"]!)).getByText("50/50")).toBeInTheDocument();
    expect(within(cardOf(ID.banner.names["302"]!)).getByText("75/25")).toBeInTheDocument();
    expect(
      within(cardOf(ID.banner.names["200"]!)).getByText(ID.banner.tags["200"]!),
    ).toBeInTheDocument();
  });

  it("tiap kartu punya satu kalimat rekomendasi", () => {
    renderDashboard(seedRecords());

    // Pity 62 di banner senjata: pull berikutnya sudah masuk soft pity.
    expect(
      within(cardOf(ID.banner.names["302"]!)).getByText(ID.advice.luckyZone),
    ).toBeInTheDocument();
    // Chronicled kosong.
    expect(
      within(cardOf(ID.banner.names["500"]!)).getByText(ID.advice.noData),
    ).toBeInTheDocument();
  });

  it("kartu karakter menawarkan koreksi manual status guaranteed", async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn();
    const records = seedRecords();

    render(
      <LocaleProvider initial="id">
        <Dashboard
          pity={computeAllPity(records)}
          records={records}
          onGoImport={() => {}}
          onCorrectGuaranteed={onCorrect}
        />
      </LocaleProvider>,
    );

    const karakter = within(cardOf(ID.banner.names["301"]!));
    await user.click(karakter.getByRole("button", { name: ID.banner.correct }));

    // 5★ terakhir Qiqi -> guaranteed aktif, jadi koreksinya mematikannya.
    expect(onCorrect).toHaveBeenCalledWith("301", false);
  });

  it("detail peluang & biaya ada di balik satu klik, tidak menutupi angka utama", async () => {
    const user = userEvent.setup();
    renderDashboard(seedRecords());

    const senjata = cardOf(ID.banner.names["302"]!);
    await user.click(within(senjata).getByRole("button", { name: ID.banner.seeOdds }));

    expect(within(senjata).getByText(ID.banner.morePulls(10))).toBeInTheDocument();
    // Konversi primogem: 10 pull = 1.600 primo.
    expect(within(senjata).getByText(/1\.600/)).toBeInTheDocument();
    expect(within(senjata).getByText(ID.banner.untilGuaranteed(18))).toBeInTheDocument();
  });

  it("kartu karakter terbuka sejak awal, sesuai desain", () => {
    renderDashboard(seedRecords());

    const karakter = within(cardOf(ID.banner.names["301"]!));
    expect(karakter.getByRole("button", { name: ID.banner.hideDetails })).toBeInTheDocument();
  });

  it("banner kosong tidak menampilkan tombol detail yang mati", () => {
    renderDashboard(seedRecords());

    const chronicled = within(cardOf(ID.banner.names["500"]!));
    expect(chronicled.queryByRole("button", { name: ID.banner.seeOdds })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Chart & tabel ringkasan
// ---------------------------------------------------------------------------

describe("chart pull per bulan", () => {
  it("tampil dengan tab seri dan caption bulan tersibuk", async () => {
    const user = userEvent.setup();
    renderDashboard(seedRecords());

    const chart = cardOf(ID.chart.title);
    expect(within(chart).getByRole("tab", { name: ID.chart.series.character })).toBeInTheDocument();
    expect(within(chart).getByText(/08\/26/)).toBeInTheDocument();

    await user.click(within(chart).getByRole("tab", { name: ID.chart.series.weapon }));
    expect(within(chart).getByRole("tab", { name: ID.chart.series.weapon })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("tabel ringkasan", () => {
  it("banner karakter memecah 5★ dan 4★ beserta rata-rata pity-nya", () => {
    renderDashboard(seedRecords());

    const table = tableOf(ID.tables.characterEvent);
    const row = within(table).getByText(ID.tables.fiveStar).closest("tr")!;

    expect(within(row).getByText("1")).toBeInTheDocument();
    // Qiqi keluar di pull ke-67.
    expect(within(row).getByText("67")).toBeInTheDocument();
    expect(within(table).getByText(new RegExp(ID.tables.won5050))).toBeInTheDocument();
    expect(within(table).getByText(new RegExp(ID.tables.fourStarCharacter))).toBeInTheDocument();
  });

  it("chip menampilkan 5★ terakhir beserta pity dan hasil undiannya", () => {
    renderDashboard(seedRecords());

    const table = tableOf(ID.tables.characterEvent);
    const chip = within(table).getByText("Qiqi").closest("span")!;

    expect(within(chip).getByText("67")).toBeInTheDocument();
  });

  it("tabel senjata & standar muncul terpisah", () => {
    renderDashboard(seedRecords());

    const table = tableOf(ID.tables.weaponStandard);
    expect(within(table).getByText(ID.tables.fiveStarWeapon)).toBeInTheDocument();
    expect(within(table).getByText(ID.tables.fourStarStandard)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// First run
// ---------------------------------------------------------------------------

describe("first run: belum ada data", () => {
  it("panel onboarding tampil dan mengarah ke import", async () => {
    const user = userEvent.setup();
    const onGoImport = vi.fn();

    render(
      <LocaleProvider initial="id">
        <Dashboard
          pity={computeAllPity([])}
          records={[]}
          onGoImport={onGoImport}
          onCorrectGuaranteed={() => {}}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: ID.firstRun.heading })).toBeInTheDocument();
    expect(screen.getByText(ID.firstRun.pill)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ID.firstRun.primary }));
    expect(onGoImport).toHaveBeenCalled();
  });

  it("keempat banner tetap tampil dengan angka nol, tanpa tombol detail", () => {
    renderDashboard([]);

    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: ID.banner.seeOdds })).not.toBeInTheDocument();
    expect(screen.getAllByText(ID.advice.noData)).toHaveLength(4);
  });

  it("chart dan tabel ringkasan disembunyikan", () => {
    renderDashboard([]);

    expect(screen.queryByRole("heading", { name: ID.chart.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: ID.tables.characterEvent })).not.toBeInTheDocument();
  });

  it("panel onboarding hilang begitu ada data", () => {
    renderDashboard(seedRecords());

    expect(screen.queryByRole("heading", { name: ID.firstRun.heading })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Bahasa
// ---------------------------------------------------------------------------

describe("dua bahasa", () => {
  it("bahasa Inggris mengganti seluruh teks, angkanya tetap sama", () => {
    renderDashboard(seedRecords(), "en");

    const karakter = within(cardOf("Character Event"));

    expect(karakter.getByText("Lifetime Pulls")).toBeInTheDocument();
    expect(within(cardOf("Weapon Event")).getByText("Guaranteed at 80")).toBeInTheDocument();
    // Pemisah ribuan ikut berubah: 114 pull x 160 primo.
    expect(karakter.getByText("18,240")).toBeInTheDocument();
  });

  it("bahasa Inggris adalah default, tanpa perlu memilih apa pun", () => {
    // Sengaja tanpa LocaleProvider: yang diuji adalah DEFAULT_LOCALE itu sendiri.
    const records = seedRecords();
    render(
      <Dashboard
        pity={computeAllPity(records)}
        records={records}
        onGoImport={() => {}}
        onCorrectGuaranteed={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Character Event" })).toBeInTheDocument();
    expect(within(cardOf("Character Event")).getByText("18,240")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Kriteria 19 dari sisi UI
// ---------------------------------------------------------------------------

describe("kriteria 19: reload halaman, data masih ada", () => {
  it("App memuat data tersimpan tanpa import ulang", async () => {
    const db = await openDatabase(globalThis.indexedDB);
    await mergeImport(db, UID, seedRecords(), { at: "2026-08-22T10:00:00.000Z" });
    db.close();

    render(<App />); // kunjungan pertama

    // Menunggu datanya, bukan sekadar heading: kartu banner ikut terender
    // dengan angka nol sebelum IndexedDB selesai dibaca.
    await waitFor(() => expect(statValue(cardOf(EN.banner.names["301"]!), "pity5")).toBe("47"));
    expect(screen.getByRole("combobox", { name: EN.nav.selectAccount })).toHaveValue(UID);

    cleanup();
    render(<App />); // halaman dimuat ulang

    await waitFor(() => expect(statValue(cardOf(EN.banner.names["301"]!), "pity5")).toBe("47"));
    expect(screen.getByRole("combobox", { name: EN.nav.selectAccount })).toHaveValue(UID);
  });

  it("switcher UID memuat dua akun yang tersimpan terpisah", async () => {
    const db = await openDatabase(globalThis.indexedDB);
    await mergeImport(db, "800000001", seedRecords("800000001"), { at: "2026-08-22T10:00:00.000Z" });
    resetIdCursor();
    await mergeImport(db, "600000002", filler(9, "301", { uid: "600000002" }), {
      at: "2026-08-22T10:00:00.000Z",
    });
    db.close();

    const user = userEvent.setup();
    render(<App />);

    const switcher = await screen.findByRole("combobox", { name: EN.nav.selectAccount });
    expect(within(switcher).getAllByRole("option")).toHaveLength(2);

    await user.selectOptions(switcher, "600000002");

    await waitFor(() => expect(statValue(cardOf(EN.banner.names["301"]!), "pulls")).toBe("9"));
  });

  it("tanpa data tersimpan, App menampilkan first-run state", async () => {
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: EN.firstRun.heading })).toBeInTheDocument(),
    );
    expect(screen.getByText(EN.nav.noAccount)).toBeInTheDocument();
    expect(screen.getByText(EN.header.nothingImported)).toBeInTheDocument();
  });

  it("pengalih bahasa di sidebar mengganti bahasa seluruh halaman", async () => {
    const user = userEvent.setup();
    render(<App />);

    const picker = await screen.findByRole("combobox", { name: EN.nav.language });
    expect(document.documentElement.lang).toBe("en");

    await user.selectOptions(picker, "id");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: ID.firstRun.heading })).toBeInTheDocument(),
    );
    // Pembaca layar ikut diberi tahu bahasanya berganti.
    expect(document.documentElement.lang).toBe("id");
  });
});
