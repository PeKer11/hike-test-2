import { describe, expect, it } from "vitest";

import { classifyArea, classifyPoint, SAFETY_ZONE_IDS } from "@/lib/places/safety-zones";

const p = (lat: number, lng: number) => ({ lat, lng });

// Real places (not points the polygon builder chose).
describe("safety zones: allowed (real places, nationwide)", () => {
  it.each([
    ["central Tel Aviv", 32.08, 34.78],
    ["Haifa, Carmel west", 32.79, 34.98],
    ["Herzliya", 32.17, 34.84],
    ["Netanya", 32.33, 34.86],
    ["Beer Sheva centre", 31.25, 34.79],
    ["Mitzpe Ramon", 30.61, 34.8],
    ["Nazareth", 32.7, 35.3],
    ["West Jerusalem, Rehavia", 31.775, 35.21],
  ])("%s is allowed", (_n, lat, lng) => {
    expect(classifyPoint(p(lat, lng)).status).toBe("allowed");
  });

  it("a patch fully inside the Rehavia core is allowed", () => {
    expect(
      classifyArea(p(31.775, 35.2), { south: 31.77, north: 31.78, west: 35.19, east: 35.21 }).status,
    ).toBe("allowed");
  });
});

describe("safety zones: foreign land is denied", () => {
  it.each([
    ["Tyre, Lebanon", 33.27, 35.2],
    ["Nabatieh, Lebanon", 33.38, 35.48],
    ["Marjayoun, Lebanon", 33.36, 35.59],
    ["Khiam, Lebanon", 33.32, 35.61],
    ["Syrian side of the Golan", 32.85, 35.88],
    ["Umm Qais, Jordan (Yarmouk)", 32.655, 35.68],
    ["Mujib, Jordan Dead Sea shore", 31.47, 35.57],
    ["Ghor as-Safi, Jordan", 31.04, 35.47],
    ["Aqaba, Jordan", 29.5, 35.03],
    ["El Qusaima, Sinai", 30.66, 34.37],
    ["Amman", 31.95, 35.93],
    ["Cairo", 30.04, 31.24],
    ["Paris", 48.85, 2.35],
    ["Mediterranean far offshore", 33.0, 33.0],
    ["NaN", Number.NaN, 34.8],
  ])("%s is denied", (_n, lat, lng) => {
    expect(classifyPoint(p(lat, lng)).status).toBe("denied");
  });
});

describe("safety zones: border regions inside Israel are denied", () => {
  it.each([
    ["Ramat Magshimim (Golan)", 32.85, 35.8],
    ["Yarmouk border", 32.7, 35.7],
    ["Kiryat Shmona (Lebanon strip)", 33.21, 35.57],
    ["Hatzeva (Arava)", 30.77, 35.25],
    ["Neot HaKikar (Arava)", 30.93, 35.37],
    ["Ein Bokek (Dead Sea south)", 31.2, 35.36],
    ["Arad", 31.26, 35.21],
    ["Nitzana (Egypt border)", 30.87, 34.43],
    ["Gaza City", 31.5, 34.46],
    ["Sderot (Gaza envelope)", 31.52, 34.6],
    ["Hermon", 33.3, 35.78],
  ])("%s is denied", (_n, lat, lng) => {
    expect(classifyPoint(p(lat, lng)).status).toBe("denied");
  });
});

