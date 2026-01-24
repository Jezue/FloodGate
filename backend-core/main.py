"""
FloodGate Core API
IoT Flood Prevention System - FastAPI Backend
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db, engine
from pydantic import BaseModel
import paho.mqtt.client as mqtt
import logging
import httpx
from datetime import datetime
from typing import Optional
import time
import json
import os

# FloodGate: Structured Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('FloodGate-API')

# Initialize FastAPI
app = FastAPI(
    title="FloodGate Core API",
    description="IoT Flood Prevention System",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MQTT Configuration & Initialization
# ============================================================

mqtt_client = mqtt.Client()
mqtt_connected = False


def on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        logger.info("✅ FastAPI connected to MQTT Broker")
        # Publish default config for known devices on connect
        try:
            # Publish config for ESP32_MAIN_001 (will be fetched from DB in production)
            config_payload = json.dumps({
                "system_mode": "AUTOMATIC",  # Default
                "fail_safe_timeout_min": 5
            })
            client.publish("system/ESP32_MAIN_001/config",
                           config_payload, qos=1, retain=True)
            logger.info("✅ Published default config for ESP32_MAIN_001")
        except Exception as e:
            logger.error(f"❌ Error publishing default config: {e}")
    else:
        mqtt_connected = False
        logger.error(f"❌ MQTT Connection failed with code {rc}")


def on_disconnect(client, userdata, rc):
    global mqtt_connected
    mqtt_connected = False
    if rc != 0:
        logger.warning(f"⚠️  MQTT disconnected unexpectedly: {rc}")


mqtt_client.on_connect = on_connect
mqtt_client.on_disconnect = on_disconnect

try:
    mqtt_host = os.getenv("MQTT_HOST", "localhost")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_client.connect(mqtt_host, mqtt_port, 60)
    mqtt_client.loop_start()
    logger.info("🔌 MQTT Client initialized")
except Exception as e:
    logger.error(f"❌ Failed to initialize MQTT: {e}")
    mqtt_connected = False

# ============================================================
# Rate Limiting (Simple Token Bucket)
# ============================================================


class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        if client_id not in self.requests:
            self.requests[client_id] = []

        # Remove old requests
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window_seconds
        ]

        if len(self.requests[client_id]) < self.max_requests:
            self.requests[client_id].append(now)
            return True
        return False


rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

# ============================================================
# Weather API Integration (Open-Meteo)
# ============================================================


async def fetch_current_weather(latitude: float = 52.22, longitude: float = 21.01) -> tuple[float, float]:
    """
    Fetch current weather data from Open-Meteo API.
    Returns: (temperature: float, precipitation: float)
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,precipitation"
            }

            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # Extract raw weather data for display
            current_data = data.get("current", {})
            temperature = current_data.get("temperature_2m", 0.0)
            precipitation = current_data.get("precipitation", 0.0)

            logger.debug(f"✅ Weather API: temp={temperature}°C, precip={precipitation}mm")
            return temperature, precipitation

    except httpx.TimeoutException:
        logger.warning("⚠️  Weather API timeout, returning safe defaults")
        return 0.0, 0.0
    except Exception as e:
        logger.error(f"❌ Weather API error: {e}")
        return 0.0, 0.0

# ============================================================
# Pydantic Models
# ============================================================


class TelemetryData(BaseModel):
    water_sensor_status: int
    curtain_state: int
    battery_soc_perc: int
    water_level_cm: int = 0


class LogicState(BaseModel):
    current_mode: str
    current_state_code: int
    fail_safe_deadline: Optional[str]


class WeatherData(BaseModel):
    temperature_celsius: float
    precipitation_mm: float


class SystemStatusResponse(BaseModel):
    device_id: str
    connection_status: str
    telemetry: TelemetryData
    logic: LogicState
    weather: WeatherData
    last_seen: Optional[str] = None


class CommandRequest(BaseModel):
    device_id: str
    action: str


class HealthResponse(BaseModel):
    status: str
    mqtt_connected: bool
    database_connected: bool
    timestamp: str


class UserSettings(BaseModel):
    city: str = "Warszawa"
    fail_safe_timeout_min: int = 5

