#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ------------------- WIFI CONFIG -------------------
const char* ssid     = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// ------------------- PIN CONFIG --------------------
#define DHTPIN 2          // D4 = GPIO2
#define DHTTYPE DHT11

#define PIR_PIN 14        // D5 = GPIO14
#define MQ2_PIN 12        // D6 = GPIO12
#define BUZZER_PIN 16     // D0 = GPIO16

DHT dht(DHTPIN, DHTTYPE);
ESP8266WebServer server(80);
bool buzzerState = false;
bool manualAlarmOverride = false;
bool manualAlarmState = false;
bool lastSmokeState = false;

// ------------------- HELPER FUNCTIONS -------------------

void logSensorValues(const char* origin) {
  Serial.println("-----------------------------");
  Serial.print("[" ); Serial.print(origin); Serial.print("] millis: "); Serial.println(millis());
  int pir = digitalRead(PIR_PIN);
  int smoke = digitalRead(MQ2_PIN);
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  Serial.print("PIR: "); Serial.println(pir);
  Serial.print("Smoke: "); Serial.println(smoke);
  Serial.print("Temp: "); Serial.println(isnan(temp) ? -1 : temp);
  Serial.print("Humidity: "); Serial.println(isnan(hum) ? -1 : hum);
  Serial.print("Alarm state: "); Serial.println(digitalRead(BUZZER_PIN));
}

void setBuzzer(bool on, const char* reason) {
  if (buzzerState == on) return;
  buzzerState = on;
  Serial.print("[ALARM] "); Serial.print(reason); Serial.print(" -> "); Serial.println(on ? "ON" : "OFF");
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
}

void activateAlarm(const char* reason = "Manual") {
  setBuzzer(true, reason);
}

void deactivateAlarm(const char* reason = "Manual") {
  setBuzzer(false, reason);
}

// Return JSON for all sensors
String createStatusJSON() {
  StaticJsonDocument<256> doc;

  // DHT readings
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  doc["temperature"] = isnan(t) ? -1 : t;
  doc["humidity"] = isnan(h) ? -1 : h;

  // PIR
  doc["motion"] = digitalRead(PIR_PIN);

  // MQ-2 smoke (digital)
  doc["smoke"] = digitalRead(MQ2_PIN);

  // Alarm state
  doc["alarm_state"] = digitalRead(BUZZER_PIN);

  logSensorValues("/api/status");

  String output;
  serializeJson(doc, output);
  return output;
}

// ------------------- API ROUTES -------------------

void handleStatus() {
  server.send(200, "application/json", createStatusJSON());
}

void handleTemp() {
  StaticJsonDocument<128> doc;
  doc["temperature"] = dht.readTemperature();
  doc["humidity"] = dht.readHumidity();
  logSensorValues("/api/temp");

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleMotion() {
  StaticJsonDocument<64> doc;
  doc["motion"] = digitalRead(PIR_PIN);
  logSensorValues("/api/motion");

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleSmoke() {
  StaticJsonDocument<64> doc;
  doc["smoke"] = digitalRead(MQ2_PIN);
  logSensorValues("/api/smoke");

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleAlarmOn() {
  manualAlarmOverride = true;
  manualAlarmState = true;
  activateAlarm("Manual command");
  server.send(200, "application/json", "{\"alarm\":\"ON\"}");
  logSensorValues("/api/alarm/on");
}

void handleAlarmOff() {
  manualAlarmOverride = true;
  manualAlarmState = false;
  deactivateAlarm("Manual command");
  server.send(200, "application/json", "{\"alarm\":\"OFF\"}");
  logSensorValues("/api/alarm/off");
}

// ------------------- SETUP -------------------

void setup() {
  Serial.begin(115200);

  pinMode(PIR_PIN, INPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  dht.begin();

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("Available endpoints:");
  Serial.print("http://"); Serial.print(WiFi.localIP()); Serial.println("/api/status");
  Serial.print("http://"); Serial.print(WiFi.localIP()); Serial.println("/api/temp");
  Serial.print("http://"); Serial.print(WiFi.localIP()); Serial.println("/api/motion");
  Serial.print("http://"); Serial.print(WiFi.localIP()); Serial.println("/api/smoke");
  Serial.print("http://"); Serial.print(WiFi.localIP()); Serial.println("/api/alarm/on");

  // Define API routes
  server.on("/api/status", handleStatus);
  server.on("/api/temp", handleTemp);
  server.on("/api/motion", handleMotion);
  server.on("/api/smoke", handleSmoke);
  server.on("/api/alarm/on", handleAlarmOn);
  server.on("/api/alarm/off", handleAlarmOff);

  server.begin();
  Serial.println("API Server started...");
}

// ------------------- LOOP -------------------
void loop() {
  static unsigned long lastLoopLog = 0;
  if (millis() - lastLoopLog > 5000) {
    Serial.println("\n===== NodeMCU Loop =====");
    Serial.printf("Millis: %lu | IP: %s\n", millis(), WiFi.localIP().toString().c_str());
    logSensorValues("loop");
    lastLoopLog = millis();
  }

  int smokeDigital = digitalRead(MQ2_PIN);
  bool smokeDetected = (smokeDigital == LOW); // active-low
  if (smokeDetected != lastSmokeState) {
    Serial.print("Smoke digital: "); Serial.println(smokeDigital);
    Serial.println(smokeDetected ? "Smoke detected! Forcing alarm." : "Smoke cleared.");
    lastSmokeState = smokeDetected;
  }

  if (smokeDetected) {
    activateAlarm("Smoke auto");
    manualAlarmOverride = false; // allow auto reset after clear
  } else if (manualAlarmOverride) {
    if (manualAlarmState) {
      activateAlarm("Manual hold");
    } else {
      deactivateAlarm("Manual hold");
    }
  } else {
    deactivateAlarm("Auto idle");
  }

  server.handleClient();
}
