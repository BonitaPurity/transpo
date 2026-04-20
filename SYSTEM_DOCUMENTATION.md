# TRANSPO HUB: System Documentation

## CHAPTER ONE: INTRODUCTION

### 1.0 Introduction
TRANSPO HUB is a next-generation transit logistics and fleet management system designed specifically for the urban and regional transport landscape of Kampala, Uganda. The system integrates real-time fleet telemetry, digital booking manifests, and automated financial reporting into a unified web-based platform. By leveraging a "Digital Twin" simulation approach, TRANSPO HUB provides high-fidelity monitoring and management capabilities without the immediate need for expensive physical hardware, making it an ideal solution for modernizing transit operations.

### 1.1 Background of the Study
The transport sector in Uganda, particularly within the Kampala metropolitan area, has long been characterized by informal operations, lack of centralized scheduling, and non-existent real-time tracking. As the city grows, the demand for efficient, reliable, and transparent transit services has skyrocketed. Furthermore, the global shift toward Green Energy has introduced electric vehicles, such as the Kayoola EVS buses, into the local market. These modern vehicles require sophisticated monitoring systems to track battery health, range, and operational efficiency—capabilities that traditional manual management systems cannot provide.

### 1.2 Problem Statement
Current transit management in Uganda faces several critical challenges:
1. **Lack of Visibility**: Passengers have no way of knowing the exact location or estimated arrival time of buses, leading to long wait times and uncertainty.
2. **Manual Booking Inefficiencies**: Physical ticketing leads to long queues, lost tickets, and difficulty in managing passenger manifests.
3. **Operational Blind Spots**: Fleet managers lack real-time data on vehicle status (e.g., battery levels, speed, and location), making it impossible to respond quickly to emergencies or traffic delays.
4. **Financial Fragmentation**: Manual fare collection is prone to errors and lacks the transparency required for professional auditing and revenue growth.

### 1.3 Purpose of the Study
The purpose of this study is to develop a comprehensive, web-based Transit Management System (TRANSPO HUB) that digitizes the end-to-end transit process. The system aims to bridge the gap between transit operators and passengers by providing a transparent, data-driven environment for booking, tracking, and fleet management.

### 1.4 Objectives

#### 1.4.1 Main Objective
To design and implement a robust transit hub management system that utilizes real-time telemetry simulation to optimize fleet operations and passenger experience in Kampala.

#### 1.4.2 Specific Objectives:
1. To develop a **Real-time Fleet Telemetry** module that simulates GPS movement and vehicle health monitoring.
2. To create a **Digital Booking System** with integrated Mobile Money payment simulation (USSD).
3. To implement an **Admin Scenario Controller** for simulating operational challenges like battery failure and traffic congestion.
4. To design an **Automated Manifest and Reporting** system for financial and operational auditing.

### 1.5 Research Scope

#### 1.5.1 Geographic Scope
The system focuses on the Kampala metropolitan area, specifically targeting three primary regional hubs: Namanve (East), Busega (West), and Kawempe (North).

#### 1.5.2 Time Scope
The development and study were conducted over a period of one academic year, covering requirements gathering, system architecture design, implementation, and simulation testing.

#### 1.5.3 Functional Scope
The system provides dual-portal functionality:
- **Passenger Portal**: Account management, route search, USSD payment simulation, and virtual QR boarding.
- **Admin Portal**: Fleet monitoring (GPS), system-wide statistics, scenario triggering, and manifest exports.

### 1.6 Significance of the Study
This study provides a blueprint for modernizing public transport in developing urban centers. For **Transit Operators**, it offers a cost-effective way to monitor fleet performance. For **Passengers**, it provides reliability and convenience. For **Academic Purposes**, it demonstrates the application of full-stack development and system simulation in solving real-world logistics problems without the need for prohibitive hardware costs.

### 1.7 Conclusion
Chapter One has outlined the foundational aspects of the TRANSPO HUB project, highlighting the urgent need for digital transformation in Kampala's transit sector. By defining clear objectives and scope, the study sets the stage for a technological intervention that is both locally relevant and globally aligned with modern logistics standards.

---

## CHAPTER TWO: LITERATURE REVIEW

### 2.0 Introduction
The literature review explores the evolution of transit management systems, the technologies currently used in global fleet logistics, and the specific gaps existing in the local Ugandan market.

