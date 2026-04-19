# Digital Twin Presentation Guide: TRANSPO HUB

This guide outlines how to perform a high-impact live demonstration of the TRANSPO HUB Digital Twin.

## Prerequisites
- Ensure the Backend is running (`npm start` in `backend`).
- Ensure the Frontend is running (`npm run dev` in `frontend`).
- Open the **Fleet Telemetry** dashboard (`/monitoring`).

---

## Demo Script: "The Resilient Network"

### 1. Baseline: All Systems Nominal
- **Action**: Show the Telemetry map with buses moving smoothly in green.
- **Narrative**: "Here is our Digital Twin of the Kampala regional transit network. We are tracking 12 active units in real-time, syncing telemetry every 5 seconds from the physical fleet (simulated)."

### 2. Scenario A: Energy Emergency
- **Action**: Using the Presentation Control panel, trigger **Simulate Battery Failure**.
- **Observation**: A specific Unit (e.g., UG-402) will turn **Red**, start pulsing, and its status will change to **Critical**. A warning alert will appear in the Live Feed.
- **Narrative**: "Our twin just detected a critical battery drop on Unit UG-402. Notice the immediate visual escalation and the automated system alert. The control room can now dispatch a recovery unit before the bus strands passengers."

### 3. Scenario B: Weather & Traffic Impact
- **Action**: Trigger **Simulate Heavy Traffic** or **Weather Emergency**.
- **Observation**: Multiple units will turn **Amber** (Delayed) and their movement speed will visibly drop. The "On-Time Rate" in the top HUD will decline.
- **Narrative**: "We are now simulating a regional weather event. The Digital Twin reflects the resulting traffic congestion. Observe how the Entire network velocity has been throttled to maintain safety. Our KPIs are updating live to reflect this operational shift."

### 4. Recovery: System Reset
- **Action**: Trigger **System Reset**.
- **Observation**: All markers return to Green/En Route. Alerts are cleared.
- **Narrative**: "Once the event passes, we restore the network to nominal parameters. The Digital Twin provides the audit trail for this entire incident response."

---

## Pro-Tips for Presentation
- **Click a Bus**: Show individual telemetry details (Battery %, exact GPS) to demonstrate data depth.
- **Hover on Hubs**: Show the color-coded status of Namanve, Busega, and Kawempe hubs.
- **Dark Mode**: If presenting in a low-light room, use the system's sleek dark aesthetic for a "Control Room" feel.
