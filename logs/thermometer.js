// Simulated external temperature source (fluctuating around 0°C)
export const externalTemperatureSource = (() => {
  const readings = [1.5, 1.0, 0.5, 0.0, -0.5, 0.0, -0.5, 0.0, 0.5, 0.0];
  let i = 0;
  return () => readings[i++ % readings.length];
})();

class TemperatureConverter {
  /**
   * converts a temp in celsius to fahrenheit |
   * @param {*} temp in celsius or fahrenheit
   * @returns temp in
   */
  static celsiusToFahrenheit(c) {
    return (c * 9) / 5 + 32;
  }
  static fahrenheitToCelsius(f) {
    return ((f - 32) * 5) / 9;
  }
}

export class Thermometer {
  /**
   *
   * @param {*} externalTemperatureSource
   * returns temp in Celsius
   */
  constructor(externalTemperatureSource) {
    this.externalTemperatureSource = externalTemperatureSource; // function to get temperature
    this.currentTemp = null; // current temperature
    this.previousTemp = null; // previous temperature
    this.thresholds = []; // list of thresholds
    this.listeners = new Set(); // set of listeners for threshold events
  }

  // method that will read current temperature
  readTemperature() {
    return this.externalTemperatureSource(); // return a temperature
  }

  // allow users to add a threshold, return threshold added
  addThreshold(threshold) {
    this.thresholds.push(threshold);
    return threshold;
  }

  // check to see if the current temp is within the margin of a threshold
  inMargin(threshold, currentTemp) {
    return (
      currentTemp <= threshold.alertTemp + threshold.fluctuation &&
      currentTemp >= threshold.alertTemp - threshold.fluctuation
    );
  }

  createAlertEvent(currentTemp, threshold) {
    // create event to notify listeners
    return {
        threshold,
        tempC: currentTemp,
        tempF: TemperatureConverter.celsiusToFahrenheit(currentTemp),
        direction: threshold.direction
    };
  }

  notifyListeners(event) {
    // Deliver the event to each registered listener.
    // - Skip non-function entries (defensive)
    // - Catch errors per-listener so one bad listener doesn't stop others
    // - Return the number of listeners that were successfully invoked
    let notifiedCount = 0;
    for (const listener of this.listeners) {
      if (typeof listener !== 'function') continue;
      try {
        listener(event);
        notifiedCount += 1;
      } catch (err) {
        // Intentionally swallow listener errors to allow delivery to others.
        // console.error('Listener error:', err);
      }
    }
    return notifiedCount;
}

  // check the current temp against the thresholds
  checkThresholds(currentTemp) {
    // if there are no thresholds, throw an error
    if (this.thresholds.length === 0) {
      throw new Error("No thresholds defined");
    }
    
    const previousTemp = this.previousTemp;

    // iterate through defined thresholds
    for (const threshold of this.thresholds) {
      // for this threshold, is current temp within margin?
      const withinMargin = this.inMargin(threshold, currentTemp);

      // there are 2 main cases to handle:
      // was this threshold notified

      // check if threshold was previously reached
      if (!threshold.reached && withinMargin) {
        //check for direction
        if (
          threshold.direction === "both" ||
          (threshold.direction === "up" &&
            previousTemp < threshold.alertTemp) ||
          (threshold.direction === "down" && previousTemp > threshold.alertTemp)
        ) {
            // threshold crossed
            threshold.reached = true;
            // create an event and notify listeners
            this.notifyListeners(this.createAlertEvent(currentTemp, threshold));
        }
      } else if (threshold.reached && !withinMargin) {
        threshold.reached = false; // reset reached status
      }

      // update previous temp
      this.previousTemp = currentTemp;
    }
  }

  // Register a listener, returns an unregister function
  registerListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class Threshold {
  /**
   * @param {number} alertTemp - threshold temperature in degrees Celsius
   * @param {number} fluctuation - margin to ignore in degrees Celsius
   * @param {boolean} reached - whether threshold is currently crossed
   * @param {'both'|'up'|'down'} direction - direction of crossing
   *
   *
   */
  constructor(alertTemp, fluctuation = 0.5, direction = "both") {
    this.alertTemp = alertTemp; // threshold temperature in degrees Celsius
    this.fluctuation = fluctuation; // margin to ignore in degrees Celsius
    this.reached = false; // whether threshold is currently crossed
    this.direction = direction; // default "both" direction of crossing
  }
}

// Example usage
// Create a Thermometer instance with the external temperature source
const thermometer = new Thermometer(externalTemperatureSource);

// add example thresholds
thermometer.addThreshold(new Threshold(0, 0.5, "both"));
thermometer.addThreshold(new Threshold(10, 1.0, "up"));
thermometer.addThreshold(new Threshold(50, 5.0, "down"));

thermometer.registerListener((evt) => {
  console.log(
    `Threshold ${evt.threshold.alertTemp}°C crossed! Current: ${evt.tempC}°C / ${evt.tempF.toFixed(1)}°F`
  );
});

// Read temperatures multiple times
for (let i = 0; i < 10; i++) {
  const temp = await thermometer.readTemperature();
  console.log(`Current Temperature: ${temp}°C`);
  thermometer.checkThresholds(temp);
}
