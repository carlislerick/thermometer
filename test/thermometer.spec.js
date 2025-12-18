import { expect } from "chai";
import {
  Thermometer,
  Threshold,
  externalTemperatureSource,
} from "../src/thermometer.js";

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
    const temp = await thermometer._readTemperature();
    expect(temp).to.be.a("number");
  });

  describe("checkThresholds methods", () => {
    it("should throw error when checking thresholds with none defined", async () => {
      try {
        await thermometer.checkThresholds();
        // If no error is thrown, fail the test
        throw new Error("Expected error was not thrown");
      } catch (err) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("No thresholds defined");
      }
    });

    it("should throw error when trying to add threshold with invalid format", () => {
      const threshold = new Threshold(0, 0.5, "both");
      expect(() => thermometer.addThreshold(threshold)).to.not.throw();
      expect(() => thermometer.addThreshold("invalid")).to.throw(
        "Invalid threshold format. Must be an instance of Threshold."
      );
    });

    it("should not throw error when thresholds are defined", async() => {
      const threshold = new Threshold(0, 0.5, "both");
      thermometer.addThreshold(threshold);
      try {
        await thermometer.checkThresholds();
      } catch (err) {
        throw new Error("No error should be thrown when thresholds are defined");
      }
    });

    it("should calculate within fluctuation correctly", () => {
      const threshold = new Threshold(10, 0.5, "both");
      expect(thermometer._isWithinFluctuation(10.4, threshold)).to.be.true;
      expect(thermometer._isWithinFluctuation(9.4, threshold)).to.be.false;
    });

    it("should determine if threshold is reached correctly for 'up' direction", () => {
      const thresholdUp = new Threshold(10, 0.5, "up");
      thermometer.previousTemp = 9;
      thermometer.currentTemp = 10.5;
      expect(thermometer._isThresholdReached(thresholdUp)).to.be.true;
      thermometer.previousTemp = 11;
      thermometer.currentTemp = 12;
      expect(thermometer._isThresholdReached(thresholdUp)).to.be.false;
    });

    it("should determine if threshold is reached correctly for 'down' direction", () => {
      const thresholdDown = new Threshold(10, 0.5, "down");
      thermometer.previousTemp = 11;
      thermometer.currentTemp = 9.5;
      expect(thermometer._isThresholdReached(thresholdDown)).to.be.true;
      thermometer.previousTemp = 9;
      thermometer.currentTemp = 8;
      expect(thermometer._isThresholdReached(thresholdDown)).to.be.false;
    });

    it("should determine if threshold is reached correctly for 'both' direction crossing up", () => {
      const thresholdBoth = new Threshold(10, 0.5, "both");
      thermometer.previousTemp = 9;
      thermometer.currentTemp = 10.5;
      expect(thermometer._isThresholdReached(thresholdBoth)).to.be.true;
    });

    it("should determine if threshold is reached correctly for 'both' direction crossing down", () => {
      const thresholdBoth = new Threshold(10, 0.5, "both");
      thermometer.previousTemp = 11;
      thermometer.currentTemp = 9.5;
      expect(thermometer._isThresholdReached(thresholdBoth)).to.be.true;
    });

    it("should not trigger for 'both' direction when not crossing (stays below)", () => {
      const thresholdBoth = new Threshold(10, 0.5, "both");
      thermometer.previousTemp = 8;
      thermometer.currentTemp = 9;
      expect(thermometer._isThresholdReached(thresholdBoth)).to.be.false;
    });

    it("should not trigger for 'both' direction when not crossing (stays above)", () => {
      const thresholdBoth = new Threshold(10, 0.5, "both");
      thermometer.previousTemp = 12;
      thermometer.currentTemp = 11;
      expect(thermometer._isThresholdReached(thresholdBoth)).to.be.false;
    });

    it("should handle threshold reached correctly", () => {
      const threshold = new Threshold(10, 0.5, "up");
      thermometer.previousTemp = 9;
      thermometer._handleThresholdReached(threshold, 10);
      expect(threshold.reached).to.be.true;
    });

    it("should create alert event correctly", () => {
      const threshold = new Threshold(10, 0.5, "up");
      const event = thermometer._createAlertEvent(10, threshold);
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

        it("should skip null readings from the source", async () => {
      // Create a source that returns null first, then a valid number
      let callCount = 0;
      const nullThenNumberSource = () => {
        callCount++;
        return callCount === 1 ? null : 25;
      };
      const thermometer = new Thermometer(nullThenNumberSource);

      // Should skip null and return 25
      const temp = await thermometer._readTemperature();
      expect(temp).to.equal(25);
      expect(thermometer.currentTemp).to.equal(25);
    });

    it("should not emit events for null readings", async () => {
      // Source always returns null
      const alwaysNullSource = () => null;
      const thermometer = new Thermometer(alwaysNullSource);
      let eventEmitted = false;
      thermometer.on("threshold", () => {
        eventEmitted = true;
      });
      try {
        await thermometer._readTemperature();
      } catch (e) {
        // ignore error if thrown after max retries
      }
      expect(eventEmitted).to.be.false;
    });
  });

  it("should add a threshold correctly", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const addedThreshold = thermometer.addThreshold(threshold);
    expect(thermometer.thresholds).to.include(addedThreshold);
    expect(addedThreshold).to.be.an.instanceof(Threshold);
    expect(addedThreshold.alertTemp).to.equal(0);
    expect(addedThreshold.fluctuation).to.equal(0.5);
    expect(addedThreshold.direction).to.equal("both");
  });

  it("should create correct event object for threshold", () => {
    const threshold = new Threshold(0, 0.5, "both");
    const event = thermometer._createAlertEvent(0.0, threshold);
    expect(event).to.have.property("threshold", threshold);
    expect(event).to.have.property("tempC", 0.0);
    expect(event).to.have.property("tempF", 32.0);
    expect(event).to.have.property("direction", "both");
  });
});
