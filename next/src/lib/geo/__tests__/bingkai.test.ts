import { describe, expect, it } from "vitest";
import { areaTerkecilDi, batasGeometri, type GeometriArea, luasM2 } from "../geometri";

const kotak = (x0: number, y0: number, x1: number, y1: number): GeometriArea => ({
    type: "Polygon",
    coordinates: [
        [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
            [x0, y0],
        ],
    ],
});

describe("batasGeometri", () => {
    it("memberi [[selatan, barat], [utara, timur]] dari cincin luar", () => {
        expect(batasGeometri(kotak(112.7, -7.21, 112.74, -7.2))).toEqual([
            [-7.21, 112.7],
            [-7.2, 112.74],
        ]);
    });
    it("MultiPolygon digabung", () => {
        const g: GeometriArea = {
            type: "MultiPolygon",
            coordinates: [kotak(1, 1, 2, 2).coordinates as never, kotak(3, 0, 4, 1).coordinates as never],
        };
        expect(batasGeometri(g)).toEqual([
            [0, 1],
            [2, 4],
        ]);
    });
    it("kosong → null", () => {
        expect(batasGeometri({ type: "Polygon", coordinates: [] })).toBeNull();
    });
});

describe("areaTerkecilDi", () => {
    const kawasan = { id: 1, geometry: kotak(112.7, -7.21, 112.74, -7.2) };
    const gedung = { id: 2, geometry: kotak(112.71, -7.205, 112.712, -7.203) };
    const ruang = { id: 3, geometry: kotak(112.7105, -7.2045, 112.7108, -7.2042) };
    const semua = [kawasan, gedung, ruang];
    const luas = (a: { geometry: GeometriArea }) => luasM2(a.geometry);

    it("kawasan tidak menelan klik pada gedung di dalamnya, urutan apa pun", () => {
        expect(areaTerkecilDi({ lat: -7.204, lng: 112.711 }, semua, luas)?.id).toBe(2);
        expect(areaTerkecilDi({ lat: -7.204, lng: 112.711 }, [...semua].reverse(), luas)?.id).toBe(2);
    });
    it("gedung bersarang: yang terkecil", () => {
        expect(areaTerkecilDi({ lat: -7.2043, lng: 112.7106 }, semua, luas)?.id).toBe(3);
    });
    it("di kawasan tetapi di luar gedung → kawasan; di luar semua → null", () => {
        expect(areaTerkecilDi({ lat: -7.208, lng: 112.73 }, semua, luas)?.id).toBe(1);
        expect(areaTerkecilDi({ lat: -7.3, lng: 112.73 }, semua, luas)).toBeNull();
    });
});
