/**
 * @vitest-environment jsdom
 *
 * Halaman import adalah rintangan terbesar bagi pengguna, jadi diuji sebagai
 * fitur utama: panduan bernomor, tombol salin, progress, dan pesan error ramah.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportPage } from "./ImportPage";
import { COPY, type Locale } from "../config/copy";
import { LocaleProvider } from "../hooks/useCopy";
import type { ImportState } from "../hooks/useWishData";

const ID = COPY.id;

const IDLE: ImportState = {
  phase: "idle",
  progress: null,
  added: null,
  errorMessage: null,
  warnings: [],
};

function renderPage(
  overrides: Partial<React.ComponentProps<typeof ImportPage>> = {},
  locale: Locale = "id",
) {
  const props = {
    importState: IDLE,
    onImportUrl: vi.fn(async () => true),
    onImportFile: vi.fn(async () => true),
    onCancel: vi.fn(),
    onDone: vi.fn(),
    onReset: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  render(
    <LocaleProvider initial={locale}>
      <ImportPage {...props} />
    </LocaleProvider>,
  );
  return props;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("panduan Windows", () => {
  it("langkahnya bernomor dan berurutan", () => {
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

    for (const [index, step] of ID.import.steps.entries()) {
      expect(headings[index]).toBe(step.title);
    }
  });

  it("menjelaskan apa yang dilakukan perintahnya, termasuk yang TIDAK dilakukan", () => {
    renderPage();

    // Diruangkupkan ke bloknya sendiri: isi script juga terender di halaman ini,
    // dan komentarnya memuat kalimat yang mirip.
    const heading = screen.getByRole("heading", { name: ID.import.whatItDoesTitle });
    const block = within(heading.closest("div")!);

    expect(block.getByText(ID.import.whatItDoesNot)).toBeInTheDocument();
    expect(block.getByText(ID.import.whatItDoes[0]!)).toBeInTheDocument();
  });

  it("tombol salin menyalin isi script apa adanya", async () => {
    const user = userEvent.setup(); // memasang stub clipboard-nya sendiri
    renderPage();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(screen.getByRole("button", { name: ID.import.copy }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0]![0] as unknown as string;
    expect(copied).toContain("webCaches");
    expect(copied).toContain("Set-Clipboard");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: ID.import.copied })).toBeInTheDocument(),
    );
  });

  it("punya bagian troubleshooting untuk error umum", async () => {
    const user = userEvent.setup();
    renderPage();

    const heading = screen.getByRole("heading", { name: ID.import.troubleTitle });
    const block = within(heading.parentElement!);
    const expiry = ID.import.troubles[3]!;

    expect(block.getByText(ID.import.troubles[0]!.q)).toBeInTheDocument();
    expect(block.getByText(expiry.q)).toBeInTheDocument();

    await user.click(block.getByText(expiry.q));
    expect(block.getByText(expiry.a)).toBeInTheDocument();
  });

  it("menjelaskan authkey secara jujur dan singkat", () => {
    renderPage();

    for (const paragraph of ID.privacy.paragraphs) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it("tab macOS/HP mengarahkan ke import file UIGF", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: ID.import.tabFile }));

    expect(screen.getByRole("heading", { name: ID.import.notWindowsTitle })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: ID.import.chooseFile })).not.toHaveLength(0);
  });
});

describe("form URL", () => {
  it("tombol tarik data mati selama kolomnya kosong", async () => {
    const user = userEvent.setup();
    renderPage();

    const submit = screen.getByRole("button", { name: ID.import.pull });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(ID.import.pasteLabel), "https://contoh");
    expect(submit).toBeEnabled();
  });

  it("mengirim URL apa adanya ke handler import", async () => {
    const user = userEvent.setup();
    const props = renderPage();
    const url = "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog?authkey=abc";

    await user.type(screen.getByLabelText(ID.import.pasteLabel), url);
    await user.click(screen.getByRole("button", { name: ID.import.pull }));

    expect(props.onImportUrl).toHaveBeenCalledWith(url);
  });
});

describe("status import", () => {
  it("progress bar bergerak dan menyebut banner yang sedang ditarik", () => {
    renderPage({
      importState: {
        ...IDLE,
        phase: "running",
        progress: {
          bannerIndex: 2,
          bannerTotal: 6,
          bannerName: "Banner Karakter",
          rawGachaType: "301",
          page: 3,
          fetched: 240,
          throttled: false,
        },
      },
    });

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText(ID.import.progress("Banner Karakter", "240"))).toBeInTheDocument();
  });

  it("kondisi rate limit dijelaskan sebagai jeda, bukan kegagalan", () => {
    renderPage({
      importState: {
        ...IDLE,
        phase: "running",
        progress: {
          bannerIndex: 1,
          bannerTotal: 6,
          bannerName: "Banner Karakter",
          rawGachaType: "301",
          page: 1,
          fetched: 20,
          throttled: true,
        },
      },
    });

    expect(screen.getByText(ID.import.throttled)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pesan error tampil sebagai alert, tanpa kode teknis", () => {
    renderPage({
      importState: {
        ...IDLE,
        phase: "error",
        errorMessage:
          "Link-nya sudah kedaluwarsa. Link wish history cuma berlaku sekitar 24 jam.",
      },
    });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/24 jam/)).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/retcode|-101|undefined/);
  });

  it("hasil sukses menyebut jumlah pull baru dan menawarkan ke dashboard", async () => {
    const user = userEvent.setup();
    const props = renderPage({
      importState: { ...IDLE, phase: "done", added: 1240 },
    });

    expect(screen.getByText(ID.import.doneWithNew("1.240"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ID.import.seeCounter }));
    expect(props.onDone).toHaveBeenCalled();
  });

  it("import tanpa pull baru tidak terasa seperti kegagalan", () => {
    renderPage({ importState: { ...IDLE, phase: "done", added: 0 } });

    expect(screen.getByText(ID.import.doneNothingNew)).toBeInTheDocument();
  });

  it("peringatan dari file UIGF ikut ditampilkan", () => {
    renderPage({
      importState: {
        ...IDLE,
        phase: "done",
        added: 50,
        warnings: ["12 pull tidak menyertakan info bintang, jadi perhitungan pity-nya bisa sedikit meleset."],
      },
    });

    expect(screen.getByText(/tidak menyertakan info bintang/)).toBeInTheDocument();
  });

  it("tombol batal muncul hanya saat import berjalan", async () => {
    const user = userEvent.setup();
    const props = renderPage({
      importState: { ...IDLE, phase: "running", progress: null },
    });

    await user.click(screen.getByRole("button", { name: ID.import.cancel }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
