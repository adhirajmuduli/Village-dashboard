#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---------------------- USER SETTINGS ---------------------- //
const char* ssid     = "Triya";
const char* password = "12345609";

// API ENDPOINTS (Hosted on Vercel)
const char* BASE_URL32 = "https://triyamudulivillage-dashboard-qjos0d47n-adhirajmudulis-projects.vercel.app";
String uploadURL = String(BASE_URL32) + "/api/esp32/data";
String configURL = String(BASE_URL32) + "/api/esp32/config";

// ---------------------- PINS ---------------------- //
#define SENSOR_PIN 34   // Analog capacitive water sensor
#define RELAY_PIN 19    // Water Pump Relay
#define PIR_PIN 23      // Motion Sensor
#define LED_PIN 2       // LED Light

// ---------------------- VARIABLES ---------------------- //
const int MIN_WET_VALUE = 4000; // Dry = 0%
const int MAX_WET_VALUE = 1000; // Fully wet = 100%

int waterLowThresholdPercent = 20;   // Updated by server
int motionLightDuration = 5000;      // ms → updated by server
String pumpOverrideMode = "auto";   // auto | on | off
String lightOverrideMode = "auto";  // auto | on | off

unsigned long lastMotionTime = 0;
unsigned long lastNetworkLog = 0;

bool lastPumpState = false;
bool lastLightState = false;
bool lastMotionState = false;

// ---------------------- WIFI ---------------------- //
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected.");
    Serial.println(WiFi.localIP());
    Serial.print("Upload URL: "); Serial.println(uploadURL);
    Serial.print("Config URL: "); Serial.println(configURL);
  } else {
    Serial.println("WiFi Failed.");
  }
}

// ---------------------- PCB SENSOR MEASUREMENT ---------------------- //
float getWaterLevelPercent() {
  int rawValue = analogRead(SENSOR_PIN);
  int percent = map(rawValue, MIN_WET_VALUE, MAX_WET_VALUE, 0, 100);

  Serial.print("Raw Sensor: "); Serial.print(rawValue);
  Serial.print(" -> Level: "); Serial.print(percent); Serial.println("%");

  return constrain(percent, 0, 100);
}

// ---------------------- FETCH REMOTE CONFIG ---------------------- //
void fetchRemoteConfig() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, configURL);

  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    Serial.println("CONFIG RECEIVED: " + payload);

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err) {
      if (doc.containsKey("water_threshold")) {
        waterLowThresholdPercent = doc["water_threshold"];
      }
      if (doc.containsKey("motion_light_time")) {
        motionLightDuration = doc["motion_light_time"];
      }
      if (doc.containsKey("pump_override")) {
        pumpOverrideMode = String((const char*)doc["pump_override"]);
      }
      if (doc.containsKey("light_override")) {
        lightOverrideMode = String((const char*)doc["light_override"]);
      }

      Serial.print("THRESHOLD UPDATED: ");
      Serial.println(waterLowThresholdPercent);
      Serial.print("LED DURATION UPDATED: ");
      Serial.println(motionLightDuration);
      Serial.print("PUMP OVERRIDE: ");
      Serial.println(pumpOverrideMode);
      Serial.print("LIGHT OVERRIDE: ");
      Serial.println(lightOverrideMode);
    } else {
      Serial.print("CONFIG JSON ERROR: ");
      Serial.println(err.c_str());
    }
  }

  http.end();
}

