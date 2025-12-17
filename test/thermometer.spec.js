import { expect } from "chai";
import { externalTemperatureSource } from "../thermometer.js";
import { Thermometer } from "../thermometer.js";
import { Threshold } from "../thermometer.js";

// verify simulated source is producing temps
// TODO: remove this test once connected to live feed
describe("External Temperature Source", () => {
  it("should return the correct temperature readings", () => {
    const expectedReadings = [
      1.5, 1.0, 0.5, 0.0, -0.5, 0.0, -0.5, 0.0, 0.5, 0.0,
    ];

    expectedReadings.forEach((expected, index) => {
      const actual = externalTemperatureSource();
      console.log("here's the actual reading", actual);
      expect(actual).to.equal(expected);
    });
  });

  it("should cycle through the readings correctly", () => {
    const readingsCount = 10;

    for (let i = 0; i < readingsCount; i++) {
      externalTemperatureSource(); // Advance through the readings
    }

    // After 10 readings, the cycle should return to the first temperature
    const firstReading = externalTemperatureSource();
    expect(firstReading).to.equal(1.5); // The first reading should be 1.5
  });
});

describe("Temperature Class", () => {
  let temperature;

  // initialize Temperature instance before each test
  beforeEach(() => {
    temperature = new Thermometer(externalTemperatureSource);
  });

  it("should read a temperature", () => {
    const temp = temperature.readTemperature();
    expect(temp).to.be.a("number");
  });

  it("should init class properties correctly", () => {
    expect(temperature.currentTemp).to.be.null;
    expect(temperature.previousTemp).to.be.null;
    expect(temperature.thresholds).to.be.an("array").that.is.empty;
    expect(temperature.listeners).to.be.an.instanceof(Set).that.is.empty;
  });

  it("should add a threshold correctly", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const addedThreshold = temperature.addThreshold(threshold);
    expect(temperature.thresholds).to.include(addedThreshold);
    expect(addedThreshold).to.equal(threshold);
  });

  it("inMargin should return true if inside margin", () => {
    const threshold = new Threshold(10, 1.0, "both");
    expect(temperature.inMargin(threshold, 10.5)).to.be.true;
  });

  it("inMargin should return false if outside margin", () => {
    const threshold = new Threshold(10, 1.0, "both");
    expect(temperature.inMargin(threshold, 12.0)).to.be.false;
  });

  it("createAlertEvent should create correct event object", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const event = temperature.createAlertEvent(0.0, threshold);
    expect(event).to.have.property("threshold", threshold);
    expect(event).to.have.property("tempC", 0.0);
    expect(event).to.have.property("tempF", 32.0);
    expect(event).to.have.property("direction", "both");
  });

  describe('notifyListeners test', () => {
    it('should include valid events and exclude invalid events', () => {
        const therm = new Thermometer(() => 0);
        let called = 0;

        therm.registerListener(() => { called += 1; });
        therm.registerListener(() => { throw new Error('boom'); });
        therm.registerListener(() => { called += 1; });

        const event = { test: true };
        const notified = therm.notifyListeners(event);

        expect(notified).to.equal(2);
        expect(called).to.equal(2);
    });

    it('skips non-function entries in the listeners set', () => {
        const t = new Thermometer(() => 0);
        // intentionally add a non-function to simulate accidental mutation
        t.listeners.add(123);

        let called = 0;
        t.registerListener(() => { called += 1; });

        const notified = t.notifyListeners({});
        expect(notified).to.equal(1);
        expect(called).to.equal(1);
    });
});

  describe("checkThresholds method", () => {

    it("should throw error when checking thresholds with none defined", () => {
        expect(() => temperature.checkThresholds()).to.throw(
        "No thresholds defined"
        );
    });

    it("should not throw error when thresholds are defined", () => {
      const threshold = new Threshold(0, 0.5, "both");
      temperature.addThreshold(threshold);
      expect(() => temperature.checkThresholds()).to.not.throw();
    });

    
  });
});

describe("Threshold Class", () => {
  let threshold;

  // initialize Threshold instance before each test
  beforeEach(() => {
    threshold = new Threshold(0, 0.5, "both");
  });

  it("should init class properties correctly", () => {
    expect(threshold.alertTemp).to.equal(0);
    expect(threshold.fluctuation).to.equal(0.5);
    expect(threshold.reached).to.be.false;
    expect(threshold.direction).to.equal("both");
  });
});
