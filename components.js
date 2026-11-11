// Component library. Each entry:
// specs: data used by Compare + Finder (vMin/vMax supply volts, price ₹ range, range = measuring range)
// ctl:   [label, key, min, max, default, step?]  sliders that model the real world
// read(s): returns {v, pins, emoji, heat?, light?, notes?:[level,text]}
// mistakes: common student mistakes
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noise = s => (Math.random() - .5) * s;
const flameHeat = l => (l > 0 ? clamp(150 / l, 0, 120) : 0); // lighter: extra °C at distance l cm

const COMPONENTS = [
// ---------------- TEMPERATURE ----------------
{ id:"lm35", cat:"Temperature", name:"LM35", full:"LM35 Analog Temperature Sensor",
  specs:{measures:"Temperature", range:"-55 to 150 °C", accuracy:"±0.5 °C", iface:"Analog", vMin:4, vMax:30, price:[40,60]},
  ctl:[["Room temperature (°C)","t",-20,80,27],["Lighter distance (cm, 0 = off)","l",0,30,0]],
  read(s){ const t=clamp(s.t+flameHeat(s.l)+noise(.3),-55,150);
    return {v:t.toFixed(1)+" °C", pins:`OUT → A0 = ${(t*10).toFixed(0)} mV (ADC ${Math.round(t*10/4.883)})`, emoji:t>60?"🔥":t<10?"❄️":"🌡️", heat:t,
      notes:t>100?["bad","Above 100 °C the TO-92 plastic body can deform."]:null}; },
  mistakes:["Swapping VCC and GND pins: the sensor gets very hot and dies.","Powering from 3.3 V: needs at least 4 V (use TMP36 or DS18B20 on ESP32).","Forgetting it outputs mV, not °C: multiply by 100 after converting ADC to volts."],
  code:`void setup(){ Serial.begin(9600); }
void loop(){
  float t = analogRead(A0) * 5.0 / 1023.0 * 100.0;
  Serial.println(t);
  delay(500);
}`},
{ id:"dht11", cat:"Temperature", name:"DHT11", full:"DHT11 Temperature + Humidity",
  specs:{measures:"Temp + Humidity", range:"0 to 50 °C, 20–90 %RH", accuracy:"±2 °C, ±5 %RH", iface:"Digital 1-wire", vMin:3.3, vMax:5.5, price:[80,120]},
  ctl:[["Room temperature (°C)","t",-20,80,27],["Humidity (%)","h",0,100,55],["Lighter distance (cm, 0 = off)","l",0,30,0]],
  read(s){ const t=s.t+flameHeat(s.l), h=clamp(s.h-(s.l>0?60/s.l:0),0,100), err=t>50||t<0;
    return {v:err?"ERR / NaN":`${Math.round(t)} °C · ${Math.round(clamp(h,20,90))} %`, pins:"DATA → D2 (10 kΩ pull-up)", emoji:"💧", heat:t,
      notes:err?["bad","Outside 0–50 °C: DHT11 gives wrong data. Use DHT22 or DS18B20."]:["ok","Only 1 °C resolution. Read no faster than once per second."]}; },
  mistakes:["Reading faster than 1 Hz: returns NaN.","Missing pull-up resistor on bare sensor (modules already have one).","Expecting decimals: DHT11 is integer only."],
  code:`#include <DHT.h>
DHT dht(2, DHT11);
void setup(){ Serial.begin(9600); dht.begin(); }
void loop(){
  Serial.print(dht.readTemperature()); Serial.print(" C  ");
  Serial.println(dht.readHumidity());
  delay(2000);
}`},
{ id:"dht22", cat:"Temperature", name:"DHT22", full:"DHT22 / AM2302 Temperature + Humidity",
  specs:{measures:"Temp + Humidity", range:"-40 to 80 °C, 0–100 %RH", accuracy:"±0.5 °C, ±2 %RH", iface:"Digital 1-wire", vMin:3.3, vMax:6, price:[250,350]},
  ctl:[["Room temperature (°C)","t",-50,100,27],["Humidity (%)","h",0,100,55],["Lighter distance (cm, 0 = off)","l",0,30,0]],
  read(s){ const t=s.t+flameHeat(s.l)+noise(.1), h=clamp(s.h-(s.l>0?60/s.l:0),0,100), err=t>80||t<-40;
    return {v:err?"ERR / NaN":`${t.toFixed(1)} °C · ${h.toFixed(1)} %`, pins:"DATA → D2 (10 kΩ pull-up)", emoji:"💧", heat:t,
      notes:err?["bad","Outside -40–80 °C range."]:null}; },
  mistakes:["Reading faster than every 2 s.","Using DHT11 library setting by mistake: values look wrong."],
  code:`#include <DHT.h>
DHT dht(2, DHT22);
void setup(){ Serial.begin(9600); dht.begin(); }
void loop(){ Serial.println(dht.readTemperature()); delay(2000); }`},
{ id:"ds18b20", cat:"Temperature", name:"DS18B20", full:"DS18B20 Waterproof Temperature Probe",
  specs:{measures:"Temperature", range:"-55 to 125 °C", accuracy:"±0.5 °C", iface:"1-Wire digital", vMin:3,vMax:5.5, price:[90,150]},
  ctl:[["Liquid / air temperature (°C)","t",-40,140,25],["Lighter distance (cm, 0 = off)","l",0,30,0]],
  read(s){ const raw=s.t+flameHeat(s.l)+noise(.1), t=clamp(raw,-55,125);
    return {v:raw>125?"85.00 °C (error)":t.toFixed(2)+" °C", pins:"DQ → D2 (4.7 kΩ pull-up to VCC)", emoji:"🌡️", heat:t,
      notes:raw>125?["bad","Over 125 °C. A reading of exactly 85 °C usually means a read error."]:["ok","Many sensors can share one pin, each has a unique address."]}; },
  mistakes:["Forgetting the 4.7 kΩ pull-up: reads -127 °C.","Seeing 85 °C: that is the power-on default, not a real reading."],
  code:`#include <OneWire.h>
#include <DallasTemperature.h>
OneWire ow(2); DallasTemperature s(&ow);
void setup(){ Serial.begin(9600); s.begin(); }
void loop(){ s.requestTemperatures(); Serial.println(s.getTempCByIndex(0)); delay(1000); }`},
{ id:"bmp280", cat:"Temperature", name:"BMP280", full:"BMP280 Pressure + Temperature (Altitude)",
  specs:{measures:"Pressure + Temp", range:"300–1100 hPa, -40 to 85 °C", accuracy:"±1 hPa, ±1 °C", iface:"I2C / SPI", vMin:1.8, vMax:3.6, price:[90,150]},
  ctl:[["Altitude (m)","a",-100,5000,900],["Room temperature (°C)","t",-30,80,27]],
  read(s){ const p=1013.25*Math.pow(1-s.a/44330,5.255)+noise(.2);
    return {v:`${p.toFixed(1)} hPa`, pins:`SDA → A4, SCL → A5 · ${s.t.toFixed(1)} °C · alt ${s.a} m`, emoji:"⛰️",
      notes:["warn","Bare BMP280 chip is 3.3 V only. Most purple modules have a regulator; check yours."]}; },
  mistakes:["Wrong I2C address: try 0x76 and 0x77.","Buying BMP280 expecting humidity: that's BME280."],
  code:`#include <Adafruit_BMP280.h>
Adafruit_BMP280 bmp;
void setup(){ Serial.begin(9600); bmp.begin(0x76); }
void loop(){ Serial.println(bmp.readPressure()/100.0); delay(1000); }`},

// ---------------- LIGHT & FIRE ----------------
{ id:"ldr", cat:"Light & Fire", name:"LDR", full:"LDR Light Dependent Resistor (with 10 kΩ divider)",
  specs:{measures:"Light (relative)", range:"Dark to bright", accuracy:"Low (not calibrated)", iface:"Analog", vMin:3.3, vMax:5, price:[5,10]},
  ctl:[["Ambient light (lux)","x",0,2000,300],["Torch / flashlight (0 = off, 1 = on)","f",0,1,0]],
  read(s){ const lux=s.x+s.f*5000, r=500000/Math.pow(lux+1,.7), adc=Math.round(1023*10000/(10000+r));
    return {v:"ADC "+adc, pins:`LDR ≈ ${(r/1000).toFixed(1)} kΩ → A0`, emoji:lux>1000?"☀️":lux<20?"🌑":"💡", light:lux}; },
  mistakes:["Connecting LDR alone without a fixed resistor: you get no useful voltage change.","Expecting lux values: use BH1750 if you need real lux."],
  code:`void loop(){
  int v = analogRead(A0);
  digitalWrite(13, v < 200);   // dark → turn light on
  Serial.println(v); delay(200);
}`},
{ id:"bh1750", cat:"Light & Fire", name:"BH1750", full:"BH1750 Digital Light Sensor (lux)",
  specs:{measures:"Light (lux)", range:"1–65535 lux", accuracy:"±20 %", iface:"I2C", vMin:3, vMax:5, price:[100,150]},
  ctl:[["Ambient light (lux)","x",0,2000,300],["Torch / flashlight (0 = off, 1 = on)","f",0,1,0]],
  read(s){ const lux=clamp(s.x+s.f*5000+noise(3),0,65535);
    return {v:Math.round(lux)+" lx", pins:"SDA → A4, SCL → A5 (addr 0x23)", emoji:lux>1000?"☀️":"💡", light:lux}; },
  mistakes:["Address conflict: ADDR pin high changes address to 0x5C."],
  code:`#include <BH1750.h>
BH1750 m;
void setup(){ Serial.begin(9600); Wire.begin(); m.begin(); }
void loop(){ Serial.println(m.readLightLevel()); delay(500); }`},
{ id:"flame", cat:"Light & Fire", name:"Flame Sensor", full:"IR Flame Sensor Module",
  specs:{measures:"Flame (IR)", range:"up to ~80 cm, 60° angle", accuracy:"Detect only", iface:"Digital + Analog", vMin:3.3, vMax:5, price:[40,60]},
  ctl:[["Lighter distance (cm, 0 = off)","l",0,150,0],["Sunlight (0–100)","sun",0,100,0]],
  read(s){ const ir=(s.l>0?clamp(8000/(s.l*s.l),0,1000):0)+s.sun*4, ao=Math.round(clamp(1023-ir,0,1023)), d=ao<500;
    return {v:d?"FLAME DETECTED":"No flame", pins:`AO → A0 = ${ao} · DO → D3 = ${d?"LOW":"HIGH"}`, emoji:d?"🔥":"🕯️", heat:d?120:20,
      notes:s.sun>60?["warn","Sunlight has IR and causes false triggers. Test indoors."]:null}; },
  mistakes:["Using it as a fire alarm outdoors: sunlight triggers it.","DO is active LOW: LOW means flame."],
  code:`void loop(){
  if (digitalRead(3) == LOW) Serial.println("FIRE!");
  delay(100);
}`},

// ---------------- DISTANCE & MOTION ----------------
{ id:"hcsr04", cat:"Distance & Motion", name:"HC-SR04", full:"HC-SR04 Ultrasonic Distance Sensor",
  specs:{measures:"Distance", range:"2–400 cm", accuracy:"±3 mm", iface:"Digital (Trig/Echo)", vMin:5, vMax:5, price:[60,90]},
  ctl:[["Object distance (cm)","d",0,500,50],["Object is soft cloth (0/1)","soft",0,1,0]],
  read(s){ const ok=s.d>=2&&s.d<=400&&!(s.soft&&s.d>100), d=s.d+noise(.6);
    return {v:ok?d.toFixed(1)+" cm":"0 / timeout", pins:`TRIG → D9, ECHO → D10 (echo ${ok?Math.round(d*58):"none"} µs)`, emoji:"📏",
      notes:ok?null:["warn", s.soft?"Soft materials absorb sound: no echo beyond ~1 m.":"Below 2 cm or above 4 m is unreliable."]}; },
  mistakes:["Using with ESP32 directly: ECHO outputs 5 V, use a divider or HC-SR04P (3.3 V version).","Two sensors firing together interfere."],
  code:`void setup(){ Serial.begin(9600); pinMode(9,OUTPUT); pinMode(10,INPUT); }
void loop(){
  digitalWrite(9,HIGH); delayMicroseconds(10); digitalWrite(9,LOW);
  long t = pulseIn(10, HIGH);
  Serial.println(t * 0.034 / 2);
  delay(100);
}`},
{ id:"vl53l0x", cat:"Distance & Motion", name:"VL53L0X", full:"VL53L0X Laser Time-of-Flight Distance",
  specs:{measures:"Distance", range:"3–200 cm", accuracy:"±3 %", iface:"I2C", vMin:2.6, vMax:5.5, price:[250,400]},
  ctl:[["Object distance (cm)","d",0,300,50],["Sunlight (0–100)","sun",0,100,0]],
  read(s){ const max=200-s.sun, ok=s.d>=3&&s.d<=max;
    return {v:ok?Math.round(s.d*10+noise(6))+" mm":"8190 (out of range)", pins:"SDA → A4, SCL → A5 (addr 0x29)", emoji:"🔦",
      notes:s.sun>50?["warn","Bright sunlight reduces range a lot."]:["ok","Tiny and precise, works on soft objects too."]}; },
  mistakes:["Leaving the protective film on the sensor.","Two sensors on one bus need XSHUT to change address."],
  code:`#include <VL53L0X.h>
VL53L0X s;
void setup(){ Serial.begin(9600); Wire.begin(); s.init(); }
void loop(){ Serial.println(s.readRangeSingleMillimeters()); }`},
{ id:"pir", cat:"Distance & Motion", name:"PIR HC-SR501", full:"HC-SR501 PIR Motion Sensor",
  specs:{measures:"Human motion", range:"up to 7 m, 120°", accuracy:"Detect only", iface:"Digital", vMin:4.5, vMax:20, price:[60,90]},
  ctl:[["Person distance (m)","d",0,10,5],["Person moving (0/1)","m",0,1,0],["Seconds since power on","w",0,120,120]],
  read(s){ const warm=s.w>=60, t=warm&&s.m&&s.d<=7;
    return {v:!warm?"Warming up…":t?"MOTION":"Idle", pins:`OUT → D2 = ${t?"HIGH":"LOW"}`, emoji:t?"🚶":"🧍",
      notes:!warm?["warn","Needs ~60 s after power-on before it's reliable."]:["ok","Detects body heat moving. A still person is invisible."]}; },
  mistakes:["Testing immediately after power-on.","Not adjusting the delay pot: output stays HIGH for minutes.","Behind glass: glass blocks IR."],
  code:`void loop(){ if (digitalRead(2)) Serial.println("Motion!"); delay(200); }`},
{ id:"irobs", cat:"Distance & Motion", name:"IR Obstacle", full:"IR Obstacle Avoidance Sensor (FC-51)",
  specs:{measures:"Obstacle presence", range:"2–30 cm", accuracy:"Detect only", iface:"Digital", vMin:3.3, vMax:5, price:[25,40]},
  ctl:[["Object distance (cm)","d",0,60,20],["Threshold pot (cm)","p",2,30,10],["Object is black (0/1)","blk",0,1,0]],
  read(s){ const eff=s.blk?s.p*.3:s.p, t=s.d<=eff;
    return {v:t?"OBSTACLE":"Clear", pins:`OUT → D4 = ${t?"LOW":"HIGH"}`, emoji:t?"🧱":"↔️",
      notes:s.blk?["warn","Black surfaces absorb IR: much shorter detection."]:null}; },
  mistakes:["Expecting distance values: it's only yes/no.","Black objects aren't detected well."],
  code:`void loop(){ if (digitalRead(4) == LOW) Serial.println("Obstacle"); }`},
{ id:"mpu6050", cat:"Distance & Motion", name:"MPU6050", full:"MPU6050 Accelerometer + Gyroscope",
  specs:{measures:"Tilt / acceleration / rotation", range:"±2–16 g, ±250–2000 °/s", accuracy:"16-bit", iface:"I2C", vMin:3.3, vMax:5, price:[120,180]},
  ctl:[["Tilt X (°)","x",-90,90,0],["Tilt Y (°)","y",-90,90,0],["Shake (0–10)","sh",0,10,0]],
  read(s){ const r=Math.PI/180, sh=s.sh*.3;
    const ax=Math.sin(s.x*r)+noise(sh), ay=Math.sin(s.y*r)+noise(sh), az=Math.cos(s.x*r)*Math.cos(s.y*r)+noise(sh);
    return {v:`X ${ax.toFixed(2)}g Y ${ay.toFixed(2)}g Z ${az.toFixed(2)}g`, pins:"SDA → A4, SCL → A5 (addr 0x68)", emoji:"📐",
      notes:["ok","Gyro drifts over time. Combine with accel (complementary filter) for stable angles."]}; },
  mistakes:["Expecting yaw/heading: needs a magnetometer (MPU9250 / QMC5883L).","Not calibrating offsets at startup."],
  code:`#include <MPU6050.h>
MPU6050 m;
void setup(){ Serial.begin(9600); Wire.begin(); m.initialize(); }
void loop(){ int16_t ax,ay,az; m.getAcceleration(&ax,&ay,&az);
  Serial.println(ax/16384.0); delay(100); }`},

// ---------------- GAS & ENVIRONMENT ----------------
{ id:"mq2", cat:"Gas & Environment", name:"MQ-2", full:"MQ-2 Gas / Smoke Sensor (LPG, butane)",
  specs:{measures:"LPG, smoke, H₂", range:"300–10000 ppm", accuracy:"Low (needs calibration)", iface:"Analog + Digital", vMin:5, vMax:5, price:[100,150]},
  ctl:[["Lighter gas, unlit (0–10)","g",0,10,0],["Smoke (0–10)","sm",0,10,0],["Warm-up minutes","w",0,5,5]],
  read(s){ const warm=s.w>=1, ppm=200+s.g*900+s.sm*500+noise(20), ao=Math.round(clamp((warm?ppm:3000)/10,0,1023)), a=ao>400;
    return {v:warm?Math.round(ppm)+" ppm (approx)":"Heater warming…", pins:`AO → A0 = ${ao} · DO → D2 = ${a?"LOW":"HIGH"}`, emoji:a?"⚠️":"🌫️",
      notes:!warm?["warn","Cold sensor gives high false readings for the first minute."]:["warn","Heater draws ~150 mA: power from 5 V pin, not a GPIO."]}; },
  mistakes:["Reading values before warm-up.","Treating output as exact ppm without calibration.","Powering 3+ MQ sensors from USB: not enough current."],
  code:`void loop(){
  int v = analogRead(A0);
  if (v > 400) tone(8, 1000); else noTone(8);
  Serial.println(v); delay(300);
}`},
{ id:"mq135", cat:"Gas & Environment", name:"MQ-135", full:"MQ-135 Air Quality Sensor (CO₂, NH₃, benzene)",
  specs:{measures:"Air quality", range:"10–1000 ppm", accuracy:"Low (relative only)", iface:"Analog + Digital", vMin:5, vMax:5, price:[120,180]},
  ctl:[["People in room","p",0,30,2],["Window open (0/1)","o",0,1,1],["Ammonia / alcohol nearby (0–10)","a",0,10,0]],
  read(s){ const ppm=400+s.p*(s.o?15:60)+s.a*120+noise(10);
    return {v:Math.round(ppm)+" ppm CO₂-eq", pins:`AO → A0 = ${Math.round(clamp(ppm/3,0,1023))}`, emoji:ppm>1000?"😷":"🍃",
      notes:["warn","Not a true CO₂ sensor. For real CO₂ use MH-Z19 or SCD40."]}; },
  mistakes:["Claiming accurate CO₂ in a project report.","No 24 h burn-in before first use."],
  code:`void loop(){ Serial.println(analogRead(A0)); delay(1000); }`},
{ id:"soil", cat:"Gas & Environment", name:"Soil Moisture", full:"Soil Moisture Sensor (resistive / capacitive)",
  specs:{measures:"Soil moisture", range:"0–100 % (relative)", accuracy:"Low", iface:"Analog", vMin:3.3, vMax:5, price:[30,120]},
  ctl:[["Soil moisture (%)","m",0,100,40],["Days powered continuously","d",0,60,0]],
  read(s){ const drift=s.d*4, ao=Math.round(clamp(1023-s.m*7+drift,0,1023));
    return {v:s.m+" %", pins:`AO → A0 = ${ao}`, emoji:s.m<25?"🥀":"🌱",
      notes:s.d>14?["bad","Resistive probe corroding: readings drifting. Use capacitive v1.2 or power only when reading."]:null}; },
  mistakes:["Leaving resistive probe powered 24/7: it corrodes in weeks.","Not calibrating dry vs wet values for your soil."],
  code:`void loop(){
  int m = map(analogRead(A0), 1023, 323, 0, 100);
  Serial.println(m); delay(1000);
}`},
{ id:"rain", cat:"Gas & Environment", name:"Rain Sensor", full:"Rain Drop Sensor (FC-37 / YL-83)",
  specs:{measures:"Rain / water drops", range:"Dry to wet", accuracy:"Detect only", iface:"Analog + Digital", vMin:3.3, vMax:5, price:[40,60]},
  ctl:[["Rain intensity (0–10)","r",0,10,0]],
  read(s){ const ao=Math.round(1023-s.r*90), w=s.r>2;
    return {v:s.r===0?"Dry":s.r<5?"Light rain":"Heavy rain", pins:`AO → A0 = ${ao} · DO → D2 = ${w?"LOW":"HIGH"}`, emoji:s.r?"🌧️":"☀️"}; },
  mistakes:["Putting the control board outside too: only the plate goes in the rain."],
  code:`void loop(){ if (digitalRead(2)==LOW) Serial.println("Raining"); }`},
{ id:"sound", cat:"Gas & Environment", name:"Sound KY-038", full:"KY-038 Sound / Clap Sensor",
  specs:{measures:"Sound level (relative)", range:"Loud sounds only", accuracy:"Very low", iface:"Analog + Digital", vMin:3.3, vMax:5, price:[30,50]},
  ctl:[["Sound level (dB)","db",30,110,45],["Threshold pot (dB)","th",40,100,70]],
  read(s){ const t=s.db>=s.th;
    return {v:t?"CLAP / LOUD":"Quiet", pins:`AO → A0 = ${Math.round(500+noise(s.db/4))} · DO → D2 = ${t?"HIGH":"LOW"}`, emoji:t?"👏":"🔇",
      notes:["warn","Can't record voice or measure dB accurately. For audio use INMP441 / MAX9814."]}; },
  mistakes:["Expecting speech recognition from this module.","Reading AO with slow delay(): misses short claps."],
  code:`void loop(){ if (digitalRead(2)) Serial.println("Clap!"); }`},

// ---------------- INPUT & ID ----------------
{ id:"pot", cat:"Inputs", name:"Potentiometer", full:"10 kΩ Potentiometer",
  specs:{measures:"Knob position", range:"0–100 %", accuracy:"Analog", iface:"Analog", vMin:0, vMax:30, price:[10,20]},
  ctl:[["Knob position (%)","k",0,100,50]],
  read(s){ return {v:"ADC "+Math.round(s.k*10.23), pins:"Ends → 5V & GND, wiper → A0", emoji:"🎛️"}; },
  mistakes:["Wiring the wiper to 5 V: turning it to the end shorts the supply."],
  code:`void loop(){ Serial.println(analogRead(A0)); delay(100); }`},
{ id:"btn", cat:"Inputs", name:"Push Button", full:"Tactile Push Button",
  specs:{measures:"Press", range:"On/Off", accuracy:"-", iface:"Digital", vMin:0, vMax:12, price:[2,5]},
  ctl:[["Pressed (0/1)","p",0,1,0],["Using INPUT_PULLUP (0/1)","pu",0,1,1]],
  read(s){ const fl=!s.pu&&!s.p;
    return {v:s.p?"PRESSED":fl?"Random (floating!)":"Released", pins:`D2 = ${s.p?"LOW":fl?(Math.random()>.5?"HIGH":"LOW"):"HIGH"}`, emoji:s.p?"🔘":"⚪",
      notes:fl?["bad","Floating input! Use INPUT_PULLUP or a 10 kΩ resistor."]:["ok","Add debounce (~20 ms) to avoid multiple counts."]}; },
  mistakes:["No pull-up/pull-down: random readings.","No debounce: one press counts as many."],
  code:`void setup(){ pinMode(2, INPUT_PULLUP); Serial.begin(9600); }
void loop(){ if (!digitalRead(2)) { Serial.println("Pressed"); delay(200); } }`},
{ id:"joystick", cat:"Inputs", name:"Joystick", full:"Dual-axis Joystick Module (KY-023)",
  specs:{measures:"X/Y position + click", range:"0–1023 each axis", accuracy:"Analog", iface:"2× Analog + Digital", vMin:3.3, vMax:5, price:[50,80]},
  ctl:[["X (-100 to 100)","x",-100,100,0],["Y (-100 to 100)","y",-100,100,0],["Pressed (0/1)","b",0,1,0]],
  read(s){ const X=Math.round(512+s.x*5.11), Y=Math.round(512+s.y*5.11);
    return {v:`X ${X} · Y ${Y}`+(s.b?" · CLICK":""), pins:"VRx → A0, VRy → A1, SW → D2", emoji:"🕹️",
      notes:["ok","Centre is rarely exactly 512: add a dead-zone of ±20."]}; },
  mistakes:["No dead-zone: robot creeps when joystick is released.","SW needs INPUT_PULLUP."],
  code:`void loop(){ Serial.print(analogRead(A0)); Serial.print(","); Serial.println(analogRead(A1)); }`},
{ id:"rc522", cat:"Inputs", name:"RFID RC522", full:"RC522 RFID Reader 13.56 MHz",
  specs:{measures:"RFID card UID", range:"0–5 cm", accuracy:"-", iface:"SPI", vMin:3.3, vMax:3.3, price:[120,180]},
  ctl:[["Card distance (cm)","d",0,10,8],["Card type (0 = MIFARE, 1 = 125kHz EM)","t",0,1,0]],
  read(s){ const ok=s.d<=5&&s.t===0;
    return {v:ok?"UID: DE AD BE EF":"No card", pins:"SDA→D10 SCK→D13 MOSI→D11 MISO→D12 RST→D9 · 3.3V!", emoji:ok?"💳":"📡",
      notes:s.t?["bad","125 kHz EM cards don't work with RC522 (13.56 MHz). Use RDM6300."]:["warn","Power with 3.3 V only. 5 V can damage it."]}; },
  mistakes:["Powering from 5 V.","Buying 125 kHz cards for a 13.56 MHz reader.","Wrong SPI pins on Mega (50–53)."],
  code:`#include <MFRC522.h>
MFRC522 r(10, 9);
void setup(){ Serial.begin(9600); SPI.begin(); r.PCD_Init(); }
void loop(){ if (r.PICC_IsNewCardPresent() && r.PICC_ReadCardSerial())
  for (byte i=0;i<r.uid.size;i++) Serial.print(r.uid.uidByte[i], HEX); }`},
{ id:"irrx", cat:"Inputs", name:"IR Receiver", full:"TSOP1838 IR Remote Receiver",
  specs:{measures:"TV remote codes", range:"up to 8 m", accuracy:"-", iface:"Digital", vMin:2.7, vMax:5.5, price:[15,30]},
  ctl:[["Remote button (0 = none, 1–9)","b",0,9,0],["Remote distance (m)","d",0,15,2]],
  read(s){ const ok=s.b>0&&s.d<=8;
    return {v:ok?"0xFF"+(0x30CF+s.b*0x1010).toString(16).toUpperCase():"-", pins:"OUT → D11", emoji:"📺",
      notes:s.d>8?["warn","Too far, signal lost."]:null}; },
  mistakes:["Mixing IRremote library v2 and v4 examples: code doesn't compile."],
  code:`#include <IRremote.hpp>
void setup(){ Serial.begin(9600); IrReceiver.begin(11); }
void loop(){ if (IrReceiver.decode()){ Serial.println(IrReceiver.decodedIRData.command); IrReceiver.resume(); } }`},

// ---------------- OUTPUTS ----------------
{ id:"led", cat:"Outputs", name:"LED", full:"5 mm LED + Resistor",
  specs:{measures:"Output: light", range:"~2 V, 20 mA", accuracy:"-", iface:"Digital / PWM", vMin:1.8, vMax:3.3, price:[1,3]},
  ctl:[["Resistor (Ω)","r",0,1000,220],["PWM brightness (0–255)","b",0,255,255]],
  read(s){ const i=s.r>0?(5-2)/s.r*1000:999, st=i>30?"bad":i>20?"warn":"ok";
    return {v:i>30?"BURNT OUT":(Math.min(i,20)*s.b/255).toFixed(1)+" mA", pins:"D9 → resistor → LED(+) … LED(−) → GND", emoji:i>30?"💥":"💡", light:i>30?0:s.b*i*3,
      notes:[st,i>30?"Too much current! Use 150–330 Ω on 5 V.":i>20?"Above 20 mA: LED will dim and die early.":"Safe current."]}; },
  mistakes:["No resistor.","LED backwards: long leg is +."],
  code:`void setup(){ pinMode(9, OUTPUT); }
void loop(){ for(int b=0;b<256;b++){ analogWrite(9,b); delay(5); } }`},
{ id:"rgb", cat:"Outputs", name:"RGB LED", full:"RGB LED (common cathode)",
  specs:{measures:"Output: colour light", range:"3 channels", accuracy:"-", iface:"3× PWM", vMin:2, vMax:3.3, price:[5,10]},
  ctl:[["Red (0–255)","r",0,255,255],["Green (0–255)","g",0,255,0],["Blue (0–255)","b",0,255,128]],
  read(s){ return {v:`rgb(${s.r}, ${s.g}, ${s.b})`, pins:"R→D9 G→D10 B→D11 (each with 220 Ω), common → GND", emoji:"🌈", color:`rgb(${s.r},${s.g},${s.b})`}; },
  mistakes:["Common anode vs cathode mix-up: colours invert (use 255 − value).","One resistor shared by all three: colours look wrong."],
  code:`void setColor(int r,int g,int b){ analogWrite(9,r); analogWrite(10,g); analogWrite(11,b); }`},
{ id:"buzzer", cat:"Outputs", name:"Buzzer", full:"Active / Passive Buzzer",
  specs:{measures:"Output: sound", range:"2–5 kHz", accuracy:"-", iface:"Digital / tone()", vMin:3.3, vMax:5, price:[10,20]},
  ctl:[["Type (0 = active, 1 = passive)","t",0,1,0],["Signal on (0/1)","on",0,1,0],["tone() freq (Hz)","f",100,5000,1000,50]],
  read(s){ const silent=s.t===1&&s.on&&false;
    return {v:!s.on?"Silent":s.t?`Tone ${s.f} Hz`:"BEEP (fixed ~2.3 kHz)", pins:"+ → D8, − → GND", emoji:s.on?"🔊":"🔈",
      notes:s.t?["ok","Passive: needs tone(); digitalWrite HIGH gives only a click."]:["ok","Active: just digitalWrite HIGH. Can't change pitch."]}; },
  mistakes:["Buying active buzzer for melodies (can't change pitch).","Using digitalWrite on passive buzzer: no sound."],
  code:`void loop(){ tone(8, 1000, 200); delay(500); }`},
{ id:"servo", cat:"Outputs", name:"SG90 Servo", full:"SG90 Micro Servo 9 g",
  specs:{measures:"Output: angle", range:"0–180°, 1.8 kg·cm", accuracy:"~1°", iface:"PWM 50 Hz", vMin:4.8, vMax:6, price:[90,130]},
  ctl:[["Angle command (°)","a",0,180,90],["Load (kg·cm)","ld",0,4,0,.1],["Powered from (0 = Arduino 5V, 1 = external)","ext",0,1,1]],
  read(s){ const stall=s.ld>1.8, brown=!s.ext&&s.ld>1;
    return {v:stall?"STALL / buzzing":s.a+"°", pins:"Orange → D9, Red → 5V, Brown → GND", emoji:"⚙️",
      notes:stall?["bad","Over 1.8 kg·cm: use MG996R (10 kg·cm)."]:brown?["warn","Heavy load on Arduino 5V: board may reset. Use external 5 V supply (share GND)."]:null}; },
  mistakes:["Powering multiple servos from Arduino 5 V.","Forgetting common GND with external supply."],
  code:`#include <Servo.h>
Servo s;
void setup(){ s.attach(9); }
void loop(){ s.write(0); delay(1000); s.write(180); delay(1000); }`},
{ id:"relay", cat:"Outputs", name:"Relay Module", full:"5 V 1-Channel Relay Module (10 A)",
  specs:{measures:"Output: switch AC/DC load", range:"10 A @ 250 VAC", accuracy:"-", iface:"Digital", vMin:5, vMax:5, price:[50,80]},
  ctl:[["IN signal (0/1)","in",0,1,0],["Load current (A)","a",0,15,1,.5]],
  read(s){ const on=s.in===0; // most modules active LOW
    return {v:on?"CLICK · Load ON":"Load OFF", pins:`IN → D7 = ${s.in?"HIGH":"LOW"} (active LOW)`, emoji:on?"🔌":"⭕",
      notes:s.a>10?["bad","Over 10 A: contacts will weld or burn."]:["warn","Mains AC is dangerous. Test with a 12 V DC lamp first."]}; },
  mistakes:["Not knowing most modules are active LOW: relay turns on at boot.","Using the 5 V module with 3.3 V ESP32 signal without checking."],
  code:`void setup(){ pinMode(7, OUTPUT); digitalWrite(7, HIGH); } // OFF
void loop(){ digitalWrite(7, LOW); delay(2000); digitalWrite(7, HIGH); delay(2000); }`},
{ id:"l298n", cat:"Outputs", name:"L298N + DC Motor", full:"L298N Motor Driver + BO DC Motor",
  specs:{measures:"Output: 2 DC motors", range:"5–35 V, 2 A/ch", accuracy:"-", iface:"PWM + 2 Digital", vMin:5, vMax:35, price:[120,180]},
  ctl:[["Speed ENA PWM (0–255)","sp",0,255,180],["Direction (0 = fwd, 1 = rev)","dir",0,1,0],["Battery voltage (V)","bat",3,14,9,.5]],
  read(s){ const eff=Math.max(0,s.bat-2), rpm=Math.round(eff/6*150*s.sp/255);
    return {v:rpm?`${s.dir?"◀":"▶"} ${rpm} RPM`:"Stopped", pins:"ENA → D5 (PWM), IN1 → D6, IN2 → D7", emoji:"🚗",
      notes:s.bat<6?["warn","L298N drops ~2 V. Below 6 V the motor barely runs."]:s.sp<70?["warn","Low PWM may not overcome friction."]:null}; },
  mistakes:["Powering motors from Arduino 5V.","Forgetting common GND.","Leaving ENA jumper on while using PWM."],
  code:`void setup(){ pinMode(6,OUTPUT); pinMode(7,OUTPUT); }
void loop(){ digitalWrite(6,HIGH); digitalWrite(7,LOW); analogWrite(5,180); }`},

// ---------------- DISPLAYS ----------------
{ id:"lcd1602", cat:"Displays", name:"16×2 LCD (I2C)", full:"LCD 1602 with I2C Backpack",
  specs:{measures:"Output: 2 lines × 16 chars", range:"-", accuracy:"-", iface:"I2C", vMin:5, vMax:5, price:[150,220]},
  ctl:[["Contrast pot (0–100)","c",0,100,50],["I2C address (0 = 0x27, 1 = 0x3F)","addr",0,1,0],["Your module address (0 = 0x27, 1 = 0x3F)","real",0,1,0]],
  read(s){ const ok=s.addr===s.real&&s.c>20&&s.c<85;
    return {v:ok?"Hello, World!":s.addr!==s.real?"(blank)":s.c<=20?"(blank)":"████████████████", pins:"SDA → A4, SCL → A5", emoji:"📟",
      notes:s.addr!==s.real?["bad","Wrong I2C address. Run an I2C scanner sketch."]:s.c>=85?["warn","Contrast too high: only boxes visible. Turn the blue pot."]:s.c<=20?["warn","Contrast too low: turn the blue pot."]:null}; },
  mistakes:["Blank screen = contrast pot (very common!).","Address 0x27 vs 0x3F."],
  code:`#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup(){ lcd.init(); lcd.backlight(); lcd.print("Hello, World!"); }
void loop(){}`},
{ id:"oled", cat:"Displays", name:"OLED 0.96\"", full:"SSD1306 0.96\" OLED 128×64 (I2C)",
  specs:{measures:"Output: graphics 128×64", range:"-", accuracy:"-", iface:"I2C", vMin:3.3, vMax:5, price:[180,250]},
  ctl:[["Font size (1–4)","f",1,4,2],["Board RAM (0 = Uno 2 KB, 1 = ESP32)","ram",0,1,0],["Extra RAM used by your code (bytes)","used",0,1500,600,50]],
  read(s){ const free=s.ram?300000:2048-1024-s.used, ok=free>200;
    return {v:ok?"Display OK":"Crash / blank", pins:"SDA → A4, SCL → A5 (addr 0x3C)", emoji:"🖥️",
      notes:ok?["ok",`Free RAM ≈ ${s.ram?"plenty":free+" bytes"}`]:["bad","Uno out of RAM: SSD1306 buffer uses 1 KB. Use U8x8 text mode or ESP32."]}; },
  mistakes:["Uno running out of RAM with Adafruit library.","Address 0x3C vs 0x3D."],
  code:`#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 d(128, 64, &Wire);
void setup(){ d.begin(SSD1306_SWITCHCAPVCC, 0x3C); d.clearDisplay();
  d.setTextSize(2); d.setTextColor(WHITE); d.print("Hi!"); d.display(); }
void loop(){}`},
{ id:"seg7", cat:"Displays", name:"7-Segment (TM1637)", full:"TM1637 4-Digit 7-Segment Display",
  specs:{measures:"Output: 4 digits", range:"0000–9999", accuracy:"-", iface:"2-wire (CLK/DIO)", vMin:3.3, vMax:5, price:[70,100]},
  ctl:[["Number to show","n",0,9999,1234],["Brightness (0–7)","b",0,7,5]],
  read(s){ return {v:String(s.n).padStart(4," "), pins:"CLK → D2, DIO → D3", emoji:"🔢"}; },
  mistakes:["Using a raw 7-segment without driver: needs 8+ pins and resistors."],
  code:`#include <TM1637Display.h>
TM1637Display d(2, 3);
void setup(){ d.setBrightness(5); d.showNumberDec(1234); }
void loop(){}`},
];

const BOARDS = { uno:{name:"Arduino Uno / Nano (5 V)", v:5}, esp32:{name:"ESP32 / ESP8266 (3.3 V)", v:3.3} };
