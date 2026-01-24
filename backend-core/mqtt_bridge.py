#!/usr/bin/env python3
"""
MQTT Bridge: mqtt.wokwi.com → localhost:1883
Relays messages between Wokwi public broker and local MQTT
"""

import paho.mqtt.client as mqtt
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('MQTT-Bridge')

# Connection flags
wokwi_connected = False
local_connected = False

# MQTT Clients
wokwi_client = mqtt.Client(client_id="bridge-from-wokwi")
local_client = mqtt.Client(client_id="bridge-to-local")

def on_wokwi_connect(client, userdata, flags, rc):
    global wokwi_connected
    if rc == 0:
        wokwi_connected = True
        logger.info("✅ Connected to mqtt.wokwi.com:8883")
        # Subscribe to all Wokwi topics
        client.subscribe("system/+/status", qos=1)
        client.subscribe("system/+/event", qos=1)
        client.subscribe("system/+/ack", qos=1)
        logger.info("📡 Subscribed to system/+/* topics")
    else:
        logger.error(f"❌ Wokwi connection failed: {rc}")

def on_wokwi_disconnect(client, userdata, rc):
    global wokwi_connected
    wokwi_connected = False
    logger.warning(f"⚠️  Disconnected from Wokwi: {rc}")

def on_local_connect(client, userdata, flags, rc):
    global local_connected
    if rc == 0:
        local_connected = True
        logger.info("✅ Connected to localhost:1883")
    else:
        logger.error(f"❌ Local connection failed: {rc}")

def on_wokwi_message(client, userdata, msg):
    """Relay message from Wokwi to Local MQTT"""
    if local_connected:
        logger.info(f"🔄 Relaying: {msg.topic} → {msg.payload.decode()[:60]}")
        local_client.publish(msg.topic, msg.payload, qos=msg.qos)
    else:
        logger.warning(f"⚠️  Local MQTT not connected, dropping message from {msg.topic}")

# Setup Wokwi client (public broker)
wokwi_client.on_connect = on_wokwi_connect
wokwi_client.on_disconnect = on_wokwi_disconnect
wokwi_client.on_message = on_wokwi_message

# Setup Local client
local_client.on_connect = on_local_connect

# Connect both
logger.info("🌉 Starting MQTT Bridge...")
logger.info("📡 Connecting to mqtt.wokwi.com:8883...")

try:
    wokwi_client.connect("mqtt.wokwi.com", 8883, 60)
except Exception as e:
    logger.error(f"❌ Cannot reach mqtt.wokwi.com: {e}")
    logger.info("⚠️  This is expected if no internet connection")
    exit(1)

logger.info("📡 Connecting to localhost:1883...")
try:
    local_client.connect("localhost", 1883, 60)
except Exception as e:
    logger.error(f"❌ Cannot reach localhost:1883 - is MQTT running? {e}")
    exit(1)

logger.info("✅ Bridge started - relaying messages...")
logger.info("   Wokwi → Local MQTT relay active")
logger.info("   Press Ctrl+C to stop")

# Run forever
wokwi_client.loop_start()
local_client.loop_start()

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    logger.info("🛑 Stopping bridge...")
    wokwi_client.loop_stop()
    local_client.loop_stop()
    wokwi_client.disconnect()
    local_client.disconnect()
    logger.info("✅ Bridge stopped")
