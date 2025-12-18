import { expect } from "chai";
import { Thermometer, Threshold, externalTemperatureSource } from "../src/thermometer.js";

// verify source is producing temps
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
  let thermometer;

  // initialize Thermometer instance before each test
  beforeEach(() => {
    thermometer = new Thermometer(externalTemperatureSource);
  });

  it("should init class properties correctly", () => {
    expect(thermometer.currentTemp).to.be.null;
    expect(thermometer.previousTemp).to.be.null;
    expect(thermometer.thresholds).to.be.an("array").that.is.empty;
  });

  it("should convert Celsius to Fahrenheit correctly", () => {
    const fahrenheit = thermometer.toFahrenheit(0);
    expect(fahrenheit).to.equal(32);
  });

  it("should read a temperature", async () => {
    const temp = await thermometer.readTemperature();
    expect(temp).to.be.a("number");
  });

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

    it("should calculate within fluctuation correctly", () => {
      const threshold = new Threshold(10, 0.5, "both");
      expect(thermometer._isWithinFluctuation(10.4, threshold)).to.be.true;
      expect(thermometer._isWithinFluctuation(9.4, threshold)).to.be.false;
    });

    it("should determine if threshold is reached correctly", () => {
      const thresholdUp = new Threshold(10, 0.5, "up");
      const thresholdDown = new Threshold(10, 0.5, "down");
      thermometer.previousTemp = 9;
      expect(thermometer._isThresholdReached(thresholdUp)).to.be.true;
      thermometer.previousTemp = 11;
      expect(thermometer._isThresholdReached(thresholdDown)).to.be.true;
    });

    it("should handle threshold reached correctly", () => {
      const threshold = new Threshold(10, 0.5, "up");
      thermometer.previousTemp = 9;
      thermometer._handleThresholdReached(threshold, 10);
      expect(threshold.reached).to.be.true;
    });

    it("should create alert event correctly", () => {
      const threshold = new Threshold(10, 0.5, "up");
      const event = thermometer.createAlertEvent(10, threshold);
      expect(event).to.have.property("threshold", threshold);
      expect(event).to.have.property("tempC", 10);
      expect(event).to.have.property("tempF", 50);
      expect(event).to.have.property("direction", "up");
    });

    it("should emit alert event when threshold is reached", (done) => {
      const threshold = new Threshold(10, 0.5, "up");
      thermometer.addThreshold(threshold);
      thermometer.previousTemp = 9;
      thermometer.emitter.on("threshold", (event) => {
        expect(event).to.have.property("threshold", threshold);
        expect(event).to.have.property("tempC", 10);
        expect(event).to.have.property("tempF", 50);
        expect(event).to.have.property("direction", "up");
        done();
      });
      thermometer._handleThresholdReached(threshold, 10);
    });

  });

  it("should add a threshold correctly", () => {
    const addedThreshold = thermometer.addThreshold(0, 0.5, "both");
    expect(thermometer.thresholds).to.include(addedThreshold);
    expect(addedThreshold).to.be.an.instanceof(Threshold);
    expect(addedThreshold.alertTemp).to.equal(0);
    expect(addedThreshold.fluctuation).to.equal(0.5);
    expect(addedThreshold.direction).to.equal("both");
  });

  it("should create correct event object for threshold", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const event = thermometer.createAlertEvent(0.0, threshold);
    expect(event).to.have.property("threshold", threshold);
    expect(event).to.have.property("tempC", 0.0);
    expect(event).to.have.property("tempF", 32.0);
    expect(event).to.have.property("direction", "both");
  });
});
