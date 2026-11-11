# ccbb: virtual electronics lab for students

Test components before you buy them. Build circuits, simulate, measure and learn.

## Circuit Studio (working app)
Open `app/index.html` through a local server (`npm start`, then http://localhost:8000/app/).

**58 parts, 8 microcontrollers**
- Boards: Arduino Uno, Nano, Mega 2560, ESP32 DevKit, ESP8266 NodeMCU, Raspberry Pi Pico, Nano RP2040 Connect, STM32 Blue Pill
- Power: breadboard, battery, bench supply (current limit), 7805 regulator
- Passive: resistor, potentiometer, slide pot, ceramic + electrolytic capacitors, diode (silicon / Schottky)
- Transistors & ICs: BC547 NPN, BC557 PNP, IRLZ44N MOSFET, LM358 op-amp, NE555, 74HC00/04/08/32/86
- Output: LED, RGB LED, bar graph, 7-segment, LCD 16×2 I2C, OLED SSD1306, buzzer, servo, DC motor, relay, L298N
- Input: push button, slide switch, 4×4 keypad, joystick, DIP switch
- Sensors: DHT22, NTC, LDR, HC-SR04, PIR, MQ-2, flame, sound, tilt, pulse, MPU6050*, DS1307*, IR receiver* (*wiring + power checks only)
- Instruments: multimeter (V, A, Ω)

**Simulation**
- Nodal analysis with Newton–Raphson: Shockley diodes/LEDs, Ebers–Moll BJTs, square-law MOSFETs, op-amps with rail clipping
- Real-time transient simulation for capacitors and the 555 timer
- PWM simulated as true switching (duty-weighted average), not a lower voltage
- Mistake detection: burnt LEDs, shorts, pin overcurrent per chip, 5 V into 3.3 V boards, reversed electrolytics, missing base resistor, motors on pins…
- Code runner for beginner Arduino C on every board, with DHT, Servo, LiquidCrystal_I2C, Adafruit_SSD1306 and pulseIn

**Studio**: breadboard snap-in, neat right-angle wiring, zoom, part search, 13 starter projects, autosave, file save/open.

Tests: `npm test` (74 engine/unit + 24 browser tests).

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
- Wokwi Elements (MIT): `vendor/wokwi-elements.bundle.js`
