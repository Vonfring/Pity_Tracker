/**
 * Menjaga script PowerShell tetap benar.
 *
 * Script ini gampang usang: path cache berubah antar versi game, dan endpoint
 * API pernah dipindah. Test di bawah menangkap tiga cara script ini bisa rusak
 * diam-diam.
 */

import { describe, expect, it } from "vitest";

import script from "./get-wish-url.ps1?raw";
import { KNOWN_ENDPOINTS } from "./api";

describe("script PowerShell: path cache", () => {
  it("tidak menghardcode nomor versi di dalam path webCaches", () => {
    // Pola seperti webCaches/2.13.0.1 berarti script akan rusak di update berikutnya.
    expect(script).not.toMatch(/webCaches[\\/]\d+\.\d+/);
  });

  it("memindai subfolder webCaches dan mengambil versi tertinggi", () => {
    expect(script).toContain("Get-ChildItem");
    expect(script).toContain("[version]");
    expect(script).toContain("Sort-Object");
    expect(script).toMatch(/Select-Object -Last 1/);
  });

  it("masih menyediakan jalur untuk layout lama tanpa subfolder berversi", () => {
    expect(script).toMatch(/cacheCandidates \+= \(Join-Path \$cacheRoot/);
  });

  it("mencari lokasi instalasi dari log, bukan mengasumsikan Program Files", () => {
    expect(script).toContain("output_log.txt");
    expect(script).toContain("GenshinImpact_Data|YuanShen_Data");
    expect(script).not.toMatch(/C:\\Program Files/);
  });

  it("mendukung instalasi China selain global", () => {
    // 原神 ditulis sebagai kode karakter supaya tidak rusak oleh masalah encoding.
    expect(script).toContain("[char]0x539f");
    expect(script).toContain("[char]0x795e");
    expect(script).toContain("Genshin Impact");
  });

  it("menyalin file cache dulu karena file aslinya terkunci saat game jalan", () => {
    expect(script).toContain("Copy-Item");
    expect(script).toContain("$env:TEMP");
    expect(script).toContain("Remove-Item");
  });
});

describe("script PowerShell: keamanan", () => {
  it("tidak mengunduh atau menjalankan kode dari internet", () => {
    const code = script.replace(/^\s*#.*$/gm, "");

    for (const forbidden of [
      "Invoke-Expression",
      "iex ",
      "Invoke-RestMethod",
      "irm ",
      "Invoke-WebRequest",
      "iwr ",
      "DownloadString",
      "Start-Process",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("tidak menghapus atau menulis apa pun di folder game", () => {
    const code = script.replace(/^\s*#.*$/gm, "");

    // Satu-satunya Remove-Item yang boleh ada adalah untuk salinan di folder temp.
    const removals = [...code.matchAll(/Remove-Item\s+(\S+)/g)].map((m) => m[1]);
    expect(removals).toEqual(["$tempCopy"]);
    expect(code).not.toContain("Set-Content");
    expect(code).not.toContain("Out-File");
  });

  it("tidak meminta hak administrator", () => {
    expect(script).not.toContain("RunAs");
    expect(script).not.toContain("Administrator");
  });
});

describe("script PowerShell: endpoint", () => {
  it("memakai endpoint yang sama dengan KNOWN_ENDPOINTS di api.ts", () => {
    const global = KNOWN_ENDPOINTS.find((e) => e.region === "os")!.url;
    const china = KNOWN_ENDPOINTS.find((e) => e.region === "cn")!.url;

    expect(script).toContain(`'${global}'`);
    expect(script).toContain(`'${china}'`);
  });

  it("memilih endpoint berdasarkan game_biz, bukan menebak", () => {
    expect(script).toContain("game_biz=hk4e_(global|cn)");
    expect(script).toContain("hk4e_cn");
  });

  it("menyalin hasilnya ke clipboard", () => {
    expect(script).toContain("Set-Clipboard");
  });

  it("seluruh pesan ke pengguna berbahasa Indonesia", () => {
    const messages = [...script.matchAll(/Write-Host\s+'([^']{12,})'/g)].map((m) => m[1]!);

    expect(messages.length).toBeGreaterThan(4);
    for (const message of messages) {
      expect(message).not.toMatch(/\b(Cannot|Please|Failed|Error|Success|found)\b/);
    }
  });
});