### 2.1 Background of Similar Platforms
Globally, Transit Management Systems (TMS) have evolved from simple scheduling tools to complex ecosystems powered by the Internet of Things (IoT) and Big Data. Platforms like **Uber** and **Lyft** revolutionized personal transit by providing real-time visibility. In the commercial bus sector, platforms such as **Greyhound (USA)** and **FlixBus (Europe)** have set the standard for digital booking and real-time fleet coordination.

### 2.2 The evolution and development of similar platforms
Historically, transit systems relied on "Static Scheduling," where routes and times were fixed and tracked on paper. The introduction of GPS in the 1990s led to "Dynamic Tracking," allowing dispatchers to see vehicle locations. Today, we are in the era of "Intelligent Transit," where AI predicts arrival times and "Digital Twins" simulate entire networks to optimize energy consumption—a feature particularly vital for the electric bus fleets that TRANSPO HUB aims to support.

### 2.3 Existing related platforms
In the East African context, several platforms have attempted to solve transport challenges:
1. **SafeBoda/Uber/Bolt**: Excellent for point-to-point personal transport but lack the infrastructure for large-scale regional bus hub management.
2. **Ka-Chapa/Local Booking Apps**: Some bus companies have introduced basic Android apps for booking, but these often lack real-time tracking and integrated fleet telemetry.
3. **M-Pesa/MTN Mobile Money**: While these have revolutionized payments, they are often used as standalone tools rather than integrated components of a transit manifest system.

TRANSPO HUB distinguishes itself by combining **Fleet Telemetry** (monitoring the bus health) with **Passenger Logistics** (the booking and boarding process) into a single, simulated environment.

### 2.4 Conclusion
The literature review confirms that while the technology for advanced transit management exists globally, there is a significant lack of integrated, telemetry-focused platforms designed for the unique challenges of the Ugandan regional bus sector. TRANSPO HUB addresses this gap by providing an all-in-one simulation-ready solution.

---

## CHAPTER THREE: TECHNICAL ARCHITECTURE

### 3.0 Introduction
This chapter details the technical implementation of TRANSPO HUB, focusing on its production-ready architecture, high-availability data layer, and containerized deployment strategy.

### 3.1 Data Layer: PostgreSQL Migration
TRANSPO HUB utilizes **PostgreSQL** as its core relational database. This transition from earlier development-stage databases provides the following advantages:
1. **Concurrency**: PostgreSQL handles multiple simultaneous connections, essential for real-time fleet telemetry sync.
2. **Data Integrity**: Robust foreign key constraints and transactional integrity for financial bookings.
3. **Asynchronous I/O**: The backend uses the `pg` driver with an `async/await` pattern, ensuring non-blocking performance during high-traffic periods.

#### 3.1.1 Automated Schema Casing Migration
The system includes an automated migration logic within the `initDb()` process. This logic detects and renames unquoted database columns to maintain **camelCase** consistency across the JavaScript application layer, ensuring long-term maintainability.

### 3.2 Real-Time Nexus (WebSocket)
The system employs **Socket.io** to create a "Real-Time Nexus" between the buses and the dashboard. 
- **Telemetry Frequency**: Every 2 seconds, fleet simulation nodes broadcast GPS and battery state.
- **Dynamic Updates**: Changes in bus position are pushed to all active monitoring clients without page refreshes.

### 3.3 Infrastructure and Deployment
The platform is designed for cross-platform deployment using containerization:
- **Docker Compose**: Orchestrates three primary services: `frontend` (Next.js), `backend` (Express), and `db` (PostgreSQL).
- **Render Blueprints**: The project includes a `render.yaml` configuration for automated, production-grade deployment on Render, including managed database provisioning and environment wiring.

### 3.4 Security and Resilience
- **JWT Authentication**: Secure transport for all administrative and user sessions.
- **CSP Headers**: Configured using **Helmet** to support external map providers (Leaflet/OSM) while preventing cross-site scripting.
- **Rate Limiting**: Backend protection against API abuse and brute-force attempts.

### 3.5 Conclusion
The technical architecture of TRANSPO HUB is built for scalability and reliability. By combining modern PostgreSQL capabilities with real-time WebSocket communication, the system provides a robust platform for modernizing transit logistics in Uganda.

---

## CHAPTER FOUR: SYSTEMS ANALYSIS AND REQUIREMENTS COLLECTION

### 4.1 Introduction
The Systems Analysis phase for TRANSPO HUB involved a comprehensive evaluation of the existing transit landscape in Uganda. This phase was critical for understanding how digital interventions could replace manual workflows and where the "Digital Twin" methodology could provide the most value in fleet management and passenger safety.