# ============================================================
# API Endpoints
# ============================================================


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "status": "FloodGate API Online",
        "version": "1.0.0"
    }


@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    System health check endpoint
    Returns: MQTT connection status, database connectivity
    """
    db_connected = False
    try:
        await db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        logger.error(f"❌ Database health check failed: {e}")

    status_code = "healthy" if (
        mqtt_connected and db_connected) else "degraded"
    http_status = 200 if status_code == "healthy" else 503

    response = {
        "status": status_code,
        "mqtt_connected": mqtt_connected,
        "database_connected": db_connected,
        "timestamp": datetime.utcnow().isoformat()
    }

    return JSONResponse(content=response, status_code=http_status)


@app.get("/api/v1/settings", response_model=UserSettings, tags=["Settings"])
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get user settings from database"""
    try:
        # Get City
        res_city = await db.execute(
            text("SELECT city FROM user_settings ORDER BY id DESC LIMIT 1")
        )
        city_row = res_city.fetchone()
        city = city_row.city if city_row else "Warszawa"

        # Get Timeout (Global System Config)
        res_timeout = await db.execute(
            text("SELECT value FROM system_config WHERE key = 'fail_safe_timeout_min'")
        )
        timeout_row = res_timeout.fetchone()
        timeout = int(timeout_row.value) if timeout_row else 5

        return UserSettings(city=city, fail_safe_timeout_min=timeout)

    except Exception as e:
        logger.error(f"❌ Error fetching settings: {e}")
        return UserSettings(city="Warszawa", fail_safe_timeout_min=5)


@app.put("/api/v1/settings", response_model=UserSettings, tags=["Settings"])
async def update_settings(settings: UserSettings, db: AsyncSession = Depends(get_db)):
    """Update user settings in database"""
    try:
        await db.execute(
            text("""
                INSERT INTO user_settings (id, city, updated_at)
                VALUES (1, :city, NOW())
                ON CONFLICT (id) DO UPDATE
                SET city = EXCLUDED.city, updated_at = NOW()
            """),
            {"city": settings.city}
        )

        await db.execute(text("""
            INSERT INTO system_config (key, value)
            VALUES ('fail_safe_timeout_min', :timeout)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        """), {"timeout": str(settings.fail_safe_timeout_min)})

        await db.execute(text("""
            UPDATE current_device_state
            SET fail_safe_timeout_min = :timeout
        """), {"timeout": settings.fail_safe_timeout_min})

        await db.commit()

        # Publish MQTT config to all devices
        if mqtt_connected:
            result = await db.execute(text("SELECT device_id, current_mode FROM current_device_state"))
            devices = result.fetchall()
            for device in devices:
                device_id, mode = device[0], device[1]
                config_payload = json.dumps({
                    "system_mode": mode or "AUTOMATIC",
                    "fail_safe_timeout_min": settings.fail_safe_timeout_min
                })
                mqtt_client.publish(
                    f"system/{device_id}/config",
                    config_payload,
                    qos=1,
                    retain=True
                )
            logger.info(
                f"✅ Config published to {len(devices)} device(s) via MQTT")

        logger.info(
            f"✅ Settings updated: city={settings.city}, timeout={settings.fail_safe_timeout_min}")
        return settings

    except Exception as e:
        logger.error(f"❌ Error updating settings: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings"
        )


class ModeChangeRequest(BaseModel):
    device_id: str = "ESP32_MAIN_001"
    mode: str  # "AUTOMATIC" or "MANUAL"


