// Simulated external temperature source (fluctuating around 0°C)
import { EventEmitter } from "events";

const externalTemperatureSource = (() => {
  // testing for freezing point both up and down
  const readings = [1.5, 1.0, 0.5, 0.0, -0.5, 0.0, -0.5, 0.0, 0.5, 0.0];
  // testing for boiling point both up and down
  // const readings = [90, 95, 99, 100, 100.5, 100, 99, 100, 110, 100];

  let i = 0;
  return () => readings[i++ % readings.length];
})();

class Threshold {
  constructor(alertTemp, fluctuation, direction) {
    const validDirections = ["up", "down", "both"];

    // error checking
    if (typeof alertTemp !== "number") {
      throw new Error("Invalid alert temperature: must be a number.");
    }
    if (typeof fluctuation !== "number") {
      throw new Error("Invalid temperature fluctuation: must be a number.");
    }
    if (!validDirections.includes(direction)) {
      throw new Error(
        `Invalid direction: must be one of ${validDirections.join(", ")}.`
      );
    }

    this.alertTemp = alertTemp; // Threshold temperature in Celsius
    this.fluctuation = fluctuation; // Margin for fluctuations
    this.direction = direction; // "up", "down", or "both"
    this.reached = false; // Track if threshold has been reached
  }
}

class Thermometer {
  constructor(externalTemperatureSource, thresholds = []) {
    this.source = externalTemperatureSource; // Function to get temperature (sync or Promise)
    this.currentTemp = null; // numeric current temperature (Celsius)
    this.previousTemp = null; // Track the previous temperature (Celsius)
    this.thresholds = Array.isArray(thresholds) ? thresholds.slice() : []; // Copy of thresholds array if provided
    // legacy `listeners` removed; use `emitter` for subscriptions

    // validate threshold
    this.thresholds.forEach((thresh) => {
      if (!(thresh instanceof Threshold)) {
        throw new Error(
          "Invalid threshold format. Must be an instance of Threshold."
        );
      }
    });

    // Event emitter for decoupled subscriptions
    this.emitter = new EventEmitter();
  }

  // Register a listener for notifications
  // Legacy listener API removed. Use `on('threshold', fn)` instead.

  // Convert Celsius to Fahrenheit
  toFahrenheit(celsius) {
    return (celsius * 9) / 5 + 32;
  }

  // Read the current temperature (supports sync or Promise) and check thresholds
  async readTemperature() {
    this.previousTemp = this.currentTemp;
    try {
      this.currentTemp = await Promise.resolve(this.source());
    } catch (error) {
      console.error(
        `Error reading temperature: ${error && error.message ? error.message : error}`
      );
      return null;
    }

    if (typeof this.currentTemp !== "number" || Number.isNaN(this.currentTemp)) {
      throw new Error("Invalid temperature reading: must be a number.");
    }

    this.emitter.emit("reading", this.currentTemp);

    if (this.thresholds.length > 0) {
      this.checkThresholds();
    }

    return this.currentTemp;
  }

  // Check thresholds and notify listeners if reached
  checkThresholds() {
    if (this.thresholds.length === 0) {
      throw new Error("No thresholds defined");
    }
    for (const threshold of this.thresholds) {
      const withinFluctuation = this._isWithinFluctuation(this.currentTemp, threshold);
      if (!threshold.reached && withinFluctuation && this._isThresholdReached(threshold)) {
        this._handleThresholdReached(threshold, this.currentTemp);
      } else if (threshold.reached && !withinFluctuation) {
        threshold.reached = false;
      }
    }
    // No need to update previousTemp here; handled in readTemperature
  }

  // Helper method to check if the threshold has been reached based on direction
  _isThresholdReached(threshold) {
    switch (threshold.direction) {
      case "down":
        return this.previousTemp > threshold.alertTemp;
      case "up":
        return this.previousTemp < threshold.alertTemp;
      case "both":
        return true;
      default:
        return false;
    }
  }

  // Helper method to handle threshold crossing
  _handleThresholdReached(threshold, currentTemp) {
    threshold.reached = true;
    const event = this.createAlertEvent(currentTemp, threshold);
    this.emitter.emit("threshold", event);
  }

  _isWithinFluctuation(currentTemp, threshold) {
    return (
      currentTemp <= threshold.alertTemp + threshold.fluctuation &&
      currentTemp >= threshold.alertTemp - threshold.fluctuation
    );
  }

  // add a new threshold
  addThreshold(alertTemp, fluctuation, direction) {
    // Support either passing a Threshold instance or numeric args
    if (alertTemp instanceof Threshold) {
      this.thresholds.push(alertTemp);
      return alertTemp;
    }
    const threshold = new Threshold(alertTemp, fluctuation, direction);
    this.thresholds.push(threshold);
    return threshold; // for testing purposes
  }

  // Create an alert event object
  createAlertEvent(currentTemp, threshold) {
    const event = {
      threshold,
      tempC: currentTemp,
      tempF: this.toFahrenheit(currentTemp),
      direction: threshold.direction,
    };
    this.lastEvent = event; // helpful for tests
    return event;
  }

  // EventEmitter convenience wrappers
  on(eventName, listener) {
    this.emitter.on(eventName, listener);
  }
  off(eventName, listener) {
    this.emitter.off(eventName, listener);
  }
  once(eventName, listener) {
    this.emitter.once(eventName, listener);
  }
}

// export classes for testing and external use
export { Thermometer, Threshold, externalTemperatureSource };

// Example/demo runner (does not execute on import)
export async function runDemo() {
  // Create an instance of Thermometer
  const thermometer = new Thermometer(externalTemperatureSource);

  // add test thresholds (returns Threshold instances)
  thermometer.addThreshold(0, 0.5, "both");
  thermometer.addThreshold(100, 0.5, "both");

  // Subscribe to raw readings
  thermometer.on("reading", (v) => {
    console.log(
      `Reading: ${v}°C / ${thermometer.toFahrenheit(v).toFixed(1)}°F`
    );
  });

  // Subscribe to threshold events (preferred API)
  thermometer.on("threshold", (evt) => {
    console.log(
      `Threshold ${evt.threshold.alertTemp}°C (${evt.direction}) reached at ${evt.tempC}°C / ${evt.tempF.toFixed(1)}°F`
    );
  });

  // For compatibility-like behavior, subscribe to the 'threshold' event
  thermometer.on("threshold", (evt) => {
    console.log(
      `Listener: threshold ${evt.threshold.alertTemp}°C reached at ${evt.tempC}°C / ${evt.tempF.toFixed(1)}°F`
    );
  });

  // Simulate reading temperatures sequentially
  for (let i = 0; i < 10; i++) {
    await thermometer.readTemperature(); // Get and emit current temperature
  }
}

// demo runner not executed on import
