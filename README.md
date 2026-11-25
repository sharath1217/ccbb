# ccbb: virtual electronics lab for students

Test components before you buy them. Build circuits, simulate, measure and learn.

## Circuit Studio (working app)
Open `index.html` (home page with lessons) or `app/index.html` through a local server: `npm start`, then http://localhost:8000.

**17 microcontrollers**
Arduino Uno, Nano, Mega 2560, Leonardo, Pro Mini · ATmega328P chip, ATtiny85 · ESP32 DevKit, ESP32-C3, ESP32-S3, ESP8266 NodeMCU · Raspberry Pi Pico, Pico W, Nano RP2040 Connect · STM32 Blue Pill · **8051 AT89S52 (Keil C51)** · **PIC16F877A (MPLAB XC8)**

**131 components**
- Prototyping & power: breadboard, battery, bench supply (current limit), 7805, step-down transformer (12-0-12 V AC)
- Passive: resistor, potentiometer, slide pot, ceramic & electrolytic capacitors, diode, zener
- Transistors & ICs: BC547, BC557, IRLZ44N, LM358, NE555, 74HC00/02/04/08/32/86
- Digital ICs: 74HC74 D flip-flop, 74HC112 JK flip-flop, 74HC161 counter, 74HC90 decade counter, CD4017, 74HC151 & 74HC153 MUX, 74HC138 decoder, 74HC283 adder, 74HC85 comparator, 74HC595 & 74HC194 shift registers, 74LS47 7-segment driver (real pinouts, edge-triggered)
- Output: LED, RGB LED, bar graph, 7-segment, LCD 16×2 (I2C and parallel HD44780) and 20×4, OLED, TM1637 4-digit, MAX7219 8×8 matrix, buzzers, servo, DC motor, 28BYJ-48 stepper + ULN2003, relay, L298N, NeoPixel, DAC0808
- Input: push button, slide switch, keypad 4×4, joystick, DIP switch, KY-040 rotary encoder
- Sensors: DHT22, LM35, DS18B20, NTC, BMP280, LDR, BH1750, HC-SR04, PIR, IR obstacle, MQ-2, MQ-135, flame, sound, tilt, vibration, touch, hall, reed, rain, soil moisture, water level, pulse, ACS712, voltage sensor, RC522 RFID, HX711 load cell, ADC0804, MPU6050*, DS1307*, IR receiver* (*wiring/power checks)
- Communication: HC-05 Bluetooth (with a phone terminal)
- Instruments: multimeter, 2-channel oscilloscope

**Labs**
- **Circuit Lab** (`app/lab.html`): schematic editor with DC operating point, transient, AC (Bode) and DC sweep.
- **8051 Assembly Lab** (`app/asm51.html`): assembler + instruction-level emulator with registers, flags, RAM, ports, timers, serial and interrupts (13 VTU programs).
- **Signals, DSP & Control Lab** (`app/dsp.html`): 16 MATLAB-style experiments (sampling, convolution, correlation, DFT/FFT, FIR/IIR design, step response, Bode/margins, root locus, Routh, PID). Results are checked against SciPy; each shows the same code in free Python and can run it in the browser (Pyodide, downloaded on first use).
- **Interfacing**: 8051 in Keil C or assembly drives steppers, DAC, LCD, ADC, timers and serial; digital-lab breadboards with real 74xx chips.

**11 real-world tools (the "game" layer)**: lighter (off / gas / lit), fan, gas can, incense, torch, hand, ice, water, speaker, magnet, RFID card. Drag them near sensors: heat, light, gas, distance, motion, magnetism and moisture change with distance like in real life.

**Lab assistant**: works offline (reads your circuit, warnings and code). Optionally uses Claude with your own Anthropic API key (default model `claude-opus-5-5`, server-side refusal fallback enabled), called from the browser with the official SDK.

**Simulation**: nodal analysis + Newton–Raphson (diodes, BJTs, MOSFETs, op-amps with rail clipping), real-time transient (capacitors, 555), PWM as duty-weighted switching, mistake detection, Arduino C runner with DHT/Servo/LCD (I2C and LiquidCrystal)/OLED/OneWire/DallasTemperature/BMP280/BH1750/MFRC522/NeoPixel/TM1637Display/LedControl/HX711/SoftwareSerial, shiftOut, pulseIn and Serial input, plus register-level C for 8051 and PIC.

**Studio**: breadboard snap-in, rotation, neat right-angle wiring, zoom, search, info window for every part (outside / inside / pins / how it works / specs / mistakes / buying), parts list & cost (₹, CSV), undo/redo, 38 starter projects, autosave, offline install (PWA).

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

## Desktop app (free, works offline)
- **Download:** GitHub → Actions → "Desktop installers" → latest run → `ccbb-windows-latest` (Windows installer `.exe`) or `ccbb-ubuntu-latest` (Linux AppImage). Tagged versions also appear under Releases.
- **Build it yourself:** `npm install`, then `npm run dist:win` or `npm run dist:linux`. Run from source with `npm run desktop`.
- Licence: GPL-3.0 (free for everyone, forever).
