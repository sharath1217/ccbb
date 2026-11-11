// Microcontroller boards: power pins, I/O pins, ADC, PWM, I2C and how code pin numbers map to board pins.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const S = n => String(n);

export const BOARDS = {
  uno: { name: 'Arduino Uno R3', chip: 'ATmega328P', vcc: 5, adcBits: 10, adcRef: 5,
    power: { '5V': 5, '3.3V': 3.3 }, gnd: ['GND.1', 'GND.2', 'GND.3'], ties: [['A4', 'A4.2'], ['A5', 'A5.2']],
    io: [...range(0, 13).map(S), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'], analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    pwm: ['3', '5', '6', '9', '10', '11'], i2c: { SDA: 'A4', SCL: 'A5' }, builtin: '13', maxPin: 0.04,
    pin: v => typeof v === 'number' && v >= 14 && v <= 19 ? 'A' + (v - 14) : S(v), consts: {} },
  nano: { name: 'Arduino Nano', chip: 'ATmega328P', vcc: 5, adcBits: 10, adcRef: 5,
    power: { '5V': 5, '3.3V': 3.3 }, gnd: ['GND.1', 'GND.2', 'GND.3'], ties: [['12', '12.2'], ['13', '13.2'], ['11', '11.2'], ['5V', '5V.2']],
    io: [...range(0, 13).map(S), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], inputOnly: ['A6', 'A7'],
    pwm: ['3', '5', '6', '9', '10', '11'], i2c: { SDA: 'A4', SCL: 'A5' }, builtin: '13', maxPin: 0.04,
    pin: v => typeof v === 'number' && v >= 14 && v <= 21 ? 'A' + (v - 14) : S(v), consts: { A6: 'A6', A7: 'A7' } },
  mega: { name: 'Arduino Mega 2560', chip: 'ATmega2560', vcc: 5, adcBits: 10, adcRef: 5,
    power: { '5V': 5, '3.3V': 3.3 }, gnd: ['GND.1', 'GND.2', 'GND.3', 'GND.4', 'GND.5'], ties: [['5V', '5V.1'], ['5V', '5V.2'], ['20', 'SDA'], ['21', 'SCL']],
    io: [...range(0, 53).map(S), ...range(0, 15).map(i => 'A' + i)], analog: range(0, 15).map(i => 'A' + i),
    pwm: [...range(2, 13), 44, 45, 46].map(S), i2c: { SDA: '20', SCL: '21' }, builtin: '13', maxPin: 0.04,
    pin: v => typeof v === 'number' && v >= 54 && v <= 69 ? 'A' + (v - 54) : S(v),
    consts: Object.fromEntries(range(6, 15).map(i => ['A' + i, 'A' + i])) },
  esp32: { name: 'ESP32 DevKit V1', chip: 'ESP32-WROOM-32', vcc: 3.3, adcBits: 12, adcRef: 3.3,
    power: { '3V3': 3.3, 'VIN': 5 }, gnd: ['GND.1', 'GND.2'], ties: [],
    io: ['D2', 'D4', 'D5', 'D12', 'D13', 'D14', 'D15', 'D18', 'D19', 'D21', 'D22', 'D23', 'D25', 'D26', 'D27', 'D32', 'D33', 'D34', 'D35', 'VP', 'VN', 'TX0', 'RX0', 'TX2', 'RX2'],
    analog: ['VP', 'VN', 'D32', 'D33', 'D34', 'D35', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'D15', 'D2', 'D4'], inputOnly: ['D34', 'D35', 'VP', 'VN'],
    pwm: 'all', i2c: { SDA: 'D21', SCL: 'D22' }, builtin: 'D2', maxPin: 0.04,
    pin: v => ({ 1: 'TX0', 3: 'RX0', 16: 'RX2', 17: 'TX2', 36: 'VP', 39: 'VN' })[v] || 'D' + v,
    consts: { A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26, LED_BUILTIN: 2 } },
  esp8266: { name: 'ESP8266 NodeMCU', chip: 'ESP-12E', vcc: 3.3, adcBits: 10, adcRef: 3.3,
    power: { '3V3.1': 3.3, 'VIN': 5 }, gnd: ['GND.1', 'GND.2', 'GND.3', 'GND.4'], ties: [['3V3.1', '3V3.2'], ['3V3.1', '3V3.3']],
    io: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'A0'], analog: ['A0'], inputOnly: ['A0'],
    pwm: 'all', i2c: { SDA: 'D2', SCL: 'D1' }, builtin: 'D4', builtinActiveLow: true, maxPin: 0.012,
    pin: v => v === 'A0' ? 'A0' : ({ 16: 'D0', 5: 'D1', 4: 'D2', 0: 'D3', 2: 'D4', 14: 'D5', 12: 'D6', 13: 'D7', 15: 'D8', 3: 'RX', 1: 'TX' })[v] || S(v),
    consts: { D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, LED_BUILTIN: 2 } },
  pico: { name: 'Raspberry Pi Pico', chip: 'RP2040', vcc: 3.3, adcBits: 10, adcRef: 3.3,
    power: { '3V3': 3.3, 'VBUS': 5 }, gnd: ['GND.1', 'GND.2', 'GND.3', 'GND.4', 'GND.5', 'GND.6', 'GND.7', 'GND.8', 'AGND'], ties: [['VBUS', 'VSYS']],
    io: [...range(0, 22), 26, 27, 28].map(i => 'GP' + i).concat(['GP25']), analog: ['GP26', 'GP27', 'GP28'],
    pwm: 'all', i2c: { SDA: 'GP4', SCL: 'GP5' }, builtin: 'GP25', maxPin: 0.012,
    pin: v => 'GP' + v, consts: { A0: 26, A1: 27, A2: 28, LED_BUILTIN: 25 } },
  rp2040: { name: 'Arduino Nano RP2040 Connect', chip: 'RP2040', vcc: 3.3, adcBits: 10, adcRef: 3.3,
    power: { '3.3V': 3.3, '5V': 5 }, gnd: ['GND.1', 'GND.2'], ties: [],
    io: [...range(2, 13).map(i => 'D' + i), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'RX', 'TX'], analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
    pwm: 'all', i2c: { SDA: 'A4', SCL: 'A5' }, builtin: 'D13', maxPin: 0.012,
    pin: v => typeof v === 'number' ? 'D' + v : S(v), consts: { A6: 'A6', A7: 'A7', LED_BUILTIN: 13 } },
  bluepill: { name: 'STM32 Blue Pill', chip: 'STM32F103C8', vcc: 3.3, adcBits: 10, adcRef: 3.3,
    power: { '3V3.1': 3.3, '5V': 5 }, gnd: ['GND.1', 'GND.2', 'GND.3'], ties: [['3V3.1', '3V3.2']],
    io: [...range(0, 15).map(i => 'PA' + i).filter(p => !['PA13', 'PA14'].includes(p)), ...range(0, 15).map(i => 'PB' + i).filter(p => p !== 'PB2'), 'PC13', 'PC14', 'PC15'],
    analog: [...range(0, 7).map(i => 'PA' + i), 'PB0', 'PB1'], pwm: 'all', i2c: { SDA: 'PB7', SCL: 'PB6' }, builtin: 'PC13', builtinActiveLow: true, maxPin: 0.02,
    pin: v => S(v), consts: Object.fromEntries([...range(0, 15).map(i => 'PA' + i), ...range(0, 15).map(i => 'PB' + i), 'PC13', 'PC14', 'PC15'].map(p => [p, p]).concat([['LED_BUILTIN', 'PC13']])) },
};
export const MCU_TYPES = Object.keys(BOARDS);

