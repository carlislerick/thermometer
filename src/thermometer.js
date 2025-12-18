import { EventEmitter } from "events";

/**
 * Mock external temperature source function
 * Simulates temperature readings for testing
 * @returns {number} - Simulated temperature in Celsius
 * @example
 * const temp = externalTemperatureSource();
 * console.log(`External Temperature: ${temp}°C`);
 */
const externalTemperatureSource = (() => {
  // testing for freezing point both up and down
  const readings = [1.5, null, 1.0, 0.5, 0.0, -0.5, 0.0, -0.5, 0.0, 0.5, 0.0];
  // testing for boiling point both up and down
  // const readings = [90, 95, 99, 100, 100.5, 100, 99, 100, 110, 100];

  let i = 0;
  return () => readings[i++ % readings.length];
})();

/**
 * Class for defining temperature thresholds
 * @param {number} alertTemp
 * @param {number} fluctuation
 * @param {string} direction
 */
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

/**
 * Thermometer class to handle temperature
 * readings and thresholds
 * @param {Function} externalTemperatureSource - Function to get temperature readings
 * @param {Threshold[]} [thresholds=[]] - Optional array of Threshold instances
 * @throws {Error} - If externalTemperatureSource is not a function
 * Events:
 * @event threshold
 *   Emitted when a threshold is crossed.
 *   Payload: {
 *     threshold: Threshold, // The threshold that was crossed
 *     tempC: number,        // Temperature in Celsius
 *     tempF: number,        // Temperature in Fahrenheit
 *     direction: string     // "up", "down", or "both"
 *   }
 *
 * @example
 * thermometer.on("threshold", evt => {
 *   console.log(`Threshold ${evt.threshold.alertTemp}°C reached at ${evt.tempC}°C`);
 * });
 */