### 4.2 Description of the Current System
The legacy transit system in Uganda operates primarily through decentralized, manual coordination. Bus operators rely on physical ledgers for booking, and fleet tracking is conducted via intermittent phone calls between dispatchers and drivers.

#### 4.2.1 Strengths of the Current System
- **Operational Familiarity**: Staff are well-versed in manual record-keeping, requiring no technical literacy.
- **Low Infrastructure Dependency**: The system functions without the need for high-speed internet or constant power supply.
- **Human Flexibility**: Manual systems can easily accommodate "last-minute" changes or cash-based transactions without rigid system validation.

#### 4.2.2 Weaknesses of the Current System
- **Zero Visibility**: Neither passengers nor managers have real-time data on bus locations, leading to massive delays and "ghost" departures.
- **Revenue Leakage**: Paper tickets are difficult to audit, making it easy for fares to be mismanaged or lost.
- **Fleet Neglect**: Without real-time telemetry, vehicle health issues (like low battery in electric buses) are only discovered after a breakdown occurs.
- **Inaccurate Manifests**: Manual lists are often incomplete, posing security risks during travel and making luggage tracking nearly impossible.

### 4.3 Requirements of the New System
Based on the analysis, the following requirements were established for TRANSPO HUB:

#### 4.3.1 User Requirements
- **Passengers**: Ability to view live bus positions, book seats digitally, and receive trip notifications.
- **Admin/Managers**: A centralized dashboard to monitor all hubs, approve fleet vehicles, and trigger operational scenarios.
- **Logistics Personnel**: Tools to track the journey of parcels and deliveries from origin to destination.

#### 4.3.2 Functional Requirements
- **Real-time Telemetry Sync**: The system must update bus GPS and battery status every 2 seconds via WebSockets.
- **Secure Authentication**: Implementation of JWT-based login for all user roles.
- **Digital Manifest Generation**: Automatic creation of PDF/CSV manifests for every departure.
- **Simulation Controller**: An interface to simulate "Real-world Challenges" (e.g., battery failure, traffic) to test system resilience.

#### 4.3.3 Non-Functional Requirements
- **Data Integrity**: Use of a relational database (PostgreSQL) to ensure zero data loss during concurrent bookings.
- **Responsive UI**: The frontend must be accessible on both desktop (for admins) and mobile (for passengers).
- **Production Resilience**: Implementation of CORS policies and security headers to protect against external threats.

#### 4.3.4 System Requirements
- **Server-side**: Node.js environment, Express framework, and PostgreSQL database.
- **Client-side**: Next.js (React) framework with Tailwind CSS.
- **Hosting**: Render cloud platform for managed database and web service hosting.

### 4.4 Chapter Summary
This chapter highlighted the stark contrast between the inefficient manual systems currently in use and the data-driven requirements of TRANSPO HUB. By focusing on real-time visibility and data integrity, the proposed system addresses the core bottlenecks of Ugandan transit.

---

## CHAPTER FIVE: SYSTEM DESIGN, IMPLEMENTATION, TESTING AND VALIDATION

### 5.1 Introduction
This chapter focuses on the architectural transformation of requirements into a functional software product. It details the data structures, the logic flow, and the validation methods used to ensure the system is production-ready.

### 5.2 System Design Using Data Flow Diagrams
The data flow in TRANSPO HUB is designed for low latency and high consistency.

#### 5.2.1 Context Diagram
Users (Passengers and Admins) interact with the **TRANSPO Frontend**. The frontend sends requests to the **TRANSPO Backend**, which manages data persistence in the **PostgreSQL Database** and broadcasts real-time updates via **Socket.io**.

#### 5.2.2 Level 0 Diagram
The core processes include:
1. **Authentication**: Validating user credentials and issuing JWTs.
2. **Telemetry Broadcast**: Backend receiving simulated GPS data and pushing it to the map.
3. **Booking Engine**: Managing seat reservations and updating manifests.
4. **Delivery Pipeline**: Tracking cargo status from "Pending" to "Arrived".

### 5.3 System Design Using Entity-Relationship Diagrams
The database is structured to support a multi-tenant hub environment.