@app.post("/api/v1/mode", tags=["Device"])
async def change_system_mode(req: ModeChangeRequest, db: AsyncSession = Depends(get_db)):
    """
    Change system mode (AUTOMATIC/MANUAL) for a device
    Publishes retained MQTT config message
    """
    # Validate mode
    if req.mode not in ["AUTOMATIC", "MANUAL", "KONTROLA"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mode. Must be AUTOMATIC or MANUAL"
        )

    try:
        # Update database
        await db.execute(text("""
            UPDATE current_device_state
            SET current_mode = :mode
            WHERE device_id = :did
        """), {"mode": req.mode, "did": req.device_id})
        await db.commit()

        # Fetch current timeout from DB
        result = await db.execute(text("""
            SELECT fail_safe_timeout_min FROM current_device_state
            WHERE device_id = :did
        """), {"did": req.device_id})
        row = result.fetchone()
        timeout_min = row[0] if row else 5

        # Publish retained MQTT config
        if mqtt_connected:
            config_payload = json.dumps({
                "system_mode": req.mode,
                "fail_safe_timeout_min": timeout_min
            })
            mqtt_client.publish(
                f"system/{req.device_id}/config",
                config_payload,
                qos=1,
                retain=True
            )
            logger.info(
                f"✅ Mode changed to {req.mode} for {req.device_id}, config published (retained)")
        else:
            logger.warning(
                "⚠️  Mode changed but MQTT offline, config not published")

        return {"status": "ok", "mode": req.mode, "device_id": req.device_id}

    except Exception as e:
        logger.error(f"❌ Error changing mode: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change system mode"
        )


