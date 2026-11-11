// Parts the student can place, and starter projects.
// Parts the student can place. controls = what the student can change (sliders / switches / menus).
const R = (label, key, min, max, step = 1, unit = '') => ({ kind: 'range', label, key, min, max, step, unit });
const T = (label, key, on = 'ON', off = 'OFF') => ({ kind: 'toggle', label, key, on, off });
const M = (label, key, options) => ({ kind: 'select', label, key, options });
export const CATALOG = [
  // ---- microcontrollers ----
  { type: 'uno', tag: 'wokwi-arduino-uno', name: 'Arduino Uno', group: 'Microcontrollers', props: {}, desc: 'ATmega328P · 5 V · 14 digital + 6 analog pins', price: [450, 700] },
  { type: 'nano', tag: 'wokwi-arduino-nano', name: 'Arduino Nano', group: 'Microcontrollers', props: {}, desc: 'ATmega328P · 5 V · small, breadboard friendly', price: [250, 400] },
  { type: 'mega', tag: 'wokwi-arduino-mega', name: 'Arduino Mega 2560', group: 'Microcontrollers', props: {}, desc: 'ATmega2560 · 5 V · 54 digital + 16 analog pins', price: [700, 1100] },
  { type: 'esp32', tag: 'wokwi-esp32-devkit-v1', name: 'ESP32 DevKit V1', group: 'Microcontrollers', props: {}, desc: '3.3 V · Wi-Fi + Bluetooth · 12-bit ADC', price: [350, 550] },
  { type: 'esp8266', tag: 'cb-esp8266', name: 'ESP8266 NodeMCU', group: 'Microcontrollers', props: {}, desc: '3.3 V · Wi-Fi · 1 analog pin', price: [250, 400] },
  { type: 'pico', tag: 'cb-pico', name: 'Raspberry Pi Pico', group: 'Microcontrollers', props: {}, desc: 'RP2040 · 3.3 V · 26 GPIO · 3 ADC', price: [350, 450] },
  { type: 'rp2040', tag: 'wokwi-nano-rp2040-connect', name: 'Nano RP2040 Connect', group: 'Microcontrollers', props: {}, desc: 'RP2040 · 3.3 V · Wi-Fi', price: [1800, 2600] },
  { type: 'bluepill', tag: 'cb-bluepill', name: 'STM32 Blue Pill', group: 'Microcontrollers', props: {}, desc: 'STM32F103 · 3.3 V · 72 MHz', price: [250, 400] },
  { type: 'leonardo', tag: 'cb-leonardo', name: 'Arduino Leonardo', group: 'Microcontrollers', props: {}, desc: 'ATmega32U4 · 5 V · native USB (keyboard/mouse)', price: [600, 900] },
  { type: 'promini', tag: 'cb-promini', name: 'Arduino Pro Mini', group: 'Microcontrollers', props: {}, desc: 'ATmega328P · 5 V · tiny, needs USB-serial adapter', price: [200, 300] },
  { type: 'atmega328', tag: 'cb-dip', attrs: { n: 28, label: 'ATMEGA328P' }, name: 'ATmega328P chip', group: 'Microcontrollers', props: {}, desc: 'Bare DIP-28 · build your own Arduino', price: [180, 300] },
  { type: 'attiny85', tag: 'cb-dip', attrs: { n: 8, label: 'ATTINY85' }, name: 'ATtiny85', group: 'Microcontrollers', props: {}, desc: 'DIP-8 · 5 I/O pins · tiny projects', price: [90, 150] },
  { type: 'esp32c3', tag: 'cb-esp32c3', name: 'ESP32-C3 Super Mini', group: 'Microcontrollers', props: {}, desc: 'RISC-V · 3.3 V · Wi-Fi + BLE · tiny', price: [250, 400] },
  { type: 'esp32s3', tag: 'cb-esp32s3', name: 'ESP32-S3 DevKitC', group: 'Microcontrollers', props: {}, desc: '3.3 V · Wi-Fi + BLE · USB · AI acceleration', price: [700, 1100] },
  { type: 'picow', tag: 'cb-picow', name: 'Raspberry Pi Pico W', group: 'Microcontrollers', props: {}, desc: 'RP2040 · 3.3 V · Wi-Fi', price: [550, 700] },
  { type: 'at89s52', tag: 'cb-dip', attrs: { n: 40, label: 'AT89S52 · 8051' }, name: '8051 (AT89S52)', group: 'Microcontrollers', props: {}, desc: 'DIP-40 · Keil C51 register code · ports P0–P3', price: [60, 120] },
  { type: 'pic16f877a', tag: 'cb-dip', attrs: { n: 40, label: 'PIC16F877A' }, name: 'PIC16F877A', group: 'Microcontrollers', props: {}, desc: 'DIP-40 · MPLAB XC8 code · PORTA–E', price: [180, 300] },
  // ---- prototyping & power ----
  { type: 'breadboard', tag: 'cb-breadboard', name: 'Breadboard', group: 'Prototyping & power', props: {}, desc: 'Half size · 30 columns · rows a–e and f–j joined, + and − rails', price: [80, 150] },
  { type: 'battery', tag: 'cb-battery', name: 'Battery', group: 'Prototyping & power', props: { volts: 9, rint: 1.5 }, desc: '9 V alkaline (change voltage below)', price: [30, 80], controls: [M('Voltage', 'volts', [1.5, 3, 3.7, 4.5, 6, 9, 12])] },
  { type: 'psu', tag: 'cb-psu', name: 'Bench power supply', group: 'Prototyping & power', props: { volts: 5, limit: 1 }, desc: '0–30 V adjustable with current limit', price: [3000, 6000], controls: [R('Voltage', 'volts', 0, 30, 0.1, 'V'), R('Current limit', 'limit', 0.05, 3, 0.05, 'A')] },
  { type: 'reg7805', tag: 'cb-to220', attrs: { label: '7805', pins: 'IN,GND,OUT' }, name: '7805 regulator', group: 'Prototyping & power', props: {}, desc: '5 V linear regulator · needs 7–35 V in', price: [10, 20] },
  // ---- passive ----
  { type: 'resistor', tag: 'wokwi-resistor', name: 'Resistor', group: 'Passive', props: { ohms: 220 }, desc: '¼ W carbon film', price: [1, 2], controls: [M('Resistance', 'ohms', [10, 47, 100, 220, 330, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000, 1000000])] },
  { type: 'pot', tag: 'wokwi-potentiometer', name: 'Potentiometer 10k', group: 'Passive', props: { ohms: 10000, pos: 50 }, desc: 'Rotary, linear taper', price: [10, 20], controls: [R('Knob', 'pos', 0, 100, 1, '%')] },
  { type: 'slidepot', tag: 'wokwi-slide-potentiometer', name: 'Slide potentiometer', group: 'Passive', props: { pos: 50 }, desc: '10 kΩ linear slider', price: [40, 80], controls: [R('Slider', 'pos', 0, 100, 1, '%')] },
  { type: 'capacitor', tag: 'cb-capacitor', name: 'Ceramic capacitor', group: 'Passive', props: { farads: 1e-7, rating: 50 }, desc: '100 nF (104) · 50 V · no polarity', price: [1, 3], controls: [M('Capacitance', 'farads', [1e-9, 1e-8, 1e-7, 1e-6])] },
  { type: 'ecap', tag: 'cb-ecap', name: 'Electrolytic capacitor', group: 'Passive', props: { farads: 1e-4, rating: 25 }, desc: 'Polarised! Stripe = − leg', price: [3, 10], controls: [M('Capacitance', 'farads', [1e-6, 1e-5, 4.7e-5, 1e-4, 4.7e-4, 1e-3])] },
  { type: 'diode', tag: 'cb-diode', name: 'Diode 1N4007', group: 'Passive', props: { kind: 'silicon' }, desc: '1 A rectifier · ~0.7 V drop · band = cathode', price: [1, 3], controls: [M('Type', 'kind', ['silicon', 'schottky'])] },
  // ---- semiconductors & ICs ----
  { type: 'npn', tag: 'cb-to92', attrs: { label: 'BC547' }, name: 'NPN transistor BC547', group: 'Transistors & ICs', props: { beta: 200 }, desc: '45 V · 100 mA · β≈200 · pins C B E', price: [2, 5] },
  { type: 'pnp', tag: 'cb-to92', attrs: { label: 'BC557' }, name: 'PNP transistor BC557', group: 'Transistors & ICs', props: { beta: 200 }, desc: '−45 V · −100 mA · pins C B E', price: [2, 5] },
  { type: 'nmos', tag: 'cb-to220', attrs: { label: 'IRLZ44N', pins: 'G,D,S' }, name: 'MOSFET IRLZ44N', group: 'Transistors & ICs', props: {}, desc: 'Logic-level N-channel · 55 V · 47 A', price: [40, 80] },
  { type: 'lm358', tag: 'cb-dip', attrs: { n: 8, label: 'LM358' }, name: 'Op-amp LM358', group: 'Transistors & ICs', props: {}, desc: 'Dual op-amp · 3–32 V single supply', price: [8, 15] },
  { type: 'ne555', tag: 'cb-dip', attrs: { n: 8, label: 'NE555' }, name: '555 timer NE555', group: 'Transistors & ICs', props: {}, desc: 'Timer / oscillator · 4.5–16 V', price: [5, 10] },
  { type: 'hc08', tag: 'cb-dip', attrs: { n: 14, label: '74HC08' }, name: 'AND gate 74HC08', group: 'Transistors & ICs', props: {}, desc: 'Quad 2-input AND · 2–6 V', price: [15, 25] },
  { type: 'hc32', tag: 'cb-dip', attrs: { n: 14, label: '74HC32' }, name: 'OR gate 74HC32', group: 'Transistors & ICs', props: {}, desc: 'Quad 2-input OR · 2–6 V', price: [15, 25] },
  { type: 'hc00', tag: 'cb-dip', attrs: { n: 14, label: '74HC00' }, name: 'NAND gate 74HC00', group: 'Transistors & ICs', props: {}, desc: 'Quad 2-input NAND · 2–6 V', price: [15, 25] },
  { type: 'hc86', tag: 'cb-dip', attrs: { n: 14, label: '74HC86' }, name: 'XOR gate 74HC86', group: 'Transistors & ICs', props: {}, desc: 'Quad 2-input XOR · 2–6 V', price: [15, 25] },
  { type: 'hc04', tag: 'cb-dip', attrs: { n: 14, label: '74HC04' }, name: 'NOT gate 74HC04', group: 'Transistors & ICs', props: {}, desc: 'Hex inverter · 2–6 V', price: [15, 25] },
  // ---- output ----
  { type: 'led', tag: 'wokwi-led', name: 'LED', group: 'Output', props: { color: 'red' }, desc: '5 mm, 20 mA rated', price: [1, 3], controls: [M('Colour', 'color', ['red', 'yellow', 'green', 'blue', 'white'])] },
  { type: 'rgb', tag: 'wokwi-rgb-led', name: 'RGB LED', group: 'Output', props: {}, desc: 'Common cathode · R G B pins', price: [5, 10] },
  { type: 'bargraph', tag: 'wokwi-led-bar-graph', name: 'LED bar graph', group: 'Output', props: {}, desc: '10 segments', price: [30, 60] },
  { type: 'seg7', tag: 'wokwi-7segment', name: '7-segment display', group: 'Output', props: { common: 'cathode' }, desc: 'Single digit · common cathode', price: [10, 20], controls: [M('Type', 'common', ['cathode', 'anode'])] },
  { type: 'lcd', tag: 'wokwi-lcd1602', attrs: { pins: 'i2c' }, name: 'LCD 16×2 (I2C)', group: 'Output', props: {}, desc: 'Address 0x27 · use LiquidCrystal_I2C', price: [180, 250] },
  { type: 'oled', tag: 'wokwi-ssd1306', name: 'OLED 0.96" SSD1306', group: 'Output', props: {}, desc: '128×64 · I2C 0x3C · use Adafruit_SSD1306', price: [180, 280] },
  { type: 'buzzer', tag: 'wokwi-buzzer', name: 'Active buzzer', group: 'Output', props: {}, desc: '5 V, beeps when powered', price: [10, 20] },
  { type: 'servo', tag: 'wokwi-servo', name: 'Servo SG90', group: 'Output', props: {}, desc: '0–180° · 4.8–6 V · use Servo library', price: [100, 150] },
  { type: 'motor', tag: 'cb-motor', name: 'DC motor', group: 'Output', props: {}, desc: '3–6 V hobby motor · ~300 mA+', price: [20, 40] },
  { type: 'relay', tag: 'wokwi-ks2e-m-dc5', name: 'Relay 5 V', group: 'Output', props: {}, desc: 'DPDT · coil 125 Ω (40 mA)', price: [40, 70] },
  { type: 'l298n', tag: 'cb-l298n', name: 'Motor driver L298N', group: 'Output', props: {}, desc: 'One motor channel · 5–35 V', price: [130, 200] },
  // ---- input ----
  { type: 'pushbutton', tag: 'wokwi-pushbutton', name: 'Push button', group: 'Input', props: { pressed: false }, desc: 'Momentary, 4 legs (pairs joined)', price: [2, 5], controls: [T('Pressed', 'pressed', 'Pressed', 'Released')] },
  { type: 'switch', tag: 'wokwi-slide-switch', name: 'Slide switch', group: 'Input', props: { on: false }, desc: 'SPDT: middle pin connects to a side', price: [5, 10], controls: [T('Position', 'on', 'ON (2–3)', 'OFF (1–2)')] },
  { type: 'keypad', tag: 'wokwi-membrane-keypad', name: 'Keypad 4×4', group: 'Input', props: { key: null }, desc: 'Membrane · rows R1–R4, columns C1–C4', price: [60, 100] },
  { type: 'joystick', tag: 'wokwi-analog-joystick', name: 'Joystick', group: 'Input', props: { x: 0, y: 0, pressed: false }, desc: '2 analog axes + push', price: [60, 100], controls: [R('X', 'x', -100, 100), R('Y', 'y', -100, 100), T('Button', 'pressed', 'Pressed', 'Released')] },
  { type: 'dipswitch', tag: 'wokwi-dip-switch-8', name: 'DIP switch ×8', group: 'Input', props: { bits: [0, 0, 0, 0, 0, 0, 0, 0] }, desc: '8 on/off switches', price: [15, 30] },
  // ---- sensors ----
  { type: 'dht22', tag: 'wokwi-dht22', name: 'DHT22 temp/humidity', group: 'Sensors', props: { temp: 27, hum: 55, lighter: 0 }, desc: '−40…80 °C ±0.5 · 0–100 %RH · use DHT library', price: [250, 350], controls: [R('Room temperature', 'temp', -40, 80, 0.5, '°C'), R('Humidity', 'hum', 0, 100, 1, '%'), R('🔥 Lighter distance (0 = off)', 'lighter', 0, 30, 1, 'cm')] },
  { type: 'ntc', tag: 'wokwi-ntc-temperature-sensor', name: 'NTC thermistor module', group: 'Sensors', props: { temp: 25 }, desc: '10 k NTC, β = 3950 · analog', price: [30, 50], controls: [R('Temperature', 'temp', -40, 120, 0.5, '°C')] },
  { type: 'ldr', tag: 'wokwi-photoresistor-sensor', name: 'Light sensor (LDR)', group: 'Sensors', props: { lux: 300, threshold: 50 }, desc: 'AO analog + DO threshold', price: [30, 50], controls: [R('Light', 'lux', 0, 5000, 10, 'lux'), R('DO threshold pot', 'threshold', 5, 95, 1, '%')] },
  { type: 'hcsr04', tag: 'wokwi-hc-sr04', name: 'Ultrasonic HC-SR04', group: 'Sensors', props: { dist: 50 }, desc: '2–400 cm · 5 V · use pulseIn', price: [60, 90], controls: [R('Object distance', 'dist', 0, 500, 1, 'cm')] },
  { type: 'pir', tag: 'wokwi-pir-motion-sensor', name: 'PIR motion HC-SR501', group: 'Sensors', props: { motion: false }, desc: 'Human motion · 5 V · output 3.3 V', price: [60, 90], controls: [T('Person moving', 'motion', 'Motion', 'Still')] },
  { type: 'gas', tag: 'wokwi-gas-sensor', name: 'Gas sensor MQ-2', group: 'Sensors', props: { ppm: 200, threshold: 40 }, desc: 'LPG / smoke · heater 150 mA', price: [100, 150], controls: [R('Gas level', 'ppm', 0, 10000, 50, 'ppm'), R('DO threshold', 'threshold', 5, 95, 1, '%')] },
  { type: 'flame', tag: 'wokwi-flame-sensor', name: 'Flame sensor', group: 'Sensors', props: { flame: 0 }, desc: 'IR flame · AO + DO (LOW = flame)', price: [40, 60], controls: [R('🔥 Flame (closer = higher)', 'flame', 0, 100, 1, '%')] },
  { type: 'sound', tag: 'wokwi-small-sound-sensor', name: 'Sound sensor', group: 'Sensors', props: { db: 40, threshold: 70 }, desc: 'Microphone · AO + DO', price: [30, 50], controls: [R('Sound level', 'db', 30, 110, 1, 'dB'), R('DO threshold', 'threshold', 40, 100, 1, 'dB')] },
  { type: 'tilt', tag: 'wokwi-tilt-switch', name: 'Tilt switch', group: 'Sensors', props: { tilted: false }, desc: 'Ball switch module', price: [20, 40], controls: [T('Tilted', 'tilted', 'Tilted', 'Level')] },
  { type: 'heartbeat', tag: 'wokwi-heart-beat-sensor', name: 'Pulse sensor', group: 'Sensors', props: { bpm: 72 }, desc: 'Analog heartbeat waveform', price: [150, 300], controls: [R('Heart rate', 'bpm', 40, 180, 1, 'bpm')] },
  { type: 'mpu6050', tag: 'wokwi-mpu6050', name: 'MPU6050 accel/gyro', group: 'Sensors', props: {}, desc: 'I2C 0x68 · 6-axis (wiring + power check)', price: [120, 180] },
  { type: 'rtc', tag: 'wokwi-ds1307', name: 'RTC DS1307', group: 'Sensors', props: {}, desc: 'Real-time clock · I2C (wiring + power check)', price: [80, 150] },
  { type: 'irrecv', tag: 'wokwi-ir-receiver', name: 'IR receiver', group: 'Sensors', props: {}, desc: '38 kHz · idle HIGH (wiring + power check)', price: [15, 30] },
  { type: 'lm35', tag: 'cb-to92', attrs: { label: 'LM35', pinnames: 'VCC,OUT,GND' }, name: 'LM35 temperature', group: 'Sensors', props: { temp: 27 }, desc: '10 mV/°C · analog · 4–30 V', price: [40, 70], controls: [R('Temperature', 'temp', -20, 150, 0.5, '°C')] },
  { type: 'ds18b20', tag: 'cb-to92', attrs: { label: 'DS18B20', pinnames: 'GND,DQ,VCC' }, name: 'DS18B20 temperature', group: 'Sensors', props: { temp: 25 }, desc: '1-Wire · −55…125 °C ±0.5 · needs 4.7 kΩ pull-up', price: [60, 120], controls: [R('Temperature', 'temp', -55, 125, 0.5, '°C')] },
  { type: 'bmp280', tag: 'cb-module', attrs: { label: 'BMP280', pins: 'VCC,GND,SCL,SDA', color: '#6d28d9' }, name: 'BMP280 pressure', group: 'Sensors', props: { temp: 27, alt: 920 }, desc: 'I2C · pressure + temperature + altitude', price: [90, 160], controls: [R('Altitude', 'alt', -100, 5000, 10, 'm'), R('Temperature', 'temp', -20, 80, 0.5, '°C')] },
  { type: 'bh1750', tag: 'cb-module', attrs: { label: 'BH1750', pins: 'VCC,GND,SCL,SDA,ADDR', color: '#1d4ed8' }, name: 'BH1750 light (lux)', group: 'Sensors', props: { lux: 300 }, desc: 'I2C · 1–65535 lux', price: [100, 160], controls: [R('Light', 'lux', 0, 20000, 10, 'lux')] },
  { type: 'mq135', tag: 'wokwi-gas-sensor', name: 'Air quality MQ-135', group: 'Sensors', props: { ppm: 400, threshold: 40 }, desc: 'CO₂/NH₃/smoke (relative) · heater 150 mA', price: [120, 180], controls: [R('Gas level', 'ppm', 0, 10000, 50, 'ppm')] },
  { type: 'irobstacle', tag: 'cb-module', attrs: { label: 'IR obstacle', pins: 'VCC,GND,OUT', color: '#1e3a8a' }, name: 'IR obstacle sensor', group: 'Sensors', props: { obstacle: false }, desc: 'FC-51 · OUT LOW when something is within ~10 cm', price: [30, 50], controls: [T('Obstacle', 'obstacle', 'Yes', 'No')] },
  { type: 'hall', tag: 'cb-module', attrs: { label: 'Hall A3144', pins: 'VCC,GND,OUT', color: '#14532d' }, name: 'Hall effect sensor', group: 'Sensors', props: { magnet: false }, desc: 'A3144 · OUT LOW near a magnet', price: [30, 50], controls: [T('Magnet', 'magnet', 'Near', 'Away')] },
  { type: 'reed', tag: 'cb-reed', name: 'Reed switch', group: 'Sensors', props: { magnet: false }, desc: 'Glass switch, closes near a magnet', price: [10, 20], controls: [T('Magnet', 'magnet', 'Near', 'Away')] },
  { type: 'touch', tag: 'cb-module', attrs: { label: 'Touch TTP223', pins: 'VCC,GND,SIG', color: '#b91c1c' }, name: 'Touch sensor', group: 'Sensors', props: { touched: false }, desc: 'TTP223 capacitive · SIG HIGH when touched', price: [20, 40], controls: [T('Touched', 'touched', 'Yes', 'No')] },
  { type: 'vibration', tag: 'cb-module', attrs: { label: 'Vibration SW-420', pins: 'VCC,GND,DO', color: '#1e40af' }, name: 'Vibration sensor', group: 'Sensors', props: { shaking: false }, desc: 'SW-420 · DO HIGH when shaken', price: [40, 70], controls: [T('Shaking', 'shaking', 'Yes', 'No')] },
  { type: 'rain', tag: 'cb-module', attrs: { label: 'Rain sensor', pins: 'VCC,GND,DO,AO', color: '#0f172a' }, name: 'Rain sensor', group: 'Sensors', props: { wet: 0 }, desc: 'FC-37 plate + board · DO LOW when wet', price: [40, 70], controls: [R('Water on plate', 'wet', 0, 100, 1, '%')] },
  { type: 'soil', tag: 'cb-module', attrs: { label: 'Soil moisture v1.2', pins: 'VCC,GND,AOUT', color: '#111827' }, name: 'Soil moisture (capacitive)', group: 'Sensors', props: { moisture: 20 }, desc: 'Analog · wetter soil = lower voltage', price: [80, 150], controls: [R('Soil moisture', 'moisture', 0, 100, 1, '%')] },
  { type: 'waterlevel', tag: 'cb-module', attrs: { label: 'Water level', pins: 'S,VCC,GND', color: '#b91c1c' }, name: 'Water level sensor', group: 'Sensors', props: { level: 0 }, desc: 'Analog · higher water = higher voltage', price: [30, 60], controls: [R('Water level', 'level', 0, 100, 1, '%')] },
  { type: 'acs712', tag: 'cb-module', attrs: { label: 'ACS712 5A', pins: 'IP+,IP-,VCC,OUT,GND', color: '#b91c1c' }, name: 'Current sensor ACS712', group: 'Sensors', props: {}, desc: '±5 A · 185 mV/A · OUT = 2.5 V at 0 A', price: [120, 200] },
  { type: 'voltsensor', tag: 'cb-module', attrs: { label: 'Voltage 0–25V', pins: 'VIN+,VIN-,S,+,-', color: '#b91c1c' }, name: 'Voltage sensor module', group: 'Sensors', props: {}, desc: '30k/7.5k divider · S = VIN ÷ 5', price: [40, 70] },
  { type: 'rc522', tag: 'cb-module', attrs: { label: 'RFID RC522', pins: 'SDA,SCK,MOSI,MISO,IRQ,GND,RST,3.3V', color: '#1e3a8a' }, name: 'RFID reader RC522', group: 'Sensors', props: {}, desc: '13.56 MHz · SPI · 3.3 V only · use MFRC522 library', price: [120, 200] },
  { type: 'zener', tag: 'cb-diode', attrs: { kind: 'zener' }, name: 'Zener diode', group: 'Passive', props: { vz: 5.1 }, desc: 'Holds a fixed reverse voltage · 0.5 W', price: [2, 5], controls: [M('Zener voltage', 'vz', [3.3, 4.7, 5.1, 6.2, 9.1, 12])] },
  { type: 'pbuzzer', tag: 'wokwi-buzzer', name: 'Passive buzzer', group: 'Output', props: {}, desc: 'Needs tone(pin, Hz) to make sound', price: [10, 20] },
  { type: 'neopixel', tag: 'wokwi-neopixel', name: 'NeoPixel (WS2812B)', group: 'Output', props: {}, desc: 'Addressable RGB LED · Adafruit_NeoPixel', price: [15, 30] },
  { type: 'ring', tag: 'wokwi-led-ring', attrs: { pixels: 12 }, name: 'NeoPixel ring (12)', group: 'Output', props: {}, desc: '12 addressable RGB LEDs · Adafruit_NeoPixel', price: [250, 400] },
  { type: 'lcd2004', tag: 'wokwi-lcd2004', attrs: { pins: 'i2c' }, name: 'LCD 20×4 (I2C)', group: 'Output', props: {}, desc: 'Address 0x27 · LiquidCrystal_I2C(0x27, 20, 4)', price: [350, 500] },
  { type: 'relaymod', tag: 'cb-module', attrs: { label: 'Relay module', pins: 'VCC,GND,IN,COM,NO,NC', color: '#1d4ed8' }, name: 'Relay module (1-ch)', group: 'Output', props: {}, desc: 'Transistor + diode built in · IN LOW = ON', price: [50, 80] },
  // ---- real world: drag these next to sensors to test them like in real life ----
  { type: 'lighter', tag: 'cb-tool', attrs: { kind: 'lighter' }, name: 'Lighter', group: 'Real world', props: { mode: 'off' }, desc: 'Heat + flame + light. "Gas only" leaks butane.', controls: [M('Lighter', 'mode', ['off', 'gas', 'lit'])] },
  { type: 'fan', tag: 'cb-tool', attrs: { kind: 'fan' }, name: 'Fan', group: 'Real world', props: { on: true }, desc: 'Blows heat and gas away, dries air', controls: [T('Fan', 'on')] },
  { type: 'gascan', tag: 'cb-tool', attrs: { kind: 'gascan' }, name: 'Gas can (LPG)', group: 'Real world', props: { on: false }, desc: 'Spray gas near a gas sensor', controls: [T('Spray', 'on', 'Spraying', 'Closed')] },
  { type: 'incense', tag: 'cb-tool', attrs: { kind: 'incense' }, name: 'Incense / smoke', group: 'Real world', props: { on: true }, desc: 'Smoke for gas and air-quality sensors', controls: [T('Burning', 'on')] },
  { type: 'torch', tag: 'cb-tool', attrs: { kind: 'torch' }, name: 'Torch', group: 'Real world', props: { on: true }, desc: 'Bright light for light sensors', controls: [T('Torch', 'on')] },
  { type: 'hand', tag: 'cb-tool', attrs: { kind: 'hand' }, name: 'Hand', group: 'Real world', props: {}, desc: 'Move it: distance, motion, touch, pulse' },
  { type: 'ice', tag: 'cb-tool', attrs: { kind: 'ice' }, name: 'Ice cube', group: 'Real world', props: {}, desc: 'Cools nearby temperature sensors' },
  { type: 'water', tag: 'cb-tool', attrs: { kind: 'water' }, name: 'Water', group: 'Real world', props: {}, desc: 'Wets rain/soil/level sensors, adds humidity' },
  { type: 'speaker', tag: 'cb-tool', attrs: { kind: 'speaker' }, name: 'Speaker / clap', group: 'Real world', props: { on: true }, desc: 'Loud sound for sound sensors', controls: [T('Sound', 'on')] },
  { type: 'magnet', tag: 'cb-tool', attrs: { kind: 'magnet' }, name: 'Magnet', group: 'Real world', props: {}, desc: 'Triggers hall and reed sensors' },
  { type: 'rfidcard', tag: 'cb-tool', attrs: { kind: 'rfidcard' }, name: 'RFID card', group: 'Real world', props: { uid: 'DE AD BE EF' }, desc: 'Hold over the RC522 reader', controls: [M('Card UID', 'uid', ['DE AD BE EF', '12 34 56 78', 'A1 B2 C3 D4'])] },
  // ---- instruments ----
  { type: 'scope', tag: 'cb-scope', name: 'Oscilloscope', group: 'Instruments', props: { tdiv: 0.2, vdiv: 2 }, desc: '2 channels · see voltage over time', price: [2500, 25000], controls: [M('Time / div (s)', 'tdiv', [0.001, 0.002, 0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1]), M('Volts / div', 'vdiv', [0.5, 1, 2, 5])] },
  { type: 'meter', tag: 'cb-multimeter', name: 'Multimeter', group: 'Instruments', props: { mode: 'V' }, desc: 'Volts · Amps · Ohms', price: [400, 1500], controls: [M('Mode', 'mode', ['V', 'A', 'Ω'])] },
];
export const BY_TYPE = Object.fromEntries(CATALOG.map(c => [c.type, c]));

