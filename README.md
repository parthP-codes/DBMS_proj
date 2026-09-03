# Food Delivery Management System

A simple full-stack **DBMS assignment** built from the supplied Chen ER diagram and
requirement document. It demonstrates a relational database with an admin dashboard for
managing every entity.

**Stack:** React + Vite → Express (Node.js) → MySQL

```
React (frontend)  →  Express REST API (backend)  →  MySQL (database)
```

## DBMS concepts demonstrated

| Concept | Where |
|---|---|
| Primary & Foreign keys | every table in `database/schema.sql` |
| One-to-many | Customer→Orders, Restaurant→Menu Items, Restaurant→Orders |
| Many-to-many | Orders ↔ Menu Items (via `ORDER_ITEM`) |
| Weak entity | `ORDER_ITEM` (PK = `Order_ID` + `Item_No`) |
| Recursive relationship | Customer `Refers_To` Customer (`Referred_By` self-FK) |
| ISA specialisation | `PAYMENT` → `CARD_PAYMENT` / `UPI_PAYMENT` / `COD_PAYMENT` |
| CRUD operations | Customers, Restaurants, Menu Items, Agents, etc. |
| Joins / Aggregates | `database/queries.sql` (JOIN, LEFT JOIN, GROUP BY, HAVING, COUNT, SUM, AVG, subquery, self join) |
| Constraints | NOT NULL, UNIQUE, CHECK, DEFAULT, ON DELETE rules |

## Project structure

```
DBMS_proj/
├── database/
│   ├── schema.sql      # CREATE DATABASE + tables + keys + constraints
│   ├── seed.sql        # realistic sample data
│   └── queries.sql     # 15 demonstration queries
├── backend/
│   ├── server.js       # Express app + route mounting
│   ├── db.js           # MySQL connection pool
│   ├── routes/         # one file per entity
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/      # one page per sidebar section
│   │   ├── components/ # Sidebar, Modal, StatusBadge
│   │   ├── api.js      # fetch helper
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Prerequisites

- MySQL 8+ (or MariaDB) running locally
- Node.js 18+

---

## Setup & Run

### 1. Create the database and load data

From the project root, using the MySQL client:

```bash
# 1. Create database + tables
mysql -u root -p < database/schema.sql

# 2. Load sample data
mysql -u root -p < database/seed.sql
```

*(schema.sql already runs `CREATE DATABASE food_delivery`, so no need to create it manually.)*

To try the demonstration queries:

```bash
mysql -u root -p < database/queries.sql
```

### 2. Start the backend (port 5000)

```bash
cd backend
cp .env.example .env      # then edit .env with your MySQL user/password
npm install
npm start
```

The API is now at `http://localhost:5000`.

### 3. Start the frontend (port 5173)

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (default `http://localhost:5173`). The Vite dev server proxies
`/api` calls to the backend automatically.

---

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/customers` | Customer CRUD |
| GET/POST/PUT/DELETE | `/api/restaurants` | Restaurant CRUD |
| GET/POST/PUT/DELETE | `/api/menu-items` | Menu item CRUD + availability |
| GET/POST/PUT | `/api/orders` | List, create (with items + auto total), update status |
| GET | `/api/orders/:id` | One order with its line items |
| GET | `/api/order-items` | All order items (weak entity) |
| GET/POST | `/api/payments` | List; create payment + ISA subtype row |
| GET/POST/PUT | `/api/deliveries` | List, create, update status/agent |
| GET/POST/PUT/DELETE | `/api/agents` | Agent CRUD |
| GET | `/api/agents/:id/deliveries` | Deliveries for one agent |
| GET/POST/DELETE | `/api/reviews` | Reviews (about an order) |
| GET/POST/DELETE | `/api/feedback` | Feedback (about a restaurant) |
| GET/POST | `/api/referrals` | Referral relationships (self join) |
| GET | `/api/dashboard` | Summary counts + revenue |

## Notes

- Order creation runs in a transaction: it inserts the `ORDERS` row, inserts each
  `ORDER_ITEM` with `Subtotal = Quantity × Unit_Price`, and updates the order
  `Total_Amount` — all calculated on the server.
- Payment creation inserts the common `PAYMENT` row plus the matching subtype
  (`CARD_PAYMENT` / `UPI_PAYMENT` / `COD_PAYMENT`) in one transaction.
- All SQL uses **parameterized queries**.
- This is a college demo — no real payment processing, auth, or deployment tooling.