@app.get("/api/v1/status/{device_id}", response_model=SystemStatusResponse, tags=["Device"])
async def get_status(device_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get device status with telemetry and weather data
    Rate limited to 100 requests per minute per device
    """
    # Rate limiting
    if not rate_limiter.is_allowed(device_id):
        logger.warning(f"⚠️  Rate limit exceeded for {device_id}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: 100 requests per minute"
        )

    try:
        # Get device state
        result = await db.execute(
            text("SELECT * FROM current_device_state WHERE device_id = :did"),
            {"did": device_id}
        )
        row = result.fetchone()

        # Get weather data (with fallback)
        temperature, precipitation = await fetch_current_weather()

        if not row:
            logger.info(
                f"ℹ️  Device {device_id} not found, returning defaults")
            return SystemStatusResponse(
                device_id=device_id,
                connection_status="OFFLINE",
                telemetry=TelemetryData(
                    water_sensor_status=0,
                    curtain_state=0,
                    battery_soc_perc=0,
                    water_level_cm=0
                ),
                logic=LogicState(
                    current_mode="UNKNOWN",
                    current_state_code=0,
                    fail_safe_deadline=None
                ),
                weather=WeatherData(
                    temperature_celsius=temperature,
                    precipitation_mm=precipitation
                )
            )

        logger.debug(f"✅ Retrieved status for {device_id}")
        return SystemStatusResponse(
            device_id=row.device_id,
            connection_status=row.connection_status,
            last_seen=row.last_seen.isoformat() if row.last_seen else None,
            telemetry=TelemetryData(
                water_sensor_status=row.water_sensor_status,
                curtain_state=row.curtain_state,
                battery_soc_perc=row.battery_soc_perc,
                water_level_cm=getattr(row, "water_level_cm", 0) or 0
            ),
            logic=LogicState(
                current_mode=row.current_mode or "AUTOMATIC",
                current_state_code=getattr(row, "current_state_code", 0) or 0,
                fail_safe_deadline=getattr(row, "fail_safe_deadline", None).isoformat(
                ) if getattr(row, "fail_safe_deadline", None) else None
            ),
            weather=WeatherData(
                temperature_celsius=temperature,
                precipitation_mm=precipitation
            )
        )

    except Exception as e:
        logger.error(f"❌ Error fetching status for {device_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch device status"
        )


@app.post("/api/v1/command", tags=["Device"])
async def send_command(cmd: CommandRequest, db: AsyncSession = Depends(get_db)):
    """
    Send command to device (DROP, RAISE, ACCEPT_ALARM, etc)
    Validates MQTT connection before publishing
    """
    # Check MQTT connection
    if not mqtt_connected:
        logger.error(
            f"❌ MQTT not connected, rejecting command for {cmd.device_id}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT Broker disconnected. Please try again later."
        )

    # Rate limiting
    if not rate_limiter.is_allowed(cmd.device_id):
        logger.warning(f"⚠️  Command rate limit exceeded for {cmd.device_id}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: 100 commands per minute"
        )

    try:
        await db.execute(text("""
            INSERT INTO command_queue (device_id, action, status)
            VALUES (:did, :act, 'SENT')
        """), {"did": cmd.device_id, "act": cmd.action})
        await db.commit()

        # Publish command to MQTT
        topic = f"system/{cmd.device_id}/user_command"

        # Map API actions to ESP32 commands
        action_map = {
            "DROP": "force_drop",
            "RAISE": "force_raise"
        }
        esp_command = action_map.get(cmd.action, cmd.action.lower())
        payload = json.dumps({"command": esp_command})

        result = mqtt_client.publish(topic, payload, qos=1)

        if result.rc != 0:
            logger.error(f"❌ MQTT publish failed: {result.rc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to publish command to MQTT"
            )

        logger.info(f"✅ Command '{cmd.action}' sent to {cmd.device_id}")
        return {
            "status": "Command Sent",
            "action": cmd.action,
            "device_id": cmd.device_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Error sending command to {cmd.device_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send command"
        )


@app.post("/api/v1/user/action", tags=["Device"])
async def user_action(cmd: CommandRequest, db: AsyncSession = Depends(get_db)):
    """
    User manual commands (force_raise, force_drop, cancel_action, manual_drop)
    Priority: USER > ALARM > SCHEDULER
    """
    if not mqtt_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT Broker disconnected"
        )

    try:
        # Log to database
        await db.execute(text("""
            INSERT INTO command_queue (device_id, action, status)
            VALUES (:did, :act, 'SENT')
        """), {"did": cmd.device_id, "act": cmd.action})
        await db.commit()

        # Publish to user_command topic (highest priority)
        payload = json.dumps({"command": cmd.action})
        topic = f"system/{cmd.device_id}/user_command"
        result = mqtt_client.publish(topic, payload, qos=1)

        if result.rc != 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to publish user command"
            )

        # OPTIMISTIC STATE UPDATE (Fix for Popup persistence in simulation)
        # Transition out of State 4 (Fail-Safe) immediately
        if cmd.action in ['manual_drop', 'force_drop']:
            await db.execute(text("""
                UPDATE current_device_state
                SET curtain_state = 1, current_state_code = 3, fail_safe_deadline = NULL
                WHERE device_id = :did
            """), {"did": cmd.device_id})
        elif cmd.action in ['cancel_action', 'force_raise']:
            await db.execute(text("""
                UPDATE current_device_state
                SET current_state_code = 3, fail_safe_deadline = NULL
                WHERE device_id = :did
            """), {"did": cmd.device_id})

        await db.commit()

        logger.info(f"✅ User action '{cmd.action}' sent to {cmd.device_id}")
        return {
            "status": "User Action Sent",
            "action": cmd.action,
            "device_id": cmd.device_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Error sending user action: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send user action"
        )


@app.get("/api/v1/config/enums", tags=["System"])
async def get_enums():
    """
    Get system enums for synchronization with frontend
    Ensures type consistency across layers
    """
    enums = {
        "WaterSensorStatus": {
            "OK": 0,
            "DETECTED": 1
        },
        "CurtainState": {
            "UP": 0,
            "DOWN": 1,
            "MOVING": 2,
            "ERROR": 3
        },
        "SystemMode": {
            "AUTOMATIC": "AUTOMATIC",
            "KONTROLA": "KONTROLA",
            "MANUAL": "MANUAL"
        },
        "SystemStateCode": {
            "STANDBY_OK": 0,
            "LOW_BATTERY": 1,
            "PRE_ALARM_WEATHER": 2,
            "ALARM_WATER": 3,
            "CONTROL_WAITING": 4,
            "FAIL_SAFE_ACTION": 5,
            "MANUAL": 6,
            "ACTUATOR_ERROR": 7
        }
    }
    logger.debug("✅ Served enum definitions")
    return enums


@app.get("/api/v1/devices", tags=["Device"])
async def list_devices(db: AsyncSession = Depends(get_db)):
    """
    List all known devices
    Supports multi-device setups
    """
    try:
        result = await db.execute(
            text("""
                SELECT device_id, connection_status, last_seen, battery_soc_perc, current_mode
                FROM current_device_state
                ORDER BY last_seen DESC
            """)
        )
        devices = [dict(row._mapping) for row in result.fetchall()]

        # Convert datetime to ISO format
        for device in devices:
            if device['last_seen']:
                device['last_seen'] = device['last_seen'].isoformat()

        logger.info(f"✅ Listed {len(devices)} devices")
        return {"devices": devices}

    except Exception as e:
        logger.error(f"❌ Error listing devices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list devices"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(f"💥 Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# ============================================================
# SCHEDULER IMPLEMENTATION
# ============================================================

class ScheduleCreate(BaseModel):
    device_id: str
    action_type: str  # 'OPEN' | 'CLOSE'
    custom_label: str
    hour: int
    minute: int
    days: list[int]  # [1, 2, 3, 4, 5, 6, 7] - 1=Mon, 7=Sun
    active: bool = True


class ScheduleResponse(ScheduleCreate):
    id: int


@app.on_event("startup")
async def startup_event():
    """Ensure database tables exist on startup"""
    try:
        async with engine.begin() as conn:
            # Create schedules table if not exists (PostgreSQL)
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS schedules (
                    id SERIAL PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    custom_label TEXT,
                    hour INT NOT NULL,
                    minute INT NOT NULL,
                    days JSONB NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
            logger.info("✅ Database tables checked/created")
    except Exception as e:
        logger.error(f"❌ Database startup error: {e}")


@app.post("/api/v1/schedules", response_model=ScheduleResponse, tags=["Scheduler"])
async def create_schedule(schedule: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new schedule"""
    try:
        # Validate inputs
        if schedule.action_type not in ['OPEN', 'CLOSE', 'DROP', 'RAISE']:
            raise HTTPException(400, "Invalid action_type")
        if not (0 <= schedule.hour <= 23) or not (0 <= schedule.minute <= 59):
            raise HTTPException(400, "Invalid time")

        # Normalize action type
        normalized_action = 'CLOSE' if schedule.action_type in [
            'CLOSE', 'DROP'] else 'OPEN'

        # Convert list to JSON string for DB
        days_json = json.dumps(schedule.days)

        result = await db.execute(text("""
            INSERT INTO schedules (device_id, action_type, custom_label, hour, minute, days, active)
            VALUES (:did, :type, :label, :hour, :min, :days, :active)
            RETURNING id
        """), {
            "did": schedule.device_id,
            "type": normalized_action,
            "label": schedule.custom_label,
            "hour": schedule.hour,
            "min": schedule.minute,
            "days": days_json,
            "active": schedule.active
        })
        await db.commit()

        new_id = result.fetchone()[0]
        return {**schedule.dict(), "id": new_id, "action_type": normalized_action}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"❌ Create schedule error: {e}")
        await db.rollback()
        raise HTTPException(500, "Failed to create schedule")