// Pin lists for the board graphics (Wokwi elements or our own SVG boards)
export const BOARD_PINS = {
  uno: ['A5.2', 'A4.2', 'AREF', 'GND.1', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0', 'IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
  nano: ['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'GND.2', 'RESET.2', '0', '1', '13', '3.3V', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET', 'GND.1', 'VIN', '12.2', '5V.2', '13.2', '11.2', 'RESET.3', 'GND.3'],
  mega: ['SCL', 'SDA', 'AREF', 'GND.1', ...range(0, 13).reverse().map(S), ...range(14, 21).map(S), '5V.1', '5V.2', ...range(22, 53).map(S), 'GND.4', 'GND.5', 'IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN', ...range(0, 15).map(i => 'A' + i)],
  esp32: ['VIN', 'GND.2', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN', '3V3', 'GND.1', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'],
  rp2040: ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND.1', 'RESET', 'RX', 'TX', 'D13', '3.3V', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET.2', 'GND.2', 'VIN'],
  // our own SVG boards: [left column top→bottom], [right column top→bottom]
  pico: { left: ['GP0', 'GP1', 'GND.1', 'GP2', 'GP3', 'GP4', 'GP5', 'GND.2', 'GP6', 'GP7', 'GP8', 'GP9', 'GND.3', 'GP10', 'GP11', 'GP12', 'GP13', 'GND.4', 'GP14', 'GP15'],
          right: ['VBUS', 'VSYS', 'GND.5', '3V3_EN', '3V3', 'ADC_VREF', 'GP28', 'AGND', 'GP27', 'GP26', 'RUN', 'GP22', 'GND.6', 'GP21', 'GP20', 'GP19', 'GP18', 'GND.7', 'GP17', 'GP16'] },
  esp8266: { left: ['A0', 'RSV.1', 'RSV.2', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND.1', '3V3.2', 'EN', 'RST', 'GND.2', 'VIN'],
             right: ['D0', 'D1', 'D2', 'D3', 'D4', '3V3.1', 'GND.3', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GND.4', '3V3.3'] },
  bluepill: { left: ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', '5V', 'GND.1', '3V3.1'],
              right: ['VBAT', 'PC13', 'PC14', 'PC15', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB10', 'PB11', 'RST', '3V3.2', 'GND.2', 'GND.3'] },
};
export const boardPinList = t => Array.isArray(BOARD_PINS[t]) ? BOARD_PINS[t] : [...BOARD_PINS[t].left, ...BOARD_PINS[t].right];
