# EV Smart Route & Charging Assistant — Complete Technical Documentation

This document provides a full overview of the project architecture, including class structures, database relationships, and core workflows.

---

## 1. Class Diagram (System Architecture)
Visualizes the object-oriented structure and inheritance patterns.

```mermaid
classDiagram
    class User {
        +int id
        +string username
        +string email
        +string role
        +boolean is_verified
        +datetime created_at
        +login()
        +register()
        +updateProfile()
    }

    class Owner {
        +list stations
        +verifyStation()
        +manageBookings()
    }

    class Admin {
        +list all_users
        +list all_stations
        +approveOwner()
        +viewAnalytics()
    }

    class ChargingStation {
        +int id
        +string name
        +string address
        +string city
        +string connector_type
        +float power_kw
        +string availability
        +boolean is_verified
        +int owner_id
        +getLiveStatus()
        +calculateWaitTime()
    }

    class Connector {
        +int id
        +int station_id
        +string type
        +float power
        +float price_per_kwh
        +status
    }

    class Booking {
        +int id
        +int station_id
        +int user_id
        +datetime start_time
        +datetime end_time
        +string status
        +float total_price
        +cancel()
        +complete()
    }

    class Vehicle {
        +int id
        +int user_id
        +string name
        +float battery_capacity
        +float efficiency
    }

    class StationReview {
        +int id
        +string station_id
        +int user_id
        +int rating
        +string comment
    }

    User <|-- Owner : Inheritance
    User <|-- Admin : Inheritance
    
    User "1" -- "*" Booking : makes
    User "1" -- "*" Vehicle : owns
    User "1" -- "*" StationReview : writes
    
    Owner "1" -- "*" ChargingStation : manages
    
    ChargingStation "1" -- "*" Connector : contains
    ChargingStation "1" -- "*" Booking : hosts
    ChargingStation "1" -- "*" StationReview : receives
```

---

## 2. Entity Relationship Diagram (Database Schema)
Shows how data is stored and linked in MySQL.

```mermaid
erDiagram
    USERS ||--o{ CHARGING_STATIONS : owns
    USERS ||--o{ BOOKINGS : "makes"
    USERS ||--o{ VEHICLES : "owns"
    USERS ||--o{ STATION_REVIEWS : "writes"
    
    CHARGING_STATIONS ||--o{ CONNECTORS : "contains"
    CHARGING_STATIONS ||--o{ BOOKINGS : "hosts"
    CHARGING_STATIONS ||--o{ STATION_REVIEWS : "receives"
    
    USERS {
        int id PK
        string username
        string email
        string password
        string role
        boolean is_verified
    }
    
    CHARGING_STATIONS {
        int id PK
        string name
        string address
        float latitude
        float longitude
        int owner_id FK
        boolean is_verified
    }
    
    BOOKINGS {
        int id PK
        int user_id FK
        string station_id FK
        datetime start_time
        datetime end_time
        string status
    }
    
    CONNECTORS {
        int id PK
        int station_id FK
        string type
        float power
    }
```

---

## 3. Use Case Diagram (User Roles)
Defines what each user role can perform within the system.

```mermaid
graph TD
    User((User)) --> SearchStations(Search Stations)
    User --> PlanRoute(Plan EV Route)
    User --> BookSlot(Book Charging Slot)
    User --> AddVehicle(Manage EV Garage)
    
    Owner((Station Owner)) --> User
    Owner --> AddStation(Add Charging Station)
    Owner --> ViewEarnings(Monitor Earnings)
    Owner --> ManageSlots(Manage Station Slots)
    
    Admin((Platform Admin)) --> VerifyOwners(Verify Station Owners)
    Admin --> ViewGlobalStats(Global Analytics)
    Admin --> ManageContent(Manage Platform Data)
```

---

## 4. Sequence Diagram (Core Booking Flow)
The lifecycle of a charging session booking.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (React)
    participant B as Backend (Node.js)
    participant D as Database (MySQL)

    U->>F: Selects Slot & Clicks Book
    F->>B: POST /api/bookings
    B->>D: Check availability for Time Range
    D-->>B: Slot available
    B->>D: INSERT INTO bookings (status='confirmed')
    D-->>B: Success
    B-->>F: Booking Confirmed (201)
    F->>U: Show Confirmation Receipt
    
    Note over B,D: Background worker monitors time
    B->>D: Update status to 'completed' when end_time passes
```
