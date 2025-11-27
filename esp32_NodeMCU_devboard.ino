#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ------------------- WIFI CONFIG -------------------
const char* ssid     = "Triya";
const char* password = "12345609";

// ------------------- PIN CONFIG --------------------
#define DHTPIN 5          // D1 = GPIO5
#define DHTTYPE DHT11

#define PIR_PIN 14        // D5 = GPIO14
#define MQ2_PIN 12        // D6 = GPIO12
#define BUZZER_PIN 13     // D7 = GPIO13

DHT dht(DHTPIN, DHTTYPE);
bool buzzerState = false;
bool manualAlarmOverride = false;
bool manualAlarmState = false;
bool lastSmokeState = false;
String alarmOverride = "auto"; // 'auto' | 'on' | 'off' pulled from backend

// ------------------- BACKEND CONFIG -------------------
const char* BASE_URL = "https://triyamudulivillage-dashboard-qjos0d47n-adhirajmudulis-projects.vercel.app";
String DATA_URL = String(BASE_URL) + "/api/esp8266/data";
String CONFIG_URL = String(BASE_URL) + "/api/esp8266/config";
unsigned long lastPostAt = 0;
unsigned long lastConfigAt = 0;
const unsigned long POST_INTERVAL_MS = 2000;  // push sensor data every 2s
const unsigned long CONFIG_INTERVAL_MS = 2000; // poll override every 2s

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

// Post sensor snapshot to backend
void postStatusToBackend() {
  WiFiClientSecure client;
  client.setInsecure(); // NOTE: for simplicity on ESP8266; consider proper root CA for production
  HTTPClient http;

  StaticJsonDocument<256> doc;
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  doc["temperature"] = isnan(t) ? -1 : t;
  doc["humidity"] = isnan(h) ? -1 : h;
  doc["motion"] = digitalRead(PIR_PIN);
  doc["smoke"] = digitalRead(MQ2_PIN);
  doc["alarm_state"] = digitalRead(BUZZER_PIN);

  String payload;
  serializeJson(doc, payload);

  if (http.begin(client, DATA_URL)) {
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    if (code > 0) {
      Serial.printf("[HTTP] POST %s -> %d\n", DATA_URL.c_str(), code);
    } else {
      Serial.printf("[HTTP] POST failed: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  } else {
    Serial.println("[HTTP] Unable to connect for POST");
  }
}

// Pull config (alarm_override) from backend
void fetchConfigFromBackend() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, CONFIG_URL)) {
    int code = http.GET();
    if (code == HTTP_CODE_OK) {
      String response = http.getString();
      StaticJsonDocument<128> doc;
      DeserializationError err = deserializeJson(doc, response);
      if (!err) {
        const char* o = doc["alarm_override"] | "auto";
        alarmOverride = String(o);
        Serial.printf("[CONFIG] alarm_override: %s\n", alarmOverride.c_str());
      } else {
        Serial.printf("[CONFIG] JSON parse error: %s\n", err.c_str());
      }
    } else {
      Serial.printf("[HTTP] GET %s -> %d\n", CONFIG_URL.c_str(), code);
    }
    http.end();
  } else {
    Serial.println("[HTTP] Unable to connect for GET");
  }
}

// (No local API routes; device now acts as HTTP client)

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
  Serial.println("HTTP client mode enabled.");
  Serial.print("Backend: "); Serial.println(BASE_URL);
  Serial.print("Data URL: "); Serial.println(DATA_URL);
  Serial.print("Config URL: "); Serial.println(CONFIG_URL);
}

// ------------------- LOOP -------------------
void loop() {
  // --- 1. System Logic (Alarm) ---
  int pir_state = digitalRead(PIR_PIN);
  int smoke_state = digitalRead(MQ2_PIN); // LOW means smoke/gas detected (Active-Low)
  bool smokeDetected = (smoke_state == LOW);

  if (smokeDetected) {
    if (digitalRead(BUZZER_PIN) == LOW) activateAlarm("Smoke auto");
  } else if (alarmOverride == "on") {
    activateAlarm("Override ON");
  } else if (alarmOverride == "off") {
    deactivateAlarm("Override OFF");
  } else {
    // auto mode: use PIR to trigger briefly
    if (pir_state == HIGH) {
      if (digitalRead(BUZZER_PIN) == LOW) activateAlarm("Motion auto");
    } else {
      if (digitalRead(BUZZER_PIN) == HIGH) deactivateAlarm("Auto idle");
    }
  }

  // --- 3. Logging and HTTP ---
  static unsigned long lastLoopLog = 0;
  if (millis() - lastLoopLog > 5000) {
    // ... (Your logging code here) ...
    Serial.println("\n===== NodeMCU Loop =====");
    Serial.printf("Millis: %lu | IP: %s\n", millis(), WiFi.localIP().toString().c_str());
    logSensorValues("loop");
    lastLoopLog = millis();
  }

  // --- 2. Telemetry & Config sync ---
  unsigned long now = millis();
  if (now - lastPostAt >= POST_INTERVAL_MS) {
    logSensorValues("post");
    postStatusToBackend();
    lastPostAt = now;
  }
  if (now - lastConfigAt >= CONFIG_INTERVAL_MS) {
    fetchConfigFromBackend();
    lastConfigAt = now;
  }
}
