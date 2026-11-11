# ccbb: virtual electronics lab for students

Test components before you buy them. Build circuits, simulate, measure and learn.

## Circuit Studio (working app)
Open `index.html` (home page with lessons) or `app/index.html` through a local server: `npm start`, then http://localhost:8000.

**17 microcontrollers**
Arduino Uno, Nano, Mega 2560, Leonardo, Pro Mini · ATmega328P chip, ATtiny85 · ESP32 DevKit, ESP32-C3, ESP32-S3, ESP8266 NodeMCU · Raspberry Pi Pico, Pico W, Nano RP2040 Connect · STM32 Blue Pill · **8051 AT89S52 (Keil C51)** · **PIC16F877A (MPLAB XC8)**

**73 components**
- Prototyping & power: breadboard, battery, bench supply (current limit), 7805
- Passive: resistor, potentiometer, slide pot, ceramic & electrolytic capacitors, diode, zener
- Transistors & ICs: BC547, BC557, IRLZ44N, LM358, NE555, 74HC00/04/08/32/86
- Output: LED, RGB LED, bar graph, 7-segment, LCD 16×2 and 20×4 (I2C), OLED, active & passive buzzer, servo, DC motor, relay, relay module, L298N, NeoPixel, NeoPixel ring
- Input: push button, slide switch, keypad 4×4, joystick, DIP switch
- Sensors: DHT22, LM35, DS18B20, NTC, BMP280, LDR, BH1750, HC-SR04, PIR, IR obstacle, MQ-2, MQ-135, flame, sound, tilt, vibration, touch, hall, reed, rain, soil moisture, water level, pulse, ACS712, voltage sensor, RC522 RFID, MPU6050*, DS1307*, IR receiver* (*wiring/power checks)
- Instruments: multimeter, 2-channel oscilloscope

**11 real-world tools (the "game" layer)**: lighter (off / gas / lit), fan, gas can, incense, torch, hand, ice, water, speaker, magnet, RFID card. Drag them near sensors: heat, light, gas, distance, motion, magnetism and moisture change with distance like in real life.

**Lab assistant**: works offline (reads your circuit, warnings and code). Optionally uses Claude with your own Anthropic API key (default model `claude-opus-5-5`, server-side refusal fallback enabled), called from the browser with the official SDK.

**Simulation**: nodal analysis + Newton–Raphson (diodes, BJTs, MOSFETs, op-amps with rail clipping), real-time transient (capacitors, 555), PWM as duty-weighted switching, mistake detection, Arduino C runner with DHT/Servo/LCD/OLED/OneWire/DallasTemperature/BMP280/BH1750/MFRC522/NeoPixel and pulseIn, plus register-level C for 8051 and PIC.

**Studio**: breadboard snap-in, rotation, neat right-angle wiring, zoom, search, info window for every part (outside / inside / pins / how it works / specs / mistakes / buying), parts list & cost (₹, CSV), undo/redo, 17 starter projects, autosave, offline install (PWA).

Tests: `npm test` (unit/accuracy + browser end-to-end).

## Earlier prototypes
- `index.html` + `components.js`: Component Test Lab (32 parts, compare, part finder)
- `studio.html`: 2D Circuit Studio design prototype (wiring, code panel, AI assistant, info popup)
- `lab3d.html`: 3D bench prototype (`?view=mcu|analog|explore|meter`)
- `part3d.html`: isometric 3D Arduino Uno explorer
- `screenshots/`: rendered screens

Open the HTML files through a local server (needed for the 3D pages):
    python3 -m http.server 8000

## Third-party (open source)
- Three.js (MIT): `vendor/three/`
- Anthropic TypeScript SDK (MIT), bundled for the browser: `vendor/anthropic-sdk.mjs`
- Wokwi Elements (MIT): `vendor/wokwi-elements.bundle.js`
