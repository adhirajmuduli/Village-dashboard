"use client";

import React, { useState, useEffect } from 'react';
import { GlassCard } from './ui/GlassCard';
import { WaterLevelChart } from './charts/WaterLevelChart';
import { TemperatureTrendChart, HumidityTrendChart, TrendSample } from './charts/EnvironmentChart';
import { HalfDonutGauge, BinaryHalfDonutGauge } from './charts/HalfDonutGauge';
import { Droplets, Wind, Thermometer, Activity, Siren, Settings, RefreshCw, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

type OverrideMode = 'auto' | 'on' | 'off';

type Esp32Data = {
    water_level: number;
    motion: string;
    pump_state: number;
    light_state: number;
};

type Esp32Config = {
    water_threshold: number;
    motion_light_time: number;
    pump_override: OverrideMode;
    light_override: OverrideMode;
};

type Esp8266Data = {
    temperature: number;
    humidity: number;
    motion: number;
    smoke: number;
    alarm_state: number;
};

const SAMPLE_WINDOW = 24;

export default function Dashboard() {
    // State
    const [esp32Data, setEsp32Data] = useState<Esp32Data>({ water_level: 0, motion: "0", pump_state: 0, light_state: 0 });
    const [esp8266Data, setEsp8266Data] = useState<Esp8266Data>({ temperature: 0, humidity: 0, motion: 0, smoke: 0, alarm_state: 0 });
    const [loading, setLoading] = useState(true);
    const [alarmLoading, setAlarmLoading] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);
    const [esp32Config, setEsp32Config] = useState<Esp32Config>({
        water_threshold: 20,
        motion_light_time: 5000,
        pump_override: 'auto',
        light_override: 'auto',
    });
    const [temperatureSamples, setTemperatureSamples] = useState<TrendSample[]>([]);
    const [humiditySamples, setHumiditySamples] = useState<TrendSample[]>([]);

    // Fetch Data
    const fetchData = async () => {
        try {
            // Fetch ESP32 Data (Pushed to our API)
            const res32 = await fetch('/api/esp32/data');
            const data32 = await res32.json();
            setEsp32Data({
                water_level: Number(data32.water_level) || 0,
                motion: data32.motion ?? "0",
                pump_state: data32.pump_state ?? 0,
                light_state: data32.light_state ?? 0,
            });

            // Fetch ESP8266 Data (Proxied)
            const res8266 = await fetch('/api/esp8266/proxy?endpoint=status');
            const data8266 = await res8266.json();
            setEsp8266Data(data8266);

            const timestampLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setTemperatureSamples(prev => [...prev, { label: timestampLabel, value: Number(data8266.temperature) || 0 }].slice(-SAMPLE_WINDOW));
            setHumiditySamples(prev => [...prev, { label: timestampLabel, value: Number(data8266.humidity) || 0 }].slice(-SAMPLE_WINDOW));

            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/esp32/config');
            const config = await res.json();
            setEsp32Config(config);
        } catch (error) {
            console.error('Failed to load ESP32 config', error);
        }
    };

    useEffect(() => {
        fetchData();
        fetchConfig();
        const interval = setInterval(fetchData, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, []);

    // Handlers
    const updateEsp32Config = async (patch: Partial<Esp32Config>) => {
        setEsp32Config(prev => ({ ...prev, ...patch }));
        setConfigSaving(true);
        try {
            const res = await fetch('/api/esp32/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            if (!res.ok) throw new Error('Config update failed');
            const data = await res.json();
            setEsp32Config(data);
        } catch (error) {
            console.error('Failed to update config', error);
        } finally {
            setConfigSaving(false);
        }
    };

    const toggleAlarm = async () => {
        setAlarmLoading(true);
        const action = esp8266Data.alarm_state ? 'alarm_off' : 'alarm_on';
        try {
            await fetch('/api/esp8266/proxy', {
                method: 'POST',
                body: JSON.stringify({ action }),
            });
            // Optimistic update
            setEsp8266Data(prev => ({ ...prev, alarm_state: prev.alarm_state ? 0 : 1 }));
        } catch (error) {
            console.error("Failed to toggle alarm", error);
        } finally {
            setAlarmLoading(false);
        }
    };

    const lightIsActive = esp32Data.light_state === 1;
    const isLightOn = lightIsActive || esp32Data.motion === "1";
    const pumpRunning = esp32Data.pump_state === 1;

    const overrideButtonClasses = (active: boolean) =>
        `flex-1 rounded-full px-3 py-2 text-sm font-semibold border transition ${active ? 'bg-white/20 border-white text-white' : 'border-white/10 text-neutral-300 hover:border-white/30'}`;

    const motionDelaySeconds = Math.max(1, Math.round(esp32Config.motion_light_time / 1000));

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8 font-sans selection:bg-purple-500/30">

            {/* Header */}
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                        Village Dashboard
                    </h1>
                    <p className="text-neutral-400 mt-1">Real-time Sensor Monitoring & Control</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={fetchData} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                        <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Water Level Card */}
                <GlassCard className="col-span-1 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Droplets className="w-6 h-6 text-blue-400" />
                        </div>
                        <h2 className="text-xl font-semibold">Water Tank</h2>
                    </div>
                    <WaterLevelChart level={esp32Data.water_level} />
                    <div className="mt-4 flex justify-between text-sm text-neutral-400">
                        <span>Status: {esp32Data.water_level < esp32Config.water_threshold ? 'Low' : 'Normal'}</span>
                        <span>Pump: {pumpRunning ? 'ON' : 'OFF'}</span>
                    </div>
                </GlassCard>

                {/* Temperature Card */}
                <GlassCard className="col-span-1 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Thermometer className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Temperature</h2>
                            <p className="text-sm text-neutral-400">Live readings & trend</p>
                        </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <HalfDonutGauge
                            value={esp8266Data.temperature}
                            max={100}
                            label="Gauge"
                            unit="°C"
                            gradientColors={['#fb923c', '#f97316']}
                            statusText={esp8266Data.temperature > 30 ? 'Warm Zone' : 'Comfort Zone'}
                        />
                        <TemperatureTrendChart samples={temperatureSamples} hideTitle className="h-full" />
                    </div>
                </GlassCard>

                {/* Humidity Card */}
                <GlassCard className="col-span-1 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <Wind className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Humidity</h2>
                            <p className="text-sm text-neutral-400">Separate live chart</p>
                        </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <HalfDonutGauge
                            value={esp8266Data.humidity}
                            max={100}
                            label="Gauge"
                            unit="%"
                            gradientColors={['#38bdf8', '#6366f1']}
                            statusText={esp8266Data.humidity > 70 ? 'Humid' : 'Balanced'}
                        />
                        <HumidityTrendChart samples={humiditySamples} hideTitle className="h-full" />
                    </div>
                </GlassCard>

                {/* Light Status Card */}
                <GlassCard className="col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-400/20 rounded-lg">
                            <Lightbulb className="w-6 h-6 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Light Status (ESP32)</h2>
                            <p className="text-sm text-neutral-400">Driven by PIR sensor</p>
                        </div>
                    </div>
                    <motion.div
                        animate={{ scale: isLightOn ? 1 : 0.95, opacity: isLightOn ? 1 : 0.6 }}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-6 text-center transition-all ${isLightOn
                                ? 'border-amber-300/40 bg-amber-400/10 shadow-[0_0_40px_-15px_rgba(251,191,36,0.8)]'
                                : 'border-white/10 bg-white/5'
                            }`}
                    >
                        <div className={`mb-4 rounded-full p-6 ${isLightOn ? 'bg-amber-300/30' : 'bg-neutral-700/40'}`}>
                            <Lightbulb className={`h-10 w-10 ${isLightOn ? 'text-amber-200' : 'text-neutral-400'}`} />
                        </div>
                        <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Light</p>
                        <p className={`text-3xl font-bold ${isLightOn ? 'text-amber-200' : 'text-neutral-400'}`}>
                            {isLightOn ? 'ON' : 'OFF'}
                        </p>
                        <p className="mt-2 text-sm text-neutral-400">{lightIsActive ? 'Manual override active' : isLightOn ? 'Motion detected recently' : 'Area clear'}</p>
                    </motion.div>
                </GlassCard>

                {/* Security Card */}
                <GlassCard className="col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <Activity className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold">Security</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                            <span className="text-neutral-300">Motion (ESP8266)</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${esp8266Data.motion ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {esp8266Data.motion ? 'DETECTED' : 'CLEAR'}
                            </span>
                        </div>
                        <BinaryHalfDonutGauge
                            active={Boolean(esp8266Data.smoke)}
                            label="Smoke Sensor"
                            safeLabel="Safe"
                            dangerLabel="Smoke"
                            description={esp8266Data.smoke ? 'Ventilation needed' : 'Air quality nominal'}
                        />
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-300">Buzzer Status</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${esp8266Data.alarm_state ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {esp8266Data.alarm_state ? 'ACTIVE' : 'IDLE'}
                                </span>
                            </div>
                            <p className="mt-2 text-sm text-neutral-400">{esp8266Data.alarm_state ? 'Manual alarm engaged' : 'Standing by for remote trigger'}</p>
                        </div>
                    </div>
                </GlassCard>

                {/* Controls Card */}
                <GlassCard className="col-span-1 md:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Settings className="w-6 h-6 text-purple-400" />
                        </div>
                        <h2 className="text-xl font-semibold">Controls</h2>
                    </div>

                    <div className="space-y-6">
                        <section>
                            <div className="flex items-center justify-between text-sm text-neutral-300">
                                <span>Water Threshold</span>
                                <span>{esp32Config.water_threshold}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={esp32Config.water_threshold}
                                onChange={(e) => updateEsp32Config({ water_threshold: Number(e.target.value) })}
                                className="w-full"
                                disabled={configSaving}
                            />
                        </section>

                        <section>
                            <div className="flex items-center justify-between text-sm text-neutral-300">
                                <span>Motion Light Delay</span>
                                <span>{motionDelaySeconds}s</span>
                            </div>
                            <input
                                type="range"
                                min={5}
                                max={120}
                                value={motionDelaySeconds}
                                onChange={(e) => updateEsp32Config({ motion_light_time: Number(e.target.value) * 1000 })}
                                className="w-full"
                                disabled={configSaving}
                            />
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">Pump Override</p>
                                    <p className="text-xs text-neutral-400">Current: {pumpRunning ? 'Running' : 'Idle'}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs ${pumpRunning ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-neutral-300'}`}>
                                    {pumpRunning ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {(['auto', 'on', 'off'] as OverrideMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        className={overrideButtonClasses(esp32Config.pump_override === mode)}
                                        onClick={() => updateEsp32Config({ pump_override: mode })}
                                        disabled={configSaving}
                                    >
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">Light Override</p>
                                    <p className="text-xs text-neutral-400">Current: {lightIsActive ? 'Illuminated' : 'Idle'}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs ${lightIsActive ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-neutral-300'}`}>
                                    {lightIsActive ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {(['auto', 'on', 'off'] as OverrideMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        className={overrideButtonClasses(esp32Config.light_override === mode)}
                                        onClick={() => updateEsp32Config({ light_override: mode })}
                                        disabled={configSaving}
                                    >
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <button
                                onClick={toggleAlarm}
                                disabled={alarmLoading}
                                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${esp8266Data.alarm_state
                                        ? 'bg-red-500/90 hover:bg-red-600 shadow-lg shadow-red-500/20'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Siren className="w-6 h-6" />
                                    <span className="font-semibold">Emergency Alarm</span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${esp8266Data.alarm_state ? 'bg-white animate-pulse' : 'bg-neutral-500'}`} />
                            </button>
                        </section>
                    </div>
                </GlassCard>

            </div>
        </div>
    );
}
