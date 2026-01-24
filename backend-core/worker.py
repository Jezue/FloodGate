import json
import time
import paho.mqtt.client as mqtt
from sqlalchemy import create_engine, text
from datetime import datetime, timezone
import logging
from threading import Thread
from queue import Queue, Empty
import os

# FloodGate: Structured Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('FloodGate-Worker')

# Synchronous engine for the worker thread
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/flood_system")
MQTT_BROKER = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

# Message queue for thread-safe database writes
message_queue = Queue(maxsize=100)
engine = create_engine(DB_URL, echo=False, pool_size=10)


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("✅ MQTT Worker Connected successfully")
        client.subscribe("system/+/status")
        client.subscribe("system/+/ack")
        # Subscribe to water detection events
        client.subscribe("system/+/event")
    else:
        logger.error(f"❌ MQTT Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Queue incoming MQTT messages for async processing"""
    try:
        topic = msg.topic
        payload_str = msg.payload.decode()
        payload = json.loads(payload_str)
        device_id = topic.split("/")[1]

        # LOG ALL INCOMING MESSAGES FOR DEBUGGING
        logger.info(
            f"📨 [MQTT] Topic: {topic} | Device: {device_id} | Payload: {payload_str[:100]}")

        # Add to queue instead of blocking on DB write
        if not message_queue.full():
            message_queue.put({
                'device_id': device_id,
                'topic': topic,
                'payload': payload,
                'mqtt_client': client  # Pass client for publishing responses
            })
            logger.info(f"✅ Queued message from {device_id}")
        else:
            logger.warning(
                f"⚠️  Message queue full, dropping message from {device_id}")
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON from MQTT: {msg.payload.decode()[:100]}")
    except Exception as e:
        logger.error(f"❌ Error processing MQTT message: {e}")


def database_worker_thread():
    """Background thread that processes queued messages"""
    logger.info("🔄 Database worker thread started")

    while True:
        try:
            msg = message_queue.get(timeout=1)

            device_id = msg['device_id']
            payload = msg['payload']
            topic = msg['topic']
            mqtt_client = msg.get('mqtt_client')

            with engine.connect() as conn:

                # === HANDLE WATER DETECTED EVENT ===
                is_water_event = payload.get('event') == 'water_detected' or payload.get(
                    'event_type') == 'water_detected'
                if 'event' in topic and is_water_event:
                    logger.info(
                        f"🚨 [ALARM] Water detected event from {device_id}")

                    # Get device mode and current state from database
                    result = conn.execute(text("""
                        SELECT current_mode, fail_safe_timeout_min, current_state_code
                        FROM current_device_state
                        WHERE device_id = :did
                    """), {"did": device_id})
                    row = result.fetchone()

                    mode = row.current_mode if row else "AUTOMATIC"
                    timeout_min = row.fail_safe_timeout_min if row else 5

                    # Update device state - mark water as detected
                    # Only update deadline if we are NOT already in Fail-Safe (Status 4)
                    current_code = row.current_state_code if row else 0

                    if str(mode).upper() in ['AUTOMATIC', 'AUTO']:
                        # Immediate gate closure in AUTOMATIC mode
                        conn.execute(text("""
                            UPDATE current_device_state
                            SET water_sensor_status = 1,
                                current_state_code = 3,
                                last_seen = NOW(),
                                connection_status = 'ONLINE',
                                fail_safe_deadline = NULL
                            WHERE device_id = :did
                        """), {"did": device_id})

                        # Send gate close command
                        try:
                            conn.execute(text("""
                                INSERT INTO command_queue (device_id, action, status)
                                VALUES (:did, 'AUTO_DROP', 'SENT')
                            """), {"did": device_id})

                            if mqtt_client:
                                # ESP32 expects 'force_drop'
                                payload = json.dumps({"command": "force_drop"})
                                cmd_topic = f"system/{device_id}/user_command"
                                mqtt_client.publish(cmd_topic, payload, qos=1)
                                logger.info(
                                    f"🚀 [AUTO] Sent 'force_drop' to {device_id}")
                            else:
                                logger.warning(
                                    f"⚠️ [AUTO] MQTT Client not available to send drop command")

                        except Exception as e:
                            logger.error(
                                f"❌ [AUTO] Failed to send auto-drop command: {e}")

                        conn.commit()
                        logger.info(
                            f"✅ Auto-mode alarm processed for {device_id}")

                        # Send mode response to ESP32 (transition STATE_WATER_DETECTED -> STATE_AUTO_DROP)
                        if mqtt_client:
                            response = json.dumps({
                                "mode": "AUTO",  # ESP32 expects "AUTO" protocol, not "AUTOMATIC"
                                "timeout_minutes": timeout_min
                            })
                            mqtt_client.publish(
                                f"system/{device_id}/action", response, qos=1)
                            logger.info(
                                f"✅ [AUTO] Sent mode response to {device_id}")

                    else:
                        # MANUAL / KONTROLA: Trigger Fail-Safe Popup
                        try:
                            if current_code in [3, 4]:
                                # Already in Fail-Safe (4) or Acknowledged (3):
                                # Update status but KEEP existing deadline (for 4) or NULL (for 3)
                                conn.execute(text("""
                                    UPDATE current_device_state
                                    SET water_sensor_status = 1,
                                        last_seen = NOW(),
                                        connection_status = 'ONLINE'
                                    WHERE device_id = :did
                                """), {"did": device_id})
                            else:
                                # New State 4: Set new deadline (Fail-Safe Init)
                                conn.execute(text("""
                                    UPDATE current_device_state
                                    SET water_sensor_status = 1,
                                        current_state_code = 4,
                                        last_seen = NOW(),
                                        connection_status = 'ONLINE',
                                        fail_safe_deadline = NOW() + (COALESCE(:timeout, 5) || ' minutes')::INTERVAL
                                    WHERE device_id = :did
                                """), {"did": device_id, "timeout": timeout_min})

                            conn.commit()
                            logger.info(
                                f"✅ Updated device state: water_sensor_status=1")
                        except Exception as e:
                            logger.warning(
                                f"⚠️ Failed to update device state: {e}")

                    # Log alarm to database (new table)
                    try:
                        conn.execute(text("""
                            INSERT INTO alarm_log (device_id, alarm_type, mode_used, timeout_minutes)
                            VALUES (:did, 'WATER_DETECTED', :mode, :timeout)
                        """), {"did": device_id, "mode": mode, "timeout": timeout_min})
                        conn.commit()
                    except Exception as e:
                        logger.warning(
                            f"⚠️ Alarm log failed (table may not exist): {e}")

                    # Respond to ESP32 with mode
                    if mqtt_client:
                        # Map database mode to ESP32 expected format
                        # Database stores "AUTOMATIC", ESP32 expects "AUTO"
                        esp_mode = "AUTO" if str(mode).upper() in [
                            'AUTOMATIC', 'AUTO'] else "MANUAL"

                        response = json.dumps({
                            "mode": esp_mode,
                            "timeout_minutes": timeout_min
                        })
                        mqtt_client.publish(
                            f"system/{device_id}/action", response, qos=1)
                        logger.info(
                            f"✅ Sent {esp_mode} mode response to {device_id} (timeout={timeout_min}min)")

                    # Save water_level_cm from event payload (if present)
                    # Then prevent race condition by not re-processing as telemetry
                    water_level_cm_event = payload.get("water_level_cm", 0)
                    if water_level_cm_event > 0:
                        conn.execute(text("""
                            UPDATE current_device_state
                            SET water_level_cm = :wl
                            WHERE device_id = :did
                        """), {"wl": water_level_cm_event, "did": device_id})
                        conn.commit()

                    # Continue - don't process this event as telemetry
                    # This prevents telemetry handler from overwriting current_state_code
                    continue

                # === HANDLE TELEMETRY (standard) ===
                # Skip non-telemetry messages
                if not isinstance(payload, dict) or "device_id" not in payload:
                    continue

                # Parse telemetry
                w_status = 1 if payload.get(
                    "water_detected") or payload.get("water_alarm") else 0
                c_state = 1 if payload.get(
                    "curtain_down") or payload.get("gate_closed") else 0
                battery = payload.get(
                    "battery", payload.get("battery_pct", 100))
                mode = payload.get("mode", "AUTOMATIC")
                risk_index = payload.get("risk_index", 0.0)
                water_level_cm = payload.get("water_level_cm", 0)
                system_state = payload.get("state", "IDLE")
                scheduler_locked = payload.get("scheduler_locked", 0)

                # MAP ESP32 state to current_state_code for frontend
                state_code_map = {
                    "IDLE": 0,
                    "WATER_DET": 3,  # Water detected
                    "MANUAL_WAIT": 4,  # Waiting for user decision (POPUP!)
                    "AUTO_DROP": 3,
                    "MANUAL_DROP": 3,
                    "OFFLINE": 0,
                    "CLOSED": 3
                }
                mapped_state_code = state_code_map.get(system_state, 0)

                try:
                    # Log telemetry to history table
                    conn.execute(text("""
                        INSERT INTO device_telemetry
                        (time, device_id, water_sensor_status, curtain_state,
                         battery_soc_perc, system_state_code, risk_index)
                        VALUES (NOW(), :did, :w, :c, :b, 0, :risk)
                    """), {
                        "did": device_id,
                        "w": w_status,
                        "c": c_state,
                        "b": battery,
                        "risk": risk_index
                    })

                    # Update device shadow state (preserve fail-safe state codes)
                    conn.execute(text("""
                        INSERT INTO current_device_state
                        (device_id, last_seen, connection_status,
                         water_sensor_status, curtain_state, battery_soc_perc,
                         current_mode, water_level_cm, system_state,
                         scheduler_locked, current_state_code)
                        VALUES (:did, NOW(), 'ONLINE', :w, :c, :b, :m, :wl,
                                :st, :lock, :code)
                        ON CONFLICT (device_id) DO UPDATE SET
                        last_seen = NOW(),
                        connection_status = 'ONLINE',
                        water_sensor_status = EXCLUDED.water_sensor_status,
                        curtain_state = EXCLUDED.curtain_state,
                        battery_soc_perc = EXCLUDED.battery_soc_perc,
                        water_level_cm = EXCLUDED.water_level_cm,
                        system_state = EXCLUDED.system_state,
                        scheduler_locked = EXCLUDED.scheduler_locked,
                        current_state_code = CASE
                            WHEN current_device_state.current_state_code IN (4, 5)
                            THEN current_device_state.current_state_code
                            ELSE EXCLUDED.current_state_code
                        END
                    """), {
                        "did": device_id,
                        "w": w_status,
                        "c": c_state,
                        "b": battery,
                        "m": mode,
                        "wl": water_level_cm,
                        "st": system_state,
                        "lock": scheduler_locked,
                        "code": mapped_state_code
                    })

                    # Process command ACK if present
                    if "command_id" in payload:
                        conn.execute(text("""
                            UPDATE command_queue
                            SET status = 'EXECUTED', executed_at = NOW()
                            WHERE cmd_id = :cmd_id AND device_id = :did
                        """), {
                            "cmd_id": payload["command_id"],
                            "did": device_id
                        })

                    conn.commit()
                    logger.debug(f"✅ Processed telemetry from {device_id}")

                except Exception as db_error:
                    logger.error(
                        f"❌ Database error for {device_id}: {db_error}")
                    conn.rollback()

        except Empty:
            # Timeout is normal - no messages in queue
            continue
        except Exception as e:
            import traceback
            logger.error(
                f"❌ Worker thread error: {e}\n{traceback.format_exc()}")


def fail_safe_monitor_thread(mqtt_client):
    """Monitor fail_safe_deadline and auto-drop if expired"""
    logger.info("⏱️  Fail-safe monitor thread started")

    while True:
        try:
            time.sleep(5)  # Check every 5 seconds

            with engine.connect() as conn:
                # Find devices in state 4 (CONTROL_WAITING) with expired deadline
                result = conn.execute(text("""
                    SELECT device_id, fail_safe_deadline
                    FROM current_device_state
                    WHERE current_state_code = 4
                    AND fail_safe_deadline IS NOT NULL
                    AND fail_safe_deadline <= NOW()
                """))

                expired_devices = result.fetchall()

                for row in expired_devices:
                    device_id = row.device_id
                    logger.warning(
                        f"⏰ [FAIL-SAFE] Deadline expired for {device_id}, sending auto-drop")

                    # Update state to 5 (FAIL_SAFE_ACTION)
                    conn.execute(text("""
                        UPDATE current_device_state
                        SET current_state_code = 5,
                            fail_safe_deadline = NULL
                        WHERE device_id = :did
                    """), {"did": device_id})
                    conn.commit()

                    # Send force_drop command to ESP32
                    if mqtt_client:
                        cmd_payload = json.dumps({"command": "force_drop"})
                        mqtt_client.publish(
                            f"system/{device_id}/user_command", cmd_payload, qos=1)
                        logger.info(
                            f"✅ [FAIL-SAFE] Sent force_drop to {device_id}")

        except Exception as e:
            logger.error(f"❌ Fail-safe monitor error: {e}")
            continue


def connection_timeout_monitor():
    """Monitor ESP32 connection - set OFFLINE if no telemetry for 90s"""
    logger.info("📡 Connection timeout monitor started")
    TIMEOUT_SECONDS = 90  # 3x ESP telemetry interval (30s)

    while True:
        try:
            time.sleep(30)  # Check every 30 seconds

            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT device_id, last_seen, connection_status
                    FROM current_device_state
                """))

                for row in result.fetchall():
                    if not row.last_seen:
                        continue

                    time_since = datetime.now(timezone.utc) - row.last_seen
                    seconds_since = time_since.total_seconds()

                    if seconds_since > TIMEOUT_SECONDS:
                        # No telemetry for >90s - mark OFFLINE
                        if row.connection_status == 'ONLINE':
                            logger.warning(
                                f"⚠️  {row.device_id} → OFFLINE (no telemetry for {seconds_since:.0f}s)")
                            conn.execute(text("""
                                UPDATE current_device_state
                                SET connection_status = 'OFFLINE'
                                WHERE device_id = :did
                            """), {"did": row.device_id})
                            conn.commit()
                    else:
                        # Recent telemetry - ensure ONLINE
                        if row.connection_status != 'ONLINE':
                            logger.info(f"✅ {row.device_id} → ONLINE")
                            conn.execute(text("""
                                UPDATE current_device_state
                                SET connection_status = 'ONLINE'
                                WHERE device_id = :did
                            """), {"did": row.device_id})
                            conn.commit()

        except Exception as e:
            logger.error(f"❌ Connection monitor error: {e}")


def schedule_monitor_thread(mqtt_client):
    """Check for scheduled actions every minute"""
    logger.info("📅 Scheduler monitor thread started")

    while True:
        try:
            # Sync to next minute
            now = datetime.now()
            sleep_time = 60 - now.second
            time.sleep(sleep_time)

            now = datetime.now()  # Update time after sleep

            # ISO Weekday: 1=Mon, 7=Sun (Matches our frontend/db convention)
            current_day = now.isoweekday()
            current_hour = now.hour
            current_minute = now.minute

            # Simple unique checking to avoid double execution is handled by 60s sleep sync

            with engine.connect() as conn:
                # Fetch ALL active schedules
                result = conn.execute(text("""
                    SELECT id, device_id, action_type, days
                    FROM schedules
                    WHERE active = true
                    AND hour = :h
                    AND minute = :m
                """), {"h": current_hour, "m": current_minute})

                rows = result.fetchall()
                if not rows:
                    continue

                for row in rows:
                    # Parse days
                    # If JSONB, row.days might be list already. If string, parse it.
                    days_list = row.days
                    if isinstance(days_list, str):
                        try:
                            days_list = json.loads(days_list)
                        except json.JSONDecodeError:
                            days_list = []

                    if current_day in days_list:
                        # TRIGGER ACTION
                        # action_type: OPEN / CLOSE
                        cmd = "daily_drop" if row.action_type in [
                            'CLOSE', 'DROP'] else "daily_raise"

                        logger.info(
                            f"⏰ Executing Schedule #{row.id}: {cmd} for {row.device_id}")

                        payload = json.dumps({"command": cmd})
                        topic = f"system/{row.device_id}/schedule_command"
                        mqtt_client.publish(topic, payload, qos=1)

                        # Log to command queue
                        conn.execute(text("""
                            INSERT INTO command_queue (device_id, action, status)
                            VALUES (:did, :act, 'SENT_SCHEDULER')
                        """), {"did": row.device_id, "act": "SCHEDULER_" + row.action_type})
                        conn.commit()

        except Exception as e:
            logger.error(f"❌ Scheduler monitor error: {e}")
            time.sleep(5)  # Prevent tight loop on error


if __name__ == "__main__":
    try:
        # Wait for DB to be ready
        time.sleep(3)

        # Start background database worker thread
        db_thread = Thread(target=database_worker_thread, daemon=True)
        db_thread.start()
        logger.info("🚀 FloodGate Worker started")

        # Setup MQTT client
        client = mqtt.Client()
        client.on_connect = on_connect
        client.on_message = on_message

        logger.info("⏳ Connecting to MQTT Broker...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)

        # Start fail-safe monitor thread
        fs_thread = Thread(target=fail_safe_monitor_thread,
                           args=(client,), daemon=True)
        fs_thread.start()
        logger.info("⏱️  Fail-safe monitor started")

        # Start connection timeout monitor thread
        ct_thread = Thread(target=connection_timeout_monitor, daemon=True)
        ct_thread.start()
        logger.info("📡 Connection timeout monitor started")

        # Start Scheduler monitor thread
        sch_thread = Thread(target=schedule_monitor_thread,
                            args=(client,), daemon=True)
        sch_thread.start()
        logger.info("📅 Scheduler monitor started")

        client.loop_forever()

    except KeyboardInterrupt:
        logger.info("🛑 Worker shutting down...")
    except Exception as e:
        logger.critical(f"💥 Critical error: {e}")
