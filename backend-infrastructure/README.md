# Backend Infrastructure Setup

## Stack Overview

- **TimescaleDB** (PostgreSQL 15): Time-series database on port 5434
- **Eclipse Mosquitto**: MQTT broker on ports 1883 (TCP) and 9001 (WebSockets)
- **pgAdmin4**: Database management UI on port 5050

## Prerequisites

1. **Docker Desktop must be running** on Windows
2. Ensure ports 5434, 1883, 9001, and 5050 are available

## Quick Start

### 1. Start Docker Desktop

- Launch Docker Desktop application
- Wait for it to fully initialize (Docker icon in system tray should be green)

### 2. Start Infrastructure Stack

```powershell
cd backend-infrastructure
docker-compose up -d
```

### 3. Verify Services

```powershell
# Check all containers are running
docker ps

# Expected output should show several containers:
# - floodgate_db (timescaledb)
# - floodgate_mqtt (mosquitto)
# - floodgate_pgadmin (pgadmin4)
# - floodgate_api (backend api)
# - floodgate_worker (mqtt worker)
# - floodgate_frontend (frontend dashboard)
```

### 4. Verify Database Initialization

```powershell
# Connect to database and check tables
docker exec -it floodgate_db psql -U postgres -d flood_system -c "\dt"
```

Expected tables:

- `device_telemetry` (hypertable)
- `current_device_state`
- `command_queue`
- `schedules` (automation schedules)

### 5. Access Services

**pgAdmin** (Database UI):

- URL: http://localhost:5050
- Email: admin@admin.com
- Password: admin

**PostgreSQL** (Direct connection):

- Host: localhost
- Port: 5434
- Database: flood_system
- User: postgres
- Password: postgres

**MQTT Broker**:

- TCP: localhost:1883
- WebSocket: ws://localhost:9001

## Useful Commands

### Stop Stack

```powershell
docker-compose down
```

### Stop and Remove Volumes (Full Reset)

```powershell
docker-compose down -v
```

### View Logs

```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f mqtt
```

### Restart Single Service

```powershell
docker-compose restart db
docker-compose restart mqtt
```

## Database Schema

### device_telemetry (Time-Series)

Historical sensor data with TimescaleDB hypertable optimization.

### current_device_state (Device Shadow)

Latest state for each device - optimized for fast API queries.

### command_queue (Command Audit)

Tracks all commands sent to devices with execution status.

### schedules (Automation Schedules)

Configured automation rules for daily gate raise/drop at specific times. Supports day-of-week filtering and safety overrides.

## Troubleshooting

**Port Already in Use:**

```powershell
# Find process using port
netstat -ano | findstr ":5432"
netstat -ano | findstr ":1883"
```

**Database Connection Failed:**

```powershell
# Check if database is ready
docker logs floodgate_db
```

**MQTT Connection Issues:**

```powershell
# Check Mosquitto logs
docker logs floodgate_mqtt
```

## Next Steps

1. Verify all 3 containers are running
2. Connect pgAdmin to the database
3. Proceed to backend API development (FastAPI + SQLAlchemy)