describe("safety zones: cycle 3 regressions (Opus re-review)", () => {
  it.each([
    ["Jordan land near Aqaba 1", 29.62, 35.04],
    ["Jordan land near Aqaba 2", 29.65, 35.05],
    ["Jordan land near Aqaba 3", 29.7, 35.06],
    ["Jordan land near Aqaba 4", 29.75, 35.08],
    ["Jordan land near Aqaba 5", 29.8, 35.09],
    ["Eilat (accepted false positive)", 29.56, 34.95],
    ["Malkia on the active Lebanon border", 33.098, 35.509],
    ["Malkia north", 33.12, 35.53],
    ["Malkia north 2", 33.14, 35.535],
    ["Metula", 33.28, 35.58],
    ["Kiryat Shmona", 33.21, 35.57],
    ["Shlomi", 33.075, 35.14],
    ["Rosh HaNikra", 33.09, 35.11],
    ["Sderot-side envelope point", 31.53, 34.625],
    ["Sderot", 31.52, 34.6],
  ])("%s is denied", (_n, lat, lng) => {
    expect(classifyPoint(p(lat, lng)).status).toBe("denied");
  });

  it("Gaza envelope still reaches the stated 7 km from the fence (Netivot side, 6.5 km east of Nahal Oz)", () => {
    expect(classifyPoint(p(31.47, 34.56)).status).toBe("denied");
  });

  it("interior points near the cuts stay allowed (the cuts are not an all-deny)", () => {
    for (const [lat, lng] of [[32.94, 35.1], [32.95, 35.3], [31.775, 35.2], [30.4, 34.9], [31.0, 34.85]]) {
      expect(classifyPoint(p(lat, lng)).status, `${lat},${lng}`).toBe("allowed");
    }
  });
});

describe("safety zones: West Bank, Green Line and Jerusalem approaches are denied", () => {
  it.each([
    ["Ramallah", 31.9, 35.2],
    ["Jenin", 32.46, 35.3],
    ["Hebron", 31.53, 35.1],
    ["Jericho", 31.86, 35.46],
    ["Qatanna", 31.817, 35.117],
    ["Beit Anan", 31.85, 35.1],
    ["Modiin (5 km strip west of the Green Line)", 31.9, 35.01],
    ["Qalqilya", 32.19, 34.97],
    ["al-Eizariya", 31.77, 35.26],
    ["Abu Dis", 31.76, 35.26],
    ["a-Ram", 31.85, 35.23],
    ["Anata", 31.8, 35.26],
    ["Hizma", 31.84, 35.26],
    ["al-Jib", 31.85, 35.17],
    ["Biddu", 31.84, 35.12],
    ["Beit Surik", 31.83, 35.14],
    ["Beit Iksa (real coordinates)", 31.818, 35.181],
    ["Ramot", 31.82, 35.19],
    ["Ramat Eshkol", 31.805, 35.225],
    ["Har Hotzvim", 31.81, 35.2],
    ["Nabi Samwil", 31.83, 35.18],
    ["al-Walaja", 31.72, 35.12],
    ["Battir", 31.73, 35.14],
    ["northern Beit Jala", 31.72, 35.19],
    ["Mount Scopus / Sheikh Jarrah side", 31.795, 35.24],
  ])("%s is denied", (_n, lat, lng) => {
    expect(classifyPoint(p(lat, lng)).status).toBe("denied");
  });

  it("a patch is denied if any corner is in a deny zone, even with an allowed centroid", () => {
    const centroid = p(33.0, 35.2);
    expect(classifyPoint(centroid).status).toBe("allowed");
    const v = classifyArea(centroid, { south: 32.99, north: 33.1, west: 35.19, east: 35.21 });
    expect(v.status).toBe("denied");
  });

  it("never returns 'mixed' (Jerusalem is allowed-core or denied)", () => {
    for (const [lat, lng] of [[31.775, 35.215], [31.78, 35.2], [31.8, 35.15], [31.76, 35.24]]) {
      expect(classifyPoint(p(lat, lng)).status).not.toBe("mixed");
    }
  });

  it("covers every border and region class in the model", () => {
    for (const id of [
      "gaza-strip",
      "gaza-envelope",
      "lebanon-border",
      "golan-yarmouk",
      "jordan-valley-east",
      "arava-dead-sea",
      "egypt-border",
      "egypt-west",
      "west-bank-north",
      "west-bank-south",
      "green-line-west-strip",
      "jerusalem-west-approach",
    ]) {
      expect(SAFETY_ZONE_IDS).toContain(id);
    }
  });
});
