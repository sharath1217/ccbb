# ccbb: virtual electronics lab for students

Test components before you buy them. Build circuits, simulate, measure and learn.

## Files
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
