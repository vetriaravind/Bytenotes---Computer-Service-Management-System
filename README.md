# ByteNotes — Computer Service Center Management System

A full-stack, enterprise-grade Computer Service Center Management System designed to handle end-to-end device repair operations, inventory management, technician assignments, invoice generation, customer communication, and business analytics.

Built with **React.js, Node.js, Express.js, Tailwind CSS, Lucide Icons, and MySQL 8.0**.

---

## 📌 Table of Contents
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [User Roles & Access Control](#-user-roles--access-control)
- [Repair Workflow Lifecycle](#-repair-workflow-lifecycle)
- [Database Architecture (21 Tables)](#-database-architecture-21-tables)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Installation](#-getting-started--installation)
- [Environment Variables](#-environment-variables)
- [Demo Credentials](#-demo-credentials)
- [Security Features](#-security-features)
- [License](#-license)

---

## ✨ Key Features

- **Multi-Role Portals:** Tailored dashboards for Admin, Receptionist, Technician, and Customer.
- **Hardware PIN Encryption:** Device lock codes and passwords encrypted at rest using AES-256-CBC.
- **10-State Repair Lifecycle:** Strict state machine transitions preventing invalid status jumps.
- **Atomic Inventory Control:** Spare parts consumption automatically decrements inventory and records transaction audit trails.
- **Technician Workload Guardrails:** Enforces maximum active ticket limits per technician and tracks assignment reassignments.
- **Quotation & Estimate Gates:** Version-controlled repair estimates requiring explicit customer approval before work proceeds.
- **Automated Billing & Invoices:** Tax calculation, partial payments, advance deposits, and downloadable PDF invoices.
- **Warranty Tracking:** Automated warranty certificate generation (`WAR-YYYYMM-XXXX`) with instant eligibility checks.
- **Executive Analytics:** Live KPI cards and monthly financial trend charts powered by Recharts and parameterized MySQL queries.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│             Frontend (React 18 + Vite)                │
│  Tailwind CSS • Lucide Icons • Recharts • Context API  │
└───────────────────────────┬────────────────────────────┘
                            │ (Axios REST + JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Backend API (Node.js + Express)            │
│  JWT Auth • bcrypt • Multer • AES-256 Crypto • PDF Gen │
└───────────────────────────┬────────────────────────────┘
                            │ (mysql2 Connection Pool)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Database (MySQL 8.0 InnoDB)                │
│    21 Relational Tables • Foreign Keys • Transactions  │
└────────────────────────────────────────────────────────┘
```

---

## 👥 User Roles & Access Control

| Role | Responsibilities | Default Route |
| :--- | :--- | :--- |
| **Admin** | Business oversight, executive analytics, technician assignment/rebalancing, parts catalog, customer registry, user status toggle. | `/admin` |
| **Receptionist** | Walk-in intake, device specs logging, intake damage photos, ticket generation (`BN-2026-XXXX`), estimates, invoice creation, and payment collection. | `/receptionist` |
| **Technician** | Workbench queue, accept/reject assignments with reason, technical diagnosis findings, labor hour logging, spare parts requests, 10-state progression. | `/technician` |
| **Customer** | Account self-service, real-time repair tracker, estimate approval/rejection gate, invoice history & PDF download, warranty lookup, 5-star feedback. | `/customer` |

---

## 🔄 Repair Workflow Lifecycle

The service center enforces a strict 10-state lifecycle:

```text
RECEIVED ──► UNDER_DIAGNOSIS ──► WAITING_FOR_CUSTOMER_APPROVAL ──► IN_PROGRESS ──► QUALITY_CHECK ──► READY_FOR_DELIVERY ──► DELIVERED
   │               │                         │                          │                                              ▲
   ▼               ▼                         ▼                          ▼                                              │
CANCELLED      UNREPAIRABLE              CANCELLED               WAITING_FOR_SPARE_PARTS ──────────────────────────────┘
```

1. **RECEIVED:** Device checked in at front desk; ticket generated.
2. **UNDER_DIAGNOSIS:** Assigned technician inspects hardware and submits diagnostic report.
3. **WAITING_FOR_CUSTOMER_APPROVAL:** Repair quotation drafted; awaiting customer sign-off.
4. **WAITING_FOR_SPARE_PARTS:** Triggered if required components are out of stock.
5. **IN_PROGRESS:** Active hardware replacement, component soldering, or OS servicing.
6. **QUALITY_CHECK:** Functional bench tests and stress testing post-repair.
7. **READY_FOR_DELIVERY:** Device ready for pickup; customer notified.
8. **DELIVERED:** Device collected, invoice settled, and warranty certificate activated.
9. **CANCELLED:** Estimate declined or customer cancelled before disassembly.
10. **UNREPAIRABLE:** Catastrophic failure (e.g. cracked PCB, liquid corrosion) with mandatory explanation.

---

## 🗄️ Database Architecture (21 Tables)

ByteNotes utilizes 21 normalized InnoDB tables in MySQL 8.0:

1. `users` — Authentication credentials, role types, account status.
2. `customers` — Customer contact details, addresses, unique phone indexes.
3. `technicians` — Specialization, workload limits, availability flags.
4. `devices` — Brand, model, serial numbers, hardware specs, encrypted PINs.
5. `device_attachments` — Photos of pre-existing condition and intake damage.
6. `service_requests` — Central repair tickets (`BN-2026-XXXX`).
7. `service_assignments` — Technician assignment history and reassignment trails.
8. `diagnosis_reports` — Technical inspection findings, root causes, estimated hours.
9. `status_history` — Immutable timeline of status changes and user remarks.
10. `repair_estimates` — Quotations with multi-version revision support.
11. `estimate_items` — Itemized charges for spare parts, diagnostic fees, and labor.
12. `suppliers` — Parts vendors, contacts, and lead times.
13. `inventory` — Spare parts catalog, stock levels, unit costs.
14. `stock_transactions` — Audit trail for stock receipts, repair usage, and returns.
15. `repair_parts` — Parts consumed per repair ticket.
16. `invoices` — Tax invoices (`INV-YYYYMM-XXXX`) with subtotal, tax, and balances.
17. `invoice_items` — Detailed invoice line items.
18. `payments` — Settlement records (`PAY-YYYYMM-XXXX`) for cash, cards, and UPI.
19. `notifications` — Role-specific notification queues.
20. `feedback` — Customer ratings (1–5 stars) and post-repair reviews.
21. `warranties` — Warranty certificates (`WAR-YYYYMM-XXXX`) and terms.

---

## 💻 Tech Stack

### Frontend
- **Framework:** React 18 (Vite SPA)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Data Visualization:** Recharts
- **Routing:** React Router DOM v6
- **HTTP Client:** Axios (with Bearer token interceptors)

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js REST API
- **Database Driver:** `mysql2/promise` (Connection Pool)
- **Authentication:** JSON Web Tokens (JWT) & bcryptjs
- **Cryptography:** Node.js `crypto` (AES-256-CBC)
- **File Uploads:** Multer (with MIME validation)

---

## 📂 Project Directory Structure

```text
bytenotes/
├── backend/
│   ├── config/             # Database pool, JWT, and upload configs
│   ├── controllers/        # Express route handlers
│   ├── database/           # schema.sql, seed.sql, initDb.js
│   ├── middleware/         # Auth, RBAC guards, Multer, error handlers
│   ├── models/             # Parameterized SQL data models
│   ├── routes/             # REST API endpoint definitions
│   ├── services/           # PDF invoice generator, notification dispatchers
│   ├── utils/              # AES-256 crypto, ticket number generator
│   ├── uploads/            # Device intake photos and generated invoices
│   ├── .env.example        # Sample environment variables
│   ├── package.json
│   └── server.js           # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/     # Modals, Navbar, Sidebar, StatCards, Badges
│   │   ├── context/        # AuthContext, NotificationContext
│   │   ├── pages/          # Admin, Receptionist, Technician, Customer, Auth
│   │   ├── services/       # Axios API client
│   │   ├── App.jsx         # App router and RBAC guards
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore              # Protects secrets, node_modules, and uploads
└── README.md
```

---

## 🚀 Getting Started & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MySQL Server 8.0](https://dev.mysql.com/downloads/mysql/) running locally or in Docker

---

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/bytenotes.git
cd bytenotes
```

---

### Step 2: Configure Environment Variables

Create `.env` in the `backend/` folder (you can copy from `backend/.env.example`):
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your MySQL credentials:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bytenotes_db
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
```

---

### Step 3: Initialize Database

Run the automated database initializer from the `backend/` directory:
```bash
node database/initDb.js
```
*This creates `bytenotes_db`, runs all schema tables, and populates initial seed records.*

Optional — Run the complete 15-suite end-to-end integration tests:
```bash
node testFullSuite.js
```

---

### Step 4: Install Dependencies & Run Backend

```bash
# Inside backend/
npm install
npm start
```
*Backend runs at:* `http://localhost:5000`  
*Health Check:* `http://localhost:5000/api/health`

---

### Step 5: Install Dependencies & Run Frontend

Open a second terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at:* `http://localhost:5173`

---

## 🔑 Demo Credentials

All pre-configured accounts use the password: **`Password@123`**

| Role | Email / Identifier | Password | Access Highlights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@bytenotes.com` | `Password@123` | Executive KPI cards, Recharts trends, technicians, inventory, user control |
| **Receptionist** | `reception@bytenotes.com` | `Password@123` | Customer intake, device registration, ticket issuance, estimates & payments |
| **Technician** | `rahul.tech@bytenotes.com` | `Password@123` | Assigned workbench, diagnostic logs, spare parts usage, 10-state progression |
| **Customer** | `customer.rahul@example.com` | `Password@123` | Live ticket tracking, estimate approval gate, invoice downloads, feedback |

*You can also click the 1-Click Role Switch buttons on the login page for instant access.*

---

## 🔒 Security Features

1. **Zero Plaintext Hardware Passwords:** Customer lock codes and PINs are encrypted using `AES-256-CBC` with random initialization vectors (IVs) prepended to the ciphertext.
2. **Stateless JWT Authentication:** Access tokens signed with HMAC-SHA256, strictly verified in backend route middleware.
3. **bcrypt Password Hashing:** User passwords hashed with 10 salt rounds before database storage.
4. **Parameterized SQL Queries:** Prevents SQL injection across all models via MySQL2 prepared statements.
5. **Role-Based Guards (RBAC):** Verified independently at both frontend routing boundaries and backend API middleware.
6. **Sensitive File Protection:** `.gitignore` configured to ensure no database passwords, `.env` files, or personal intake photos are committed to version control.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
