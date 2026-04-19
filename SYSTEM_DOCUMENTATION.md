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
