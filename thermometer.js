// Simulated external temperature source (fluctuating around 0°C)
const externalTemperatureSource = (() => {
    // testing for freezing point both up and down
    const readings = [1.5, 1.0, 0.5, 0.0, -0.5, 0.0, -0.5, 0.0, 0.5, 0.0];
    // testing for boiling point both up and down
    // const readings = [90, 95, 99, 100, 100.5, 100, 99, 100, 110, 100];

    let i = 0;
    return () => readings[i++ % readings.length];
})();

class Threshold {
    constructor(tempC, margin, direction) {
        const validDirections = ["up", "down", "both"];

        // error checking
        if (typeof tempC !== "number") {
            throw new Error("Invalid temperature: must be a number.");
        }
        if (typeof margin !== "number") {
            throw new Error("Invalid margin: must be a number.");
        }
        if (!validDirections.includes(direction)) {
            throw new Error(`Invalid direction: must be one of ${validDirections.join(", ")}.`);
        }

        this.tempC = tempC;   // Threshold temperature in Celsius
        this.margin = margin;  // Margin for fluctuations
        this.direction = direction; // "up", "down", or "both"
        this.reached = false;  // Track if threshold has been reached
        this.previousTemp = null; // Track the previous temperature
    }
}

class Temperature {
    constructor(externalTemperatureSource, thresholds = []) {
        this.externalTemperatureSource = externalTemperatureSource; // Function to get temperature
        this.thresholds = thresholds; // Store thresholds
        this.listeners = new Set(); // Store listeners in a Set

        // Initialize thresholds if provided
        this.thresholds.forEach(thresh => {
            if (!(thresh instanceof Threshold)) {
                throw new Error("Invalid threshold format. Must be an instance of Threshold.");
            }
        });
    }

    // Register a listener for notifications
    registerListener(listener) {
        // Validate listener
        if (typeof listener !== "function") {
            throw new Error("Invalid listener: must be a function.");
        }
        this.listeners.add(listener); // Add to Set
    }

    // Convert Celsius to Fahrenheit
    toFahrenheit(celsius) {
        return (celsius * 9/5) + 32;
    }

    // Read the current temperature and check thresholds
    readTemperature() {
        let currentTemp;
        try {
            currentTemp = this.externalTemperatureSource();
            if (typeof currentTemp !== "number") {
                throw new Error("Invalid temperature reading: must be a number.");
            }
        } catch (error) {
            console.error(`Error reading temperature: ${error.message}`);
            return null; // Optionally return or handle as needed
        }
        
        this.checkThresholds(currentTemp); // Check against thresholds
        return currentTemp; // Return the current temperature
    }

    // Check thresholds and notify listeners if reached
    checkThresholds(currentTemp) {
        for (const threshold of this.thresholds) {
            const withinMargin = currentTemp <= threshold.tempC + threshold.margin && currentTemp >= threshold.tempC - threshold.margin;

            // Check the conditions based on direction
            if (!threshold.reached && withinMargin) {
                if (threshold.direction === "down" && threshold.previousTemp > threshold.tempC) {
                    threshold.reached = true; // Mark as reached
                    this.notifyListeners(threshold.tempC, currentTemp);
                } else if (threshold.direction === "up" && threshold.previousTemp < threshold.tempC) {
                    threshold.reached = true; // Mark as reached
                    this.notifyListeners(threshold.tempC, currentTemp);
                } else if (threshold.direction === "both") {
                    threshold.reached = true; // Mark as reached for both directions
                    this.notifyListeners(threshold.tempC, currentTemp);
                }
            } else if (threshold.reached && !withinMargin) {
                threshold.reached = false; // Reset if no longer valid
            }

            threshold.previousTemp = currentTemp; // Store the previous temperature
        }
    }

    // Notify registered listeners, passing both Celsius and Fahrenheit
    notifyListeners(tempC, currentTemp) {
        const tempF = this.toFahrenheit(tempC);
        for (const listener of this.listeners) {
            listener(tempC, tempF); // Call each listener with both temperatures
        }
    }
}

// Example usage
const freezingThreshold = new Threshold(0, 0.5, "both");   // Freezing point, notify on both directions
const boilingThreshold = new Threshold(100, 0.5, "both");    // Boiling point, notify on up direction only

// Create an instance of Temperature with predefined thresholds
const thermometer = new Temperature(externalTemperatureSource, [freezingThreshold, boilingThreshold]);

// Register a listener for alerts in Celsius and Fahrenheit
thermometer.registerListener((tempC, tempF) => {
    console.log(`Threshold reached: ${tempC}°C / ${tempF}°F`);
});

// Simulate reading temperatures
for (let i = 0; i < 10; i++) {
    const currentTemp = thermometer.readTemperature(); // Get current temperature
    // console.log(`Current Temperature: ${currentTemp}°C / ${thermometer.toFahrenheit(currentTemp)}°F`);
}
