import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { medianMs, rowSessionSamples } from "@/lib/usage";
import { tokensMatch } from "@/lib/token-equal";
import { pruneBackups } from "@/lib/backup";

describe("token-equal", () => {
  it("matches equal strings", () => {
    expect(tokensMatch("secret", "secret")).toBe(true);
    expect(tokensMatch("secret", "Secret")).toBe(false);
    expect(tokensMatch(null, "secret")).toBe(false);
  });
});

describe("usage aggregation", () => {
  it("medianMs of odd/even lists", () => {
    expect(medianMs([10, 30, 20])).toBe(20);
    expect(medianMs([10, 40, 20, 30])).toBe(25);
    expect(medianMs([])).toBeNull();
    expect(medianMs([0, -1])).toBeNull();
  });

  it("rowSessionSamples averages total by opens", () => {
    expect(
      rowSessionSamples([
        { opens: 2, totalSessionMs: 100_000 },
        { opens: 0, totalSessionMs: 5_000 },
        { opens: 1, totalSessionMs: 0 },
      ]),
    ).toEqual([50_000, 5_000]);
    expect(
      medianMs(rowSessionSamples([{ opens: 4, totalSessionMs: 200_000 }])),
    ).toBe(50_000);
  });
});

describe("backup prune", () => {
  it("keeps newest 14 and deletes older", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-bak-"));
    try {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        const f = path.join(
          dir,
          `pulsewire-fake-${String(i).padStart(2, "0")}.db`,
        );
        fs.writeFileSync(f, "x");
        fs.utimesSync(f, new Date(now - i * 1000), new Date(now - i * 1000));
      }
      const newest = path.join(dir, "pulsewire-fresh.db");
      fs.writeFileSync(newest, "y");
      fs.utimesSync(newest, new Date(now + 1000), new Date(now + 1000));

      const result = pruneBackups(dir, 14);
      const left = fs.readdirSync(dir).filter((f) => f.endsWith(".db"));
      expect(left).toHaveLength(14);
      expect(left).toContain("pulsewire-fresh.db");
      expect(result.deleted).toBe(7); // 21 - 14
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