class Thermometer {
  constructor(externalTemperatureSource, thresholds = []) {
    // Function to get temperature (sync or Promise)
    this.source = externalTemperatureSource;
    // numeric current temperature (Celsius)
    this.currentTemp = null;
    // Track the previous temperature
    this.previousTemp = null;
    // Copy of thresholds array if provided
    this.thresholds = Array.isArray(thresholds) ? thresholds.slice() : [];

    // validate source is a function
    if (typeof externalTemperatureSource !== "function") {
      throw new Error("externalTemperatureSource must be a function.");
    }

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

  /**
   * Convert Celsius to Fahrenheit
   * @param {number} celsius Temperature in Celsius
   * @returns {number} Temperature in Fahrenheit
   * @example
   * const fahrenheit = thermometer.toFahrenheit(0);
   * console.log(`0°C is ${fahrenheit}°F`);
   */
  toFahrenheit(celsius) {
    // don't test for valid number, happens in _readTemperature
    return (celsius * 9) / 5 + 32;
  }

  /**
   * Read temperature from the external source and
   * update currentTemp
   * retries up to maxRetries times if invalid reading
   * @private
   * @param {number} [maxRetries=5] - Maximum number of retry attempts for reading temperature
   * @returns {number} - The current temperature in Celsius
   * @throws {Error} - if source fails
   * @throws {Error} - if no valid reading after maxRetries
   */
  async _readTemperature(maxRetries = 5) {
    let temp;
    let attempts = 0;

    // Retry reading temperature until valid or max retries reached
    while (attempts < maxRetries) {
      attempts++;
      // Get temperature from source
      // (supports Promise or direct value)
      try {
        temp = await Promise.resolve(this.source());
      } catch (error) {
        // throw an error instead of returning invalid temp
        throw new Error(`Temperature source error: ${error.message}`);
      }
      if (typeof temp === "number" && !Number.isNaN(temp)) {
        this.previousTemp = this.currentTemp;
        this.currentTemp = temp;
        return this.currentTemp;
      }
    }

    // If we reach here, no valid reading was received
    throw new Error(
      `No valid temperature reading after ${maxRetries} attempts.`
    );
  }

  /**
   * get a new temp and Check all defined
   * thresholds against the current
   * temperature and call event emitter
   * @throws {Error} - If no thresholds are defined
   */
  async checkThresholds() {
    // notify if no thresholds are defined
    if (this.thresholds.length === 0) {
      throw new Error("No thresholds defined");
    }

    // read a temperature from the source
    const temp = await this._readTemperature();

    // make sure we got a valid number, if not,
    // skip this reading
    if (typeof temp !== "number" || Number.isNaN(temp)) {
      return null;
    }

    // go through each threshold and check temperature
    for (const threshold of this.thresholds) {
      // check if this temp is within the fluctuation
      // range for the current threshold
      const withinFluctuation = this._isWithinFluctuation(
        this.currentTemp,
        threshold
      );
      if (
        !threshold.reached &&
        withinFluctuation &&
        this._isThresholdReached(threshold)
      ) {
        this._handleThresholdReached(threshold, this.currentTemp);
      } else if (threshold.reached && !withinFluctuation) {
        threshold.reached = false;
      }
    }
  }

  /**
   * @private
   * Determine if the threshold has been reached based on direction
   * @param threshold {Threshold} - The threshold to check
   * @returns {boolean} - True if threshold is reached, else false
   */
  _isThresholdReached(threshold) {
    switch (threshold.direction) {
      case "down":
        return this.previousTemp > threshold.alertTemp;
      case "up":
        return this.previousTemp < threshold.alertTemp;
      case "both":
        // Trigger if the threshold was crossed in either direction
        return (
          (this.previousTemp < threshold.alertTemp &&
            this.currentTemp >= threshold.alertTemp) ||
          (this.previousTemp > threshold.alertTemp &&
            this.currentTemp <= threshold.alertTemp)
        );
      default:
        return false;
    }
  }

  /**
   * @private
   * Handle actions when a threshold is reached
   * @param threshold {Threshold} - The threshold that was reached
   * @param currentTemp {number} - Current temperature in Celsius
   */
  _handleThresholdReached(threshold, currentTemp) {
    threshold.reached = true;
    const event = this._createAlertEvent(currentTemp, threshold);
    this.emitter.emit("threshold", event);
  }

  /**
   * @private
   * Check if current temperature is within the fluctuation range of the threshold
   * @param currentTemp {number} - Current temperature in Celsius
   * @param threshold {Threshold} - The threshold to check against
   * @returns {boolean} - True if within fluctuation range, else false
   */
  _isWithinFluctuation(currentTemp, threshold) {
    return (
      currentTemp <= threshold.alertTemp + threshold.fluctuation &&
      currentTemp >= threshold.alertTemp - threshold.fluctuation
    );
  }

  /**
   * add a new threshold
   * @param threshold {Threshold} Threshold instance
   * @returns {Threshold} - The created Threshold instance
   */
  addThreshold(threshold) {
    // Support either passing a Threshold instance or numeric args
    if (threshold instanceof Threshold) {
      this.thresholds.push(threshold);
      return threshold;
    } else {
      throw new Error(
        "Invalid threshold format. Must be an instance of Threshold."
      );
    }
  }

  /**
   * @private
   * Create an alert event object
   * @param currentTemp {number} - Current temperature in Celsius
   * @param threshold {Threshold} - The threshold that was reached
   * @returns {object} - Alert event object
   */
  _createAlertEvent(currentTemp, threshold) {
    const event = {
      threshold,
      tempC: currentTemp,
      tempF: this.toFahrenheit(currentTemp),
      direction: threshold.direction,
    };

    return event;
  }

  // EventEmitter convenience wrappers used in Demo and tests
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

/**
 * Demo function to showcase Thermometer usage
 * with threshold events
 * @example
 * node -e "import('./src/thermometer.js').then(m=>m.runDemo())"
 */
export async function runDemo() {
  // Create an instance of Thermometer
  const thermometer = new Thermometer(externalTemperatureSource);

  // add demo test thresholds (returns Threshold instances)
  thermometer.addThreshold(new Threshold(0, 0.5, "both"));
  thermometer.addThreshold(new Threshold(100, 0.5, "up"));

  // enable to subscribe to raw readings
  /*   thermometer.on("reading", (v) => {
    console.log(
      `Reading: ${v}°C / ${thermometer.toFahrenheit(v).toFixed(1)}°F`
    );
  }); */

  // Subscribe to threshold events (preferred API)
  thermometer.on("threshold", (evt) => {
    console.log(
      `Threshold ${evt.threshold.alertTemp}°C (${evt.direction}) reached at ${evt.tempC}°C / ${evt.tempF.toFixed(1)}°F`
    );
  });

  // Simulate reading temperatures sequentially
  for (let i = 0; i < 10; i++) {
    await thermometer.checkThresholds(); // Get and emit current temperature
  }
}
