# 🖥️ FloodGate Dashboard

Web-based management console for the Intelligent Flood Protection System. Built with **React**, **TypeScript**, and **Vite**, featuring a real-time monitoring interface with a focus on UX and rapid response.

## ✨ Features

- **Real-time Monitoring:** Live telemetry stream (Water level, Battery, Gate State).
- **Manual Control:** Immediate override buttons for gate actuation.
- **Fail-Safe Management:** Interactive countdown and alarm acknowledgment.
- **Responsive Design:** Dark-themed, premium UI optimized for desktop and mobile tablets.
- **Scheduler View:** Visualization of configured automated protection rules.

## 🚀 Quick Start

### 1. Requirements

Ensure the **Backend Core** is running on and accessible via `localhost:8001`.

### 2. Environment Setup

```powershell
npm install
```

### 3. Development Mode

```powershell
npm run dev
```

The dashboard will be available at: http://localhost:5173

## 🛠️ Tech Stack

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS / Vanilla CSS
- **Icons:** Lucide-React
- **State Management:** React Hooks (useEffect polling)
- **Data Fetching:** TanStack React Query (polling interval: 5 seconds)

## 🔄 Polling Architecture

The dashboard uses **HTTP Polling** for real-time updates:

```typescript
// In useSystemData.ts - Polling Configuration
refetchInterval: 5000,              // Poll every 5 seconds
refetchIntervalInBackground: true,  // Continue polling when tab unfocused
refetchOnWindowFocus: true,         // Refresh when user returns to tab
networkMode: 'always',              // Retry even if network appears offline
```

**Why Polling Instead of WebSockets?**

- Simplified architecture (no WebSocket server infrastructure)
- Uses existing REST API endpoints
- Works reliably across all network conditions
- Acceptable 5-second refresh delay for flood monitoring use case

**Refresh Behavior:**

- **Normal Operation:** Status fetched every 5 seconds
- **Background Tab:** Continues polling (enabled via `refetchIntervalInBackground`)
- **User Returns to Tab:** Immediate fresh fetch via `refetchOnWindowFocus`
- **Network Reconnect:** Automatic retry with exponential backoff

See [main README: Limitations & Design Decisions](../README.md#-limitations--design-decisions) for trade-off analysis.

## 🐳 Docker Deployment

You can also run the frontend as part of the infrastructure:

```powershell
cd ../backend-infrastructure
docker-compose up -d flood_frontend
```

---

_Part of the Intelligent Flood Protection Engineering Project._
