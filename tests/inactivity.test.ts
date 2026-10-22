import { describe, expect, it } from "vitest";
import { Inactivity } from "../src/core/inactivity";

describe("session expiration without relying on timer delivery", () => {
  it("expires at the idle boundary and starts a fresh interval on unlock", () => {
    const clock = new Inactivity();
    clock.reset(1_000, false);
    expect(clock.expired(300_999)).toBe(false);
    expect(clock.expired(301_000)).toBe(true);
    clock.reset(900_000, false);
    expect(clock.expired(900_001)).toBe(false);
    clock.activity(1_000_000);
    expect(clock.expired(1_299_999)).toBe(false);
    expect(clock.expired(1_300_000)).toBe(true);
  });

  it("checks the previous hidden interval before accepting resumed activity", () => {
    const clock = new Inactivity();
    clock.reset(0, false);
    clock.visibility(10_000, true);
    clock.visibility(20_000, true);
    expect(clock.expired(69_999)).toBe(false);
    expect(clock.expired(70_000)).toBe(true);
    clock.reset(80_000, false);
    clock.visibility(90_000, true);
    expect(clock.expired(100_000)).toBe(false);
    clock.visibility(100_000, false);
    expect(clock.expired(160_000)).toBe(false);
  });

  it("starts a hidden timeout on a hidden unlock and fails closed on clock rollback", () => {
    const clock = new Inactivity();
    clock.reset(10_000, true);
    expect(clock.expired(70_000)).toBe(true);
    expect(clock.expired(9_999)).toBe(true);
  });
});
