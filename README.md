# ccbb: virtual electronics lab for students

Test components before you buy them. Build circuits, simulate, measure and learn.

## Circuit Studio (working app)
Open `app/index.html` through a local server (`npm start`, then http://localhost:8000/app/).
- Add parts, drag them, click pin → pin to wire
- Real DC circuit simulation (nodal analysis + LED/diode model): LED current and brightness, burnt LEDs, short circuits, pin overcurrent, resistor overheating
- Run Arduino Uno code (beginner Arduino C: setup/loop, pinMode, digital/analog read/write, delay, millis, Serial, map...)
- Multimeter: volts, amps (in series), ohms (warns if powered)
- Current shown flowing along wires; hover pins for voltage
- 6 starter projects, autosave, save/open file, "Code from my circuit"

Tests: `npm test` (26 engine/unit tests + 12 browser tests).

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