#### 5.3.1 Identified Entities and their Attributes
- **Users**: `id`, `name`, `email`, `password_hash`, `role` (Admin/User).
- **Buses**: `tag`, `hub_id`, `status` (Active/En Route), `battery_level`, `gps_coords`.
- **Schedules**: `route_id`, `departure_time`, `bus_type`, `price`.
- **Bookings**: `user_id`, `schedule_id`, `travel_date`, `payment_status`.

#### 5.3.2 Entity Diagram
The `hubs` entity serves as the root, connecting to multiple `schedules` and `buses`. `Schedules` generate `departures`, which are then linked to individual passenger `bookings`.

### 5.4 Database Design
The system uses **PostgreSQL** with a specialized storage layer defined in `pg-store.js`.

#### 5.4.1 Database Tables
- `entity_docs`: A high-performance table storing the current state of all entities in JSONB format.
- `entity_backups`: An audit table that keeps history of every state change for recovery and reporting.

#### 5.4.2 Data Descriptions
All financial data is stored as `Numeric` to avoid floating-point errors, and all timestamps use `TIMESTAMPTZ` to ensure timezone consistency across regional operations.

### 5.5 System Implementation
TRANSPO HUB is implemented as a production-grade web application. The backend uses **Express.js** for its REST API, while the frontend is built with **Next.js** for optimal performance.

#### 5.5.1 System Graphical User Interfaces
- **Admin Dashboard**: A high-level view of revenue, active buses, and system alerts.
- **Digital Twin Map**: A real-time Leaflet.js map showing animated bus icons moving along Kampala's routes.
- **Logistics Portal**: A dedicated view for managing and searching for deliveries using tracking codes.

#### 5.5.2 Sample Code
The following snippet from `index.js` illustrates the robust CORS and security configuration required for production deployment:
```javascript
const corsOptions = {
  origin(origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
```

### 5.6 System Testing and Validation
#### 5.6.1 System Testing
The system underwent rigorous testing:
- **Unit Testing**: Jest was used to test individual functions like `createUser` and `findUserByEmail` in `db-json.js`.
- **Integration Testing**: Testing the flow from a frontend booking request to its persistence in PostgreSQL.
- **Stress Testing**: Simulating multiple concurrent WebSocket connections to ensure the telemetry broadcast remains stable.

#### 5.6.2 System Validation
Validation was performed by comparing the "Digital Twin" state against expected operational logic. For example, triggering a "Battery Critical" scenario in the Admin portal was validated by ensuring all passenger clients received an immediate alert notification and saw the bus icon change color on their maps.

### 5.7 Chapter Summary
Chapter Five detailed the technical realization of the project. By utilizing a robust design and comprehensive testing, the system ensures that the digital simulation accurately reflects real-world transit logic.

---

## CHAPTER 6: DISCUSSION, RECOMMENDATIONS, AND CONCLUSION

### 6.1 Introduction
This final chapter synthesizes the results of the project, evaluates its impact on the transport sector, and proposes future enhancements.

### 6.2 Discussion
The development of TRANSPO HUB proves that a "Digital Twin" approach can significantly modernize transit operations in a cost-effective manner. The system successfully addressed the "Operational Blind Spots" identified in Chapter One. By providing real-time data on battery levels and GPS locations, the platform enables a proactive management style that was previously impossible in Uganda.

### 6.3 Recommendations
- **Hardware Integration**: Transition from simulated telemetry to real IoT GPS/Battery sensors installed on the Kayoola EVS fleet.
- **Native Mobile Apps**: Developing specialized Android/iOS apps for drivers to provide offline navigation and more accurate location pings.
- **Predictive Maintenance**: Implementing machine learning algorithms to predict when a bus might fail based on historical telemetry patterns.

### 6.4 Limitations of the Study
- **Connectivity Dependency**: The system's real-time features rely heavily on 4G/5G availability, which can be inconsistent in some rural parts of Uganda.
- **Hardware Cost**: While the software is cost-effective, the physical sensors required for real-world implementation pose a financial barrier for smaller operators.

### 6.5 Area for Further Research
Future research should explore **Smart Grid Integration**, where the TRANSPO HUB system communicates with electric charging stations to automatically reroute buses to the nearest available charger based on their current battery telemetry.

### 6.6 Conclusion
TRANSPO HUB successfully bridges the gap between traditional transport and modern logistics. By digitizing manifests, tracking fleet health, and providing a transparent booking experience, the system offers a viable pathway for the digital transformation of Uganda's public transport sector. The project stands as a testament to the power of full-stack development in solving critical infrastructure challenges.
