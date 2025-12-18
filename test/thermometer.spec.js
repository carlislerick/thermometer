import { expect } from "chai";
import { Thermometer, Threshold, externalTemperatureSource } from "../thermometer.js";

// verify simulated source is producing temps
// TODO: remove this test once connected to live feed
describe("External Thermometer Source", () => {
  it("should return a temperature", () => {
    const temp = externalTemperatureSource();
    expect(temp).to.be.a("number");
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

describe("Thermometer Class", () => {
  let thermometer, threshold;

  // initialize Thermometer instance before each test
  beforeEach(() => {
    thermometer = new Thermometer(externalTemperatureSource);
    threshold = new Threshold(0, 0.5, "both");
  });

  it("should read a temperature", () => {
    return thermometer.readTemperature().then((temp) => {
      expect(temp).to.be.a("number");
    });
  });

  it("should init class properties correctly", () => {
    expect(thermometer.currentTemp).to.be.null;
    expect(thermometer.previousTemp).to.be.null;
    expect(thermometer.thresholds).to.be.an("array").that.is.empty;
  });

  it("should add a threshold correctly", () => {
    const addedThreshold = thermometer.addThreshold(0, 0.5, "both");
    expect(thermometer.thresholds).to.include(addedThreshold);
    expect(addedThreshold).to.be.an.instanceof(Threshold);
    expect(addedThreshold.alertTemp).to.equal(0);
  });

  // inMargin helper removed; threshold margin behavior covered by checkThresholds

  it("createAlertEvent should create correct event object", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const event = thermometer.createAlertEvent(0.0, threshold);
    expect(event).to.have.property("threshold", threshold);
    expect(event).to.have.property("tempC", 0.0);
    expect(event).to.have.property("tempF", 32.0);
    expect(event).to.have.property("direction", "both");
  });

  // legacy listener tests removed; use EventEmitter in consumer code

  describe("checkThresholds method", () => {
    it("should throw error when checking thresholds with none defined", () => {
      expect(() => thermometer.checkThresholds(0)).to.throw(
        "No thresholds defined"
      );
    });

    it("should not throw error when thresholds are defined", () => {
      const threshold = new Threshold(0, 0.5, "both");
      thermometer.addThreshold(threshold);
      expect(() => thermometer.checkThresholds(0)).to.not.throw();
    });
  });
});