const W = (from, to) => ({ from, to });
export const PROJECTS = {
  blink: { name: '1 · Blink an LED', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'red' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } }],
    wires: [W('uno1:13', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2')],
    code: `// Blink: turn the LED on for 1 second, off for 1 second
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}` },
  button: { name: '2 · Button controls LED', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'green' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } },
      { id: 'btn1', type: 'pushbutton', x: 470, y: 400, props: { pressed: false } }],
    wires: [W('uno1:13', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2'), W('uno1:2', 'btn1:1.l'), W('btn1:2.l', 'uno1:GND.3')],
    code: `// Hold the button to light the LED
const int BUTTON = 2;
const int LED = 13;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);  // pressed = LOW
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool pressed = digitalRead(BUTTON) == LOW;
  digitalWrite(LED, pressed ? HIGH : LOW);
  Serial.println(pressed ? "pressed" : "released");
  delay(200);
}` },
  dimmer: { name: '3 · Knob dims an LED (PWM)', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'yellow' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } },
      { id: 'pot1', type: 'pot', x: 0, y: 0, props: { ohms: 10000, pos: 50 }, at: { bb: 'bb1', pin: 'GND', hole: 'F22' } }],
    wires: [W('uno1:9', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2'), W('bb1:J22', 'bb1:BN22'), W('bb1:J24', 'bb1:BP24'), W('uno1:5V', 'bb1:BP2'), W('uno1:GND.2', 'bb1:BN2'), W('uno1:A0', 'bb1:J23')],
    code: `// Turn the knob to change LED brightness
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);              // 0..1023
  int level = map(knob, 0, 1023, 0, 255); // 0..255
  analogWrite(9, level);
  Serial.print("A0 = "); Serial.println(knob);
  delay(200);
}` },
  battery: { name: '4 · Battery + LED (no code)', parts: [
      { id: 'bat1', type: 'battery', x: 90, y: 160, props: { volts: 9, rint: 1.5 } },
      { id: 'sw1', type: 'switch', x: 260, y: 90, props: { on: true } },
      { id: 'r1', type: 'resistor', x: 380, y: 130, props: { ohms: 470 } },
      { id: 'led1', type: 'led', x: 520, y: 90, props: { color: 'red' } },
      { id: 'm1', type: 'meter', x: 330, y: 260, props: { mode: 'V' } }],
    wires: [W('bat1:+', 'sw1:2'), W('sw1:3', 'r1:1'), W('r1:2', 'led1:A'), W('led1:C', 'bat1:-'), W('m1:V', 'led1:A'), W('m1:COM', 'bat1:-')],
    code: `// This circuit has no microcontroller: just a battery.\n// Flip the switch, change the resistor, and read the multimeter.` },
  burn: { name: '5 · Mistake lab: LED without resistor', parts: [
      { id: 'bat1', type: 'battery', x: 120, y: 160, props: { volts: 9, rint: 1.5 } },
      { id: 'led1', type: 'led', x: 330, y: 110, props: { color: 'red' } }],
    wires: [W('bat1:+', 'led1:A'), W('led1:C', 'bat1:-')],
    code: `// What happens when you connect an LED straight to 9 V?\n// Look at the warnings panel, then fix it with a resistor.` },
  divider: { name: '6 · Voltage divider + multimeter', parts: [
      { id: 'bat1', type: 'battery', x: 80, y: 150, props: { volts: 9, rint: 1.5 } },
      { id: 'bb1', type: 'breadboard', x: 240, y: 110, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 1000 }, at: { bb: 'bb1', pin: '1', hole: 'C6' } },
      { id: 'r2', type: 'resistor', x: 0, y: 0, props: { ohms: 2000 }, at: { bb: 'bb1', pin: '1', hole: 'D12' } },
      { id: 'm1', type: 'meter', x: 600, y: 90, props: { mode: 'V' } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP6', 'bb1:A6'), W('bb1:E18', 'bb1:TN18'), W('m1:V', 'bb1:E12'), W('m1:COM', 'bb1:TN24')],
    code: `// Vout = Vin × R2 / (R1 + R2) = 9 × 2k / 3k = 6 V\n// Change R1 or R2 and check the multimeter.` },
  timer555: { name: '7 · 555 timer LED blinker (no code)', parts: [
      { id: 'bat1', type: 'battery', x: 40, y: 120, props: { volts: 9, rint: 1.5 } },
      { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
      { id: 't1', type: 'ne555', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 1000 }, at: { bb: 'bb1', pin: '1', hole: 'B5' } },
      { id: 'r2', type: 'resistor', x: 0, y: 0, props: { ohms: 47000 }, at: { bb: 'bb1', pin: '1', hole: 'C11' } },
      { id: 'c1', type: 'ecap', x: 0, y: 0, props: { farads: 1e-5, rating: 25 }, at: { bb: 'bb1', pin: '+', hole: 'H24' } },
      { id: 'r3', type: 'resistor', x: 0, y: 0, props: { ohms: 470 }, at: { bb: 'bb1', pin: '1', hole: 'I12' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'red' }, at: { bb: 'bb1', pin: 'A', hole: 'G18' } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP2', 'bb1:BP2'), W('bb1:TN3', 'bb1:BN3'), W('bb1:A10', 'bb1:TP10'), W('bb1:J13', 'bb1:BP13'),
      W('bb1:J16', 'bb1:BN16'), W('bb1:A5', 'bb1:TP5'), W('bb1:D17', 'bb1:D12'), W('bb1:G11', 'bb1:D12'), W('bb1:J11', 'bb1:J24'), W('bb1:J25', 'bb1:BN25'), W('bb1:J17', 'bb1:BN17'), W('bb1:J10', 'bb1:BN10')],
    code: `// No microcontroller: the NE555 makes the LED blink by itself.\n// Blink rate f = 1.44 / ((R1 + 2·R2) · C) ≈ 1.5 Hz with R1 = 1k, R2 = 47k, C = 10 µF.\n// Try a 100 µF capacitor or a 10k R2 and watch the speed change.` },
  opamp: { name: '8 · Op-amp amplifier ×3 (LM358)', parts: [
      { id: 'bat1', type: 'battery', x: 40, y: 120, props: { volts: 9, rint: 1.5 } },
      { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
      { id: 'u1', type: 'lm358', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
      { id: 'rf', type: 'resistor', x: 0, y: 0, props: { ohms: 20000 }, at: { bb: 'bb1', pin: '1', hole: 'H5' } },
      { id: 'rg', type: 'resistor', x: 0, y: 0, props: { ohms: 10000 }, at: { bb: 'bb1', pin: '1', hole: 'I11' } },
      { id: 'pot1', type: 'pot', x: 300, y: 330, props: { ohms: 10000, pos: 20 } },
      { id: 'm1', type: 'meter', x: 600, y: 270, props: { mode: 'V' } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP2', 'bb1:BP2'), W('bb1:TN3', 'bb1:BN3'), W('bb1:A10', 'bb1:TP10'), W('bb1:J13', 'bb1:BN13'),
      W('bb1:J10', 'bb1:J5'), W('bb1:J17', 'bb1:BN17'), W('pot1:VCC', 'bb1:BP26'), W('pot1:GND', 'bb1:BN22'), W('pot1:SIG', 'bb1:G12'), W('m1:V', 'bb1:G10'), W('m1:COM', 'bb1:BN28')],
    code: `// Non-inverting amplifier: Vout = Vin × (1 + Rf/Rg) = Vin × (1 + 20k/10k) = 3 × Vin\n// Turn the knob and compare the multimeter with 3 × the knob voltage.\n// Above ~2.5 V in, the LM358 output clips at about 7.5 V (1.5 V below the 9 V supply).` },
  gate: { name: '9 · Logic gate: AND (74HC08)', parts: [
      { id: 'bat1', type: 'battery', x: 40, y: 120, props: { volts: 4.5, rint: 0.3 } },
      { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
      { id: 'u1', type: 'hc08', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 330 }, at: { bb: 'bb1', pin: '1', hole: 'I12' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'green' }, at: { bb: 'bb1', pin: 'A', hole: 'G18' } },
      { id: 'swA', type: 'switch', x: 250, y: 330, props: { on: true } },
      { id: 'swB', type: 'switch', x: 360, y: 330, props: { on: false } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TN3', 'bb1:BN3'), W('bb1:TP2', 'bb1:BP2'), W('bb1:A10', 'bb1:TP10'), W('bb1:J16', 'bb1:BN16'), W('bb1:J17', 'bb1:BN17'),
      W('swA:2', 'bb1:J10'), W('swA:1', 'bb1:BN8'), W('swA:3', 'bb1:BP8'), W('swB:2', 'bb1:J11'), W('swB:1', 'bb1:BN20'), W('swB:3', 'bb1:BP20')],
    code: `// Output (pin 3) is HIGH only when input A (pin 1) AND input B (pin 2) are HIGH.\n// Flip the two switches to check the truth table. Swap the chip for 74HC32 (OR) or 74HC86 (XOR).` },
  mosfet: { name: '10 · MOSFET motor speed (PWM)', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: 'bat1', type: 'battery', x: 640, y: 300, props: { volts: 6, rint: 0.3 } },
      { id: 'q1', type: 'nmos', x: 470, y: 100, props: {} },
      { id: 'rg', type: 'resistor', x: 330, y: 230, props: { ohms: 10000 } },
      { id: 'd1', type: 'diode', x: 600, y: 40, props: { kind: 'silicon' } },
      { id: 'mot1', type: 'motor', x: 580, y: 120, props: {} }],
    wires: [W('uno1:9', 'q1:G'), W('q1:G', 'rg:1'), W('rg:2', 'uno1:GND.1'), W('q1:S', 'uno1:GND.2'), W('bat1:-', 'uno1:GND.3'), W('bat1:+', 'mot1:2'), W('mot1:1', 'q1:D'), W('d1:A', 'q1:D'), W('d1:K', 'bat1:+')],
    code: `// A logic-level MOSFET lets a 20 mA Arduino pin control a big motor current.\n// The diode protects the MOSFET from the motor's voltage spike.\nvoid setup() {\n  pinMode(9, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int speed = 0; speed <= 255; speed += 51) {\n    analogWrite(9, speed);\n    Serial.print("speed = "); Serial.println(speed);\n    delay(800);\n  }\n}` },
  weather: { name: '11 · DHT22 temperature on LCD', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: 'dht1', type: 'dht22', x: 470, y: 60, props: { temp: 27, hum: 55, lighter: 0 } },
      { id: 'lcd1', type: 'lcd', x: 430, y: 330, props: {} }],
    wires: [W('dht1:VCC', 'uno1:5V'), W('dht1:GND', 'uno1:GND.1'), W('dht1:SDA', 'uno1:2'), W('lcd1:VCC', 'uno1:5V'), W('lcd1:GND', 'uno1:GND.2'), W('lcd1:SDA', 'uno1:A4'), W('lcd1:SCL', 'uno1:A5')],
    code: `#include <DHT.h>\n#include <LiquidCrystal_I2C.h>\n\nDHT dht(2, DHT22);\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n\nvoid setup() {\n  Serial.begin(9600);\n  dht.begin();\n  lcd.init();\n  lcd.backlight();\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  float h = dht.readHumidity();\n  lcd.clear();\n  if (isnan(t)) { lcd.print("Sensor error"); delay(2000); return; }\n  lcd.setCursor(0, 0); lcd.print("Temp: "); lcd.print(t, 1); lcd.print(" C");\n  lcd.setCursor(0, 1); lcd.print("Hum:  "); lcd.print(h, 0); lcd.print(" %");\n  Serial.println(t);\n  delay(2000);\n}` },
  radar: { name: '12 · Ultrasonic distance → servo', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: 'us1', type: 'hcsr04', x: 430, y: 60, props: { dist: 50 } },
      { id: 'sv1', type: 'servo', x: 520, y: 330, props: {} }],
    wires: [W('us1:VCC', 'uno1:5V'), W('us1:GND', 'uno1:GND.1'), W('us1:TRIG', 'uno1:9'), W('us1:ECHO', 'uno1:10'), W('sv1:V+', 'uno1:5V'), W('sv1:GND', 'uno1:GND.2'), W('sv1:PWM', 'uno1:6')],
    code: `#include <Servo.h>\nServo arm;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(9, OUTPUT);   // TRIG\n  pinMode(10, INPUT);   // ECHO\n  arm.attach(6);\n}\n\nvoid loop() {\n  digitalWrite(9, LOW); delayMicroseconds(2);\n  digitalWrite(9, HIGH); delayMicroseconds(10);\n  digitalWrite(9, LOW);\n  long us = pulseIn(10, HIGH);\n  long cm = us * 0.0343 / 2;\n  Serial.print(cm); Serial.println(" cm");\n  arm.write(constrain(map(cm, 0, 200, 0, 180), 0, 180));\n  delay(200);\n}` },
  esp32: { name: '13 · ESP32 blink (3.3 V board)', parts: [
      { id: 'esp1', type: 'esp32', x: 40, y: 140, props: {} },
      { id: 'bb1', type: 'breadboard', x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'red' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } }],
    wires: [W('esp1:D4', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('esp1:GND.1', 'bb1:TN2')],
    code: `// ESP32 pins are 3.3 V. Red LED + 220 Ω ≈ 5 mA. Try a blue LED: it needs ~3 V, so it is very dim at 3.3 V.\n#define LED 4\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n  pinMode(LED_BUILTIN, OUTPUT);  // GPIO 2, the on-board blue LED\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  digitalWrite(LED, HIGH); digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED, LOW); digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n  Serial.println(analogRead(34));  // 12-bit: 0..4095\n}` },
  fire: { name: '14 · Game: fire alarm (bring the lighter!)', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: 'fl1', type: 'flame', x: 470, y: 70, props: { flame: 0 } },
      { id: 'bz1', type: 'buzzer', x: 520, y: 330, props: {} },
      { id: 'lt1', type: 'lighter', x: 820, y: 90, props: { mode: 'lit' } }],
    wires: [W('fl1:VCC', 'uno1:5V'), W('fl1:GND', 'uno1:GND.1'), W('fl1:DOUT', 'uno1:2'), W('bz1:1', 'uno1:8'), W('bz1:2', 'uno1:GND.2')],
    code: `// GAME: drag the lit lighter towards the flame sensor. When it "sees" the flame the alarm sounds.\n// Then move it away. How far away does the sensor still detect it?\nvoid setup() {\n  pinMode(2, INPUT);     // flame sensor DOUT (LOW = flame)\n  pinMode(8, OUTPUT);    // buzzer\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  bool fire = digitalRead(2) == LOW;\n  digitalWrite(8, fire);\n  Serial.println(fire ? "FIRE! FIRE!" : "safe");\n  delay(200);\n}` },
  gasleak: { name: '15 · Game: gas leak detector (gas can + fan)', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: 'mq1', type: 'gas', x: 470, y: 60, props: { ppm: 200, threshold: 40 } },
      { id: 'r1', type: 'resistor', x: 480, y: 380, props: { ohms: 220 } },
      { id: 'led1', type: 'led', x: 600, y: 330, props: { color: 'red' } },
      { id: 'gc1', type: 'gascan', x: 800, y: 60, props: { on: false } },
      { id: 'fan1', type: 'fan', x: 820, y: 330, props: { on: false } }],
    wires: [W('mq1:VCC', 'uno1:5V'), W('mq1:GND', 'uno1:GND.1'), W('mq1:AOUT', 'uno1:A0'), W('uno1:13', 'r1:1'), W('r1:2', 'led1:A'), W('led1:C', 'uno1:GND.2')],
    code: `// GAME: click the gas can, switch it to Spraying and drag it close to the MQ-2. The LED warns of a leak.\n// Then switch the fan ON and bring it close: the gas clears.\nconst int LIMIT = 400;\nvoid setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int gas = analogRead(A0);\n  digitalWrite(13, gas > LIMIT);\n  Serial.print("gas = "); Serial.println(gas);\n  delay(250);\n}` },
  c51: { name: '16 · 8051 (AT89S52) LED blink in Keil C', parts: [
      { id: 'bat1', type: 'battery', x: 40, y: 140, props: { volts: 4.5, rint: 0.3 } },
      { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
      { id: 'mcu1', type: 'at89s52', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F5' } },
      { id: 'led1', type: 'led', x: 320, y: 330, props: { color: 'red' } },
      { id: 'r1', type: 'resistor', x: 430, y: 380, props: { ohms: 330 } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP2', 'bb1:BP2'), W('bb1:TN3', 'bb1:BN3'), W('bb1:A5', 'bb1:TP5'), W('bb1:J24', 'bb1:BN24'),
      W('led1:A', 'bb1:BP8'), W('led1:C', 'r1:1'), W('r1:2', 'bb1:J5')],
    code: `// 8051 LED blink (Keil C51). The LED goes from + through the resistor INTO pin P1.0,\n// so writing 0 turns it ON (the 8051 sinks current well but sources very little).\n#include <reg51.h>\n\nsbit LED = P1^0;\n\nvoid delay_ms(unsigned int ms) {\n  unsigned int i, j;\n  for (i = 0; i < ms; i++)\n    for (j = 0; j < 1275; j++);   // about 1 ms at 11.0592 MHz\n}\n\nvoid main(void) {\n  while (1) {\n    LED = 0;  delay_ms(500);   // ON\n    LED = 1;  delay_ms(500);   // OFF\n  }\n}` },
  pic: { name: '17 · PIC16F877A LED blink in XC8', parts: [
      { id: 'bat1', type: 'battery', x: 40, y: 140, props: { volts: 4.5, rint: 0.3 } },
      { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
      { id: 'mcu1', type: 'pic16f877a', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F5' } },
      { id: 'r1', type: 'resistor', x: 330, y: 380, props: { ohms: 330 } },
      { id: 'led1', type: 'led', x: 520, y: 330, props: { color: 'green' } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP2', 'bb1:BP2'), W('bb1:TN3', 'bb1:BN3'), W('bb1:J15', 'bb1:BP15'), W('bb1:J16', 'bb1:BN16'),
      W('r1:1', 'bb1:A12'), W('r1:2', 'led1:A'), W('led1:C', 'bb1:BN22')],
    code: `// PIC16F877A blink (MPLAB XC8). RB0 is pin 33. TRISB = 0 makes PORTB outputs.\n#include <xc.h>\n#define _XTAL_FREQ 4000000\n\nvoid main(void) {\n  TRISB = 0x00;          // all PORTB pins are outputs\n  while (1) {\n    RB0 = 1;  __delay_ms(500);\n    RB0 = 0;  __delay_ms(500);\n  }\n}` },
};
