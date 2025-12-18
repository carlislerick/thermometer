# thermometer

## Comments

```considered adding typing but felt runtime checks are appropriate for the scope.

```

## Quick Usage

Run the demo (uses the event-driven API):

```bash
node -e "import('./src/thermometer.js').then(m=>m.runDemo())"
```

Programmatic usage (ES modules):

```javascript
import {
  Thermometer,
  Threshold,
  externalTemperatureSource,
} from "./thermometer.js";

const therm = new Thermometer(externalTemperatureSource);

// subscribe to raw readings
therm.on("reading", (v) => console.log("reading", v));

// subscribe to threshold events
therm.on("threshold", (evt) => console.log("threshold", evt));

// subscribe to threshold events (preferred)
therm.on("threshold", (evt) => console.log("threshold", evt));

await therm.readTemperature(); // reads + emits
```

## Run tests:

```bash
npm test
```

## Requirements Doc

```wizards full stack engineer take home test thermometer

Design and implement  a thermometer class or classes that read the temperature of some external source.

The thermometer needs to be able to provide temperature in both Fahrenheit and Celsius.  It must be possible for callers of the class(es) to define arbitrary thresholds such as freezing and boiling at which the thermometer class will inform the appropriate callers that a specific threshold has been reached.

Note that callers of the class may not want to be repeatedly informed that a given threshold has been reached if the temperature is fluctuating around the threshold point. For example, consider the following temperature readings from the external source:

1.5 C
1.0 C
0.5 C
0.0 C
-0.5 C
0.0 C
-0.5 C
0.0 C
0.5 C
0.0 C

Some callers may only want to be informed that the temperature has reached 0 degrees C once because they consider fluctuations of +/- 0.5 degrees insignificant. It may also be important for some callers to be informed that a threshold has been reached only if the threshold was reached from a certain direction. For example, some callers may only care about a freezing point threshold if the previous temperature was above freezing (i.e. they only care about the threshold if it occurred while the temperature was dropping).
```

## Requirements Summary

```1. Thermometer Class to Read External Temperature

    Implementation: The main class is Temperature, which uses an external temperature source to read temperature values. It retrieves temperature readings through a callback function, encapsulating the reading logic.

2. Provide Temperature in Both Fahrenheit and Celsius

    Implementation: The Temperature class includes the toFahrenheit method, which converts Celsius readings to Fahrenheit. This ensures that both temperature units are accessible to users.

3. Define Arbitrary Thresholds

    Implementation: Users can create instances of the Threshold class with customizable values for target temperature, margin, and direction. This allows any threshold (e.g., freezing or boiling points) to be defined as needed.

4. Inform Callers of Thresholds

    Implementation: The registerListener method allows callers to register callback functions. When a threshold is reached, these listeners are notified, meeting the requirement to inform callers.

5. Avoid Repeated Notifications for Fluctuations

    Implementation: The checkThresholds method checks if the current temperature is within the defined margin around the threshold. It only notifies listeners when the threshold status changes (from not reached to reached and vice versa), which prevents repeated notifications during small fluctuations.

6. Directional Notifications on Thresholds

    Implementation: The Threshold class has a direction property, which can be set to "up", "down", or "both". The checkThresholds method considers the previous temperature to determine if the threshold was crossed in the specified direction, thus allowing for directional notifications.

Summary of Requirements Met
Requirement	Status
Thermometer class reads external temperature	✔️
Provides temperature in Fahrenheit and Celsius	✔️
Allows defining arbitrary thresholds	✔️
Notifies callers when thresholds are reached	✔️
Prevents repeated notifications	✔️
Allows directional notifications	✔️
```
