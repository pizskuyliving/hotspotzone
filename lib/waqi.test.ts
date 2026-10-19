import { describe, expect, it } from "vitest";
import { atribusiAman } from "./waqi";

describe("atribusiAman", () => {
  it("hanya meneruskan tautan http(s) bernama", () => {
    expect(
      atribusiAman([
        { url: "https://kemenlh.go.id/", name: "Kementerian Lingkungan Hidup Dan Kehutanan" },
        { url: "javascript:alert(1)", name: "Jahat" },
        { url: "data:text/html,x", name: "Jahat" },
        { url: "bukan url", name: "Rusak" },
        { url: "https://waqi.info/", name: "" },
        { url: "http://contoh.test", name: " Stasiun lama " },
      ]),
    ).toEqual([
      { nama: "Kementerian Lingkungan Hidup Dan Kehutanan", url: "https://kemenlh.go.id/" },
      { nama: "Stasiun lama", url: "http://contoh.test/" },
    ]);
  });

  it("masukan bukan daftar menghasilkan daftar kosong", () => {
    expect(atribusiAman(undefined)).toEqual([]);
    expect(atribusiAman("x")).toEqual([]);
  });
});