@app.get("/api/v1/schedules", response_model=list[ScheduleResponse], tags=["Scheduler"])
async def get_schedules(db: AsyncSession = Depends(get_db)):
    """List all schedules"""
    try:
        result = await db.execute(text("SELECT * FROM schedules ORDER BY hour, minute"))
        schedules = []
        for row in result.fetchall():
            schedules.append({
                "id": row.id,
                "device_id": row.device_id,
                "action_type": row.action_type,
                "custom_label": row.custom_label,
                "hour": row.hour,
                "minute": row.minute,
                "days": row.days if isinstance(row.days, list) else json.loads(row.days),
                "active": row.active
            })
        return schedules
    except Exception as e:
        logger.error(f"❌ Get schedules error: {e}")
        raise HTTPException(500, "Failed to fetch schedules")


@app.delete("/api/v1/schedules/{id}", tags=["Scheduler"])
async def delete_schedule(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a schedule"""
    try:
        await db.execute(text("DELETE FROM schedules WHERE id = :id"), {"id": id})
        await db.commit()
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"❌ Delete schedule error: {e}")
        await db.rollback()
        raise HTTPException(500, "Failed to delete schedule")


@app.put("/api/v1/schedules/{id}/toggle", tags=["Scheduler"])
async def toggle_schedule(id: int, db: AsyncSession = Depends(get_db)):
    """Toggle schedule active state"""
    try:
        await db.execute(text("""
            UPDATE schedules SET active = NOT active WHERE id = :id
        """), {"id": id})
        await db.commit()
        return {"status": "toggled"}
    except Exception as e:
        logger.error(f"❌ Toggle schedule error: {e}")
        await db.rollback()
        raise HTTPException(500, "Failed to toggle schedule")