// ---------------------- UPLOAD DATA ---------------------- //
void uploadData(int waterLevel, bool motionDetected, int pumpState, int lightState) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, uploadURL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["water_level"] = waterLevel;
  doc["motion"] = motionDetected ? "1" : "0";
  doc["pump_state"] = pumpState;
  doc["light_state"] = lightState;

  String json;
  serializeJson(doc, json);

  int code = http.POST(json);
  if (code > 0 && code < 300) {
    Serial.printf("[ESP32] POST %s -> %d\n", uploadURL.c_str(), code);
    String response = http.getString();
    Serial.println("UPLOAD RESPONSE: " + response);
    http.end();
  } else {
    Serial.printf("[ESP32] POST failed code=%d, trying GET-ingest fallback\n", code);
    http.end();
    // GET-based fallback ingestion
    String qs = String(uploadURL) + "?ingest=1";
    qs += "&water_level=" + String(waterLevel);
    qs += "&motion=" + String(motionDetected ? 1 : 0);
    qs += "&pump_state=" + String(pumpState);
    qs += "&light_state=" + String(lightState);
    if (http.begin(client, qs)) {
      int getCode = http.GET();
      Serial.printf("[ESP32] GET-ingest -> %d\n", getCode);
      http.end();
    }
  }
}

// ---------------------- SETUP ---------------------- //
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  connectWiFi();
}

// ---------------------- LOOP ---------------------- //
void loop() {
  connectWiFi();

  if (millis() - lastNetworkLog > 10000) {
    Serial.println("\n============================");
    Serial.printf("Loop tick @ %lums | WiFi IP: %s\n", millis(), WiFi.localIP().toString().c_str());
    Serial.print("Upload URL: "); Serial.println(uploadURL);
    Serial.print("Config URL: "); Serial.println(configURL);
    lastNetworkLog = millis();
  }

  // ------------------- 1. Remote Config Sync ------------------- //
  static unsigned long lastConfigUpdate = 0;
  if (millis() - lastConfigUpdate > 2000) {
    fetchRemoteConfig();
    lastConfigUpdate = millis();
  }

  // ------------------- 2. Measure water level ------------------- //
  int waterPercent = getWaterLevelPercent();
  Serial.print("Water Level: ");
  Serial.print(waterPercent);
  Serial.println("%");

  bool motionDetected = digitalRead(PIR_PIN);
  if (motionDetected != lastMotionState) {
    Serial.print("PIR: "); Serial.println(motionDetected);
    lastMotionState = motionDetected;
  }

  bool pumpShouldRun = false;
  if (pumpOverrideMode == "on") {
    pumpShouldRun = true;
  } else if (pumpOverrideMode == "off") {
    pumpShouldRun = false;
  } else {
    pumpShouldRun = waterPercent < waterLowThresholdPercent;
  }
  digitalWrite(RELAY_PIN, pumpShouldRun ? HIGH : LOW);
  if (pumpShouldRun != lastPumpState) {
    Serial.print("Pump override mode: "); Serial.print(pumpOverrideMode);
    Serial.print(" -> Pump state: "); Serial.println(pumpShouldRun ? "ON" : "OFF");
    lastPumpState = pumpShouldRun;
  }

  // ------------------- 3. Motion Sensor + LED ------------------- //
  if (motionDetected) {
    Serial.println("Motion detected!");
    lastMotionTime = millis();
  }

  bool shouldKeepLight = (millis() - lastMotionTime) < motionLightDuration;
  bool lightShouldBeOn = false;
  if (lightOverrideMode == "on") {
    lightShouldBeOn = true;
  } else if (lightOverrideMode == "off") {
    lightShouldBeOn = false;
  } else {
    lightShouldBeOn = motionDetected || shouldKeepLight;
  }
  digitalWrite(LED_PIN, lightShouldBeOn ? HIGH : LOW);
  if (lightShouldBeOn != lastLightState) {
    Serial.print("Light override mode: "); Serial.print(lightOverrideMode);
    Serial.print(" -> Light state: "); Serial.println(lightShouldBeOn ? "ON" : "OFF");
    Serial.print("Motion light duration: "); Serial.print(motionLightDuration); Serial.println(" ms");
    lastLightState = lightShouldBeOn;
  }

  // ------------------- 4. Upload data every ~2s ------------------- //
  static unsigned long lastUpload = 0;
  if (millis() - lastUpload > 2000) {
    Serial.println("Uploading telemetry payload...");
    uploadData(waterPercent, motionDetected, pumpShouldRun ? 1 : 0, lightShouldBeOn ? 1 : 0);
    lastUpload = millis();
  }

  delay(200);
}
