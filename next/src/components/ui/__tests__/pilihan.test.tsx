import { describe, expect, it } from "vitest";
import { bacaOpsi } from "../pilihan";

describe("bacaOpsi: anak <option> menjadi pilihan (pengganti <select>)", () => {
  it("membaca nilai, label, nonaktif, larik, fragmen, dan optgroup", () => {
    const opsi = bacaOpsi(
      <>
        <option value="">Semua area</option>
        <option value="belum">Belum berarea ({3})</option>
        <optgroup label="Area">
          {[1, 2].map((i) => (
            <option key={i} value={i} disabled={i === 2}>
              Gedung {i}
            </option>
          ))}
        </optgroup>
        <option>Tanpa nilai</option>
      </>,
    );
    expect(opsi).toEqual([
      { value: "", label: "Semua area", disabled: undefined, grup: undefined },
      { value: "belum", label: "Belum berarea (3)", disabled: undefined, grup: undefined },
      { value: "1", label: "Gedung 1", disabled: false, grup: "Area" },
      { value: "2", label: "Gedung 2", disabled: true, grup: "Area" },
      { value: "Tanpa nilai", label: "Tanpa nilai", disabled: undefined, grup: undefined },
    ]);
  });
});
