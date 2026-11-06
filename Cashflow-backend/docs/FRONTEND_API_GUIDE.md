# Flowback Cashflow API - Frontend Developer Guide

> **Base URL**: `http://localhost:5000` (development) | `https://api.flowback.com` (production)  
> **API Version**: 1.0.0  
> **Last Updated**: January 12, 2026

---

## Table of Contents

1. [Authentication](#authentication)
2. [Request/Response Format](#requestresponse-format)
3. [Error Handling](#error-handling)
4. [Core Endpoints](#core-endpoints)
5. [Transactions](#transactions)
6. [Dashboard & Analytics](#dashboard--analytics)
7. [Forecasts](#forecasts)
8. [Invoices](#invoices)
9. [Working Capital](#working-capital)
10. [Budgets](#budgets)
11. [Companies & Users](#companies--users)
12. [Bank Reconciliation](#bank-reconciliation)
13. [Drawings (Owner Withdrawals)](#drawings-owner-withdrawals)
14. [Salary & Expenses](#salary--expenses)
15. [Bug Reports](#bug-reports)
16. [AI Features](#ai-features)
17. [Speech Services](#speech-services)
18. [Export/Import](#exportimport)

---

## Authentication

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "yourPassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "default_company_id": "507f1f77bcf86cd799439011"
}
```

### Using the Token

Include the JWT token in all subsequent requests:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Register (via Invitation)

```http
POST /auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "SecurePass123",
  "invitation_token": "abc123xyz..."
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "user_id": "507f1f77bcf86cd799439011",
  "company_id": "507f1f77bcf86cd799439012",
  "role": "User"
}
```

### Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| SuperAdmin | 1 | System-wide access, view-only on company data |
| CompanyAdmin | 2 | Company management, can invite employees |
| User | 3 | Full CRUD access to company data |

---

## Request/Response Format

### Standard Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Pagination

Most list endpoints support pagination:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `per_page` | integer | 10 | 100 | Items per page |

**Response includes:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "per_page": 10,
  "pages": 15
}
```

### Date Formats

- **Input**: `YYYY-MM-DD` or ISO 8601 (`2026-01-12T10:30:00Z`)
- **Output**: ISO 8601 format

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message description",
  "field": "fieldName",
  "details": "Additional context"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 207 | Multi-Status (partial success) |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Server Error |

### Common Error Examples

**401 Unauthorized:**
```json
{
  "error": "Invalid or missing JWT token",
  "details": "Token has expired"
}
```

**403 Forbidden:**
```json
{
  "error": "Access denied to this company"
}
```

**400 Validation Error:**
```json
{
  "error": "Missing required fields",
  "field": "amount",
  "details": "Required: amount, description"
}
```

---

## Core Endpoints

### Health Check

```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T10:30:00Z",
  "version": "1.0.0",
  "service": "Cashflow Backend API",
  "database": "connected",
  "redis": "connected"
}
```

### Get Home Dashboard

```http
GET /?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "transactions": [...],
  "balance": 50000.00,
  "initial_balance": 10000.00,
  "total_cfo": 35000.00,
  "total_cfi": 5000.00,
  "total_cff": 0.00,
  "user": {...},
  "company_id": "507f1f77bcf86cd799439011",
  "status": "Logged In"
}
```

### Set Initial Balance

```http
POST /set-initial-balance
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "initial_balance": 10000.00
}
```

### Get Cash Overview

```http
GET /cash-overview?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "initial_balance": 10000.00,
  "total_cfo": 35000.00,
  "total_cfi": 5000.00,
  "total_cff": 0.00,
  "balance": 50000.00,
  "burn_rate": 5000.00,
  "runway_months": 10.0,
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Get Balance by Date

```http
POST /balance-by-date
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "date": "2026-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "balance": 45000.00,
  "date": "2026-01-01"
}
```

---

## Transactions

### List Transactions

```http
GET /api/transactions?company_id={company_id}&page=1&per_page=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "507f1f77bcf86cd799439011",
      "date": "2026-01-12",
      "description": "Client payment",
      "amount": 5000.00,
      "type": "inflow",
      "category": "operating",
      "currency": "USD"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 10,
  "pages": 15,
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Create Transaction

```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "date": "2026-01-12",
  "description": "Office supplies",
  "amount": 150.00,
  "type": "outflow",
  "category": "operating",
  "currency": "USD"
}
```

**Response (201 Created):**
```json
{
  "message": "Transaction added",
  "transaction": {
    "id": "507f1f77bcf86cd799439012",
    "date": "2026-01-12T00:00:00",
    "description": "Office supplies",
    "amount": 150.00,
    "type": "outflow",
    "category": "operating",
    "currency": "USD"
  }
}
```

### Transaction Types & Categories

**Types:**
- `inflow` - Money coming in
- `outflow` - Money going out

**Categories:**
- `operating` - Operating activities
- `investing` - Investing activities
- `financing` - Financing activities
- `revenue` - Revenue
- `expenses` - Expenses
- `assets` - Assets
- `equipment` - Equipment
- `loans` - Loans
- `equity` - Equity

### Update Transaction

```http
PUT /api/transactions/{transaction_id}?company_id={company_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "amount": 200.00
}
```

### Delete Transaction

```http
DELETE /api/transactions/{transaction_id}?company_id={company_id}
Authorization: Bearer <token>
```

### Bulk Save Transactions

```http
POST /api/save_transactions
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "company_id": "507f1f77bcf86cd799439011",
    "date": "2026-01-12",
    "description": "Transaction 1",
    "amount": 100.00,
    "type": "inflow",
    "category": "operating"
  },
  {
    "company_id": "507f1f77bcf86cd799439011",
    "date": "2026-01-12",
    "description": "Transaction 2",
    "amount": 50.00,
    "type": "outflow",
    "category": "expenses"
  }
]
```

**Response (201/207):**
```json
{
  "message": "All 2 transactions saved successfully",
  "total": 2,
  "created": [...],
  "failed": [],
  "summary": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "success_rate": "100.0%"
  }
}
```

---

## Dashboard & Analytics

### Get Dashboard KPIs

```http
GET /api/dashboard?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "kpis": {
    "current_balance": 50000.00,
    "monthly_revenue": 25000.00,
    "monthly_expenses": 15000.00,
    "net_cash_flow": 10000.00
  },
  "inflows": 150000.00,
  "outflows": 100000.00,
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Get Dashboard Speech Summary

```http
GET /api/companies/{company_id}/dashboard/speech?style=conversational
Authorization: Bearer <token>
```

**Query Parameters:**
- `style`: `conversational` (default), `formal`, `brief`

**Response:**
```json
{
  "speech_text": "Your current cash position is fifty thousand dollars...",
  "company_id": "507f1f77bcf86cd799439011",
  "style": "conversational"
}
```

### Monthly Balances (Chart Data)

```http
GET /api/monthly-balances?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["2025-10", "2025-11", "2025-12", "2026-01"],
    "balances": [40000.00, 42000.00, 48000.00, 50000.00]
  }
}
```

### Monthly Income vs Expense (Chart Data)

```http
GET /api/monthly-income-expense?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["2025-10", "2025-11", "2025-12", "2026-01"],
    "income": [20000, 22000, 25000, 28000],
    "expense": [15000, 16000, 19000, 18000]
  }
}
```

### Expense Categories (Pie Chart Data)

```http
GET /api/cashout-categories?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["operating", "investing", "financing"],
    "amounts": [45000, 10000, 5000]
  }
}
```

### Generate Cash Flow Statement (Excel)

```http
GET /api/generate_cashflow_statement?company_id={company_id}
Authorization: Bearer <token>
```

**Response:** Excel file download (`.xlsx`)

---

## Forecasts

### Create Forecast

```http
POST /api/forecasts
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "months": 12,
  "type": "manual",
  "scenario_name": "Base Case",
  "scenario_params": {
    "growth_rate": 0.05
  }
}
```

**Forecast Types:**
- `manual` - Rule-based projections
- `ai` - AI-powered analysis

### List Forecasts

```http
GET /api/forecasts?company_id={company_id}
Authorization: Bearer <token>
```

### AI Forecast Analysis

```http
GET /api/forecast?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "ai_analysis": "Based on your transaction history...",
  "patterns": {
    "seasonal_pattern": [0.8, 0.9, 1.0, ...]
  },
  "forecasts": {
    "90_days": [5000, 5200, ...]
  },
  "risk_metrics": {
    "liquidity_ratio": 2.5,
    "cash_flow_volatility": 0.15,
    "burn_rate": 5000,
    "runway_months": 10
  }
}
```

### Create Forecast from Speech

```http
POST /api/companies/{company_id}/forecasts/speech
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcript": "I expect revenue to grow by 10% next quarter with expenses staying flat",
  "scenario_name": "Growth Scenario",
  "context": {
    "current_balance": 50000,
    "monthly_revenue": 25000,
    "monthly_expenses": 15000
  }
}
```

**Response:**
```json
{
  "message": "Forecast created from speech",
  "forecast": {
    "id": "507f1f77bcf86cd799439013",
    "scenario_name": "Growth Scenario",
    "projections": {
      "expected_revenue": 27500,
      "expected_expenses": 15000,
      "net_cash_flow": 12500,
      "monthly_breakdown": [...]
    },
    "extracted_data": {
      "confidence_level": "medium",
      "assumptions": ["10% revenue growth", "Flat expenses"]
    }
  }
}
```

### Get Forecast Speech Summary

```http
GET /api/companies/{company_id}/forecasts/{forecast_id}/speech?style=conversational
Authorization: Bearer <token>
```

---

## Invoices

### List Invoice Templates

```http
GET /api/companies/{company_id}/invoice-templates
Authorization: Bearer <token>
```

### Create Invoice Template

```http
POST /api/companies/{company_id}/invoice-templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "template_name": "Monthly Service",
  "default_due_days": 30,
  "default_tax_rate": 0.10,
  "line_items_template": [
    {
      "description": "Monthly consulting service",
      "quantity": 1,
      "rate": 5000.00,
      "amount": 5000.00
    }
  ],
  "auto_generate": false,
  "generation_frequency": "monthly"
}
```

### List Invoices

```http
GET /api/companies/{company_id}/invoices?status=sent&page=1&per_page=20
Authorization: Bearer <token>
```

**Status Filter Values:**
- `draft`
- `sent`
- `paid`
- `overdue`

### Create Invoice

```http
POST /api/companies/{company_id}/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_name": "Acme Corp",
  "customer_email": "billing@acme.com",
  "template_id": "507f1f77bcf86cd799439014",
  "line_items": [
    {
      "description": "Consulting service",
      "quantity": 10,
      "rate": 150.00,
      "amount": 1500.00
    }
  ]
}
```

**Or create without template:**
```json
{
  "customer_name": "Acme Corp",
  "customer_email": "billing@acme.com",
  "due_date": "2026-02-12",
  "line_items": [...],
  "tax_rate": 0.08
}
```

### Get Invoice

```http
GET /api/companies/{company_id}/invoices/{invoice_id}
Authorization: Bearer <token>
```

### Update Invoice

```http
PUT /api/companies/{company_id}/invoices/{invoice_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paid",
  "payment_method": "bank_transfer"
}
```

### Get Invoice Summary Statistics

```http
GET /api/companies/{company_id}/invoices/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total_invoices": 50,
  "by_status": {
    "draft": {"count": 5, "total": 10000.00},
    "sent": {"count": 20, "total": 50000.00},
    "paid": {"count": 20, "total": 45000.00},
    "overdue": {"count": 5, "total": 15000.00}
  },
  "total_outstanding": 75000.00,
  "total_paid": 45000.00,
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Get Invoice Speech Summary

```http
GET /api/companies/{company_id}/invoices/{invoice_id}/speech?style=formal
Authorization: Bearer <token>
```

### Export Invoice as PDF

```http
GET /api/companies/{company_id}/invoices/{invoice_id}/export/pdf
Authorization: Bearer <token>
```

**Response:** PDF file download

### Export All Invoices as CSV

```http
GET /api/companies/{company_id}/invoices/export/csv?status=paid
Authorization: Bearer <token>
```

**Response:** CSV file download

---

## Working Capital

### Receivables

```http
GET /api/receivables?company_id={company_id}
Authorization: Bearer <token>
```

```http
POST /api/receivables
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "amount": 5000.00,
  "due_date": "2026-02-15",
  "status": "pending",
  "description": "Invoice #1234"
}
```

### Payables

```http
GET /api/payables?company_id={company_id}
POST /api/payables
PUT /api/payables/{payable_id}
DELETE /api/payables/{payable_id}
```

### Inventory

```http
GET /api/inventory?company_id={company_id}
POST /api/inventory
PUT /api/inventory/{inventory_id}
DELETE /api/inventory/{inventory_id}
```

**Create Inventory:**
```json
{
  "company_id": "507f1f77bcf86cd799439011",
  "item_name": "Widget A",
  "quantity": 100,
  "value": 2500.00
}
```

### Aging Report

```http
GET /api/aging?company_id={company_id}&type=receivables
Authorization: Bearer <token>
```

**Type Values:** `receivables`, `payables`

---

## Budgets

### Create Budget

```http
POST /api/budgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": "507f1f77bcf86cd799439011",
  "category": "operating",
  "amount": 50000.00,
  "period": "2026-01"
}
```

### List Budgets

```http
GET /api/budgets?company_id={company_id}&period=2026-01
Authorization: Bearer <token>
```

### Get Budget Variance

```http
GET /api/variances?company_id={company_id}&period=2026-01
Authorization: Bearer <token>
```

**Response:**
```json
{
  "variance": {
    "operating": {
      "budgeted": 50000.00,
      "actual": 45000.00,
      "variance": 5000.00,
      "variance_percent": 10.0
    }
  },
  "company_id": "507f1f77bcf86cd799439011",
  "period": "2026-01"
}
```

---

## Companies & Users

### List Companies

```http
GET /api/companies
Authorization: Bearer <token>
```

### Create Company (SuperAdmin only)

```http
POST /api/companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Company Inc",
  "currency": "USD"
}
```

### Get Company Details

```http
GET /api/companies/{company_id}
Authorization: Bearer <token>
```

### Update Company

```http
PUT /api/companies/{company_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Company Name",
  "currency": "EUR"
}
```

### Invite User to Company

```http
POST /api/companies/{company_id}/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "user"
}
```

**Role Values:** `admin`, `user`

**Response:**
```json
{
  "message": "Invitation sent",
  "invitation_token": "abc123...",
  "expires_at": "2026-01-19T00:00:00Z"
}
```

### List Company Users

```http
GET /api/companies/{company_id}/users
Authorization: Bearer <token>
```

### Create Company Admin

```http
POST /api/companies/{company_id}/create-admin
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "companyadmin",
  "email": "admin@company.com",
  "password": "SecurePass123"
}
```

### Update User Profile

```http
POST /api/update_profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newusername"
}
```

### Change Password

```http
POST /api/change_password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "OldPass123",
  "new_password": "NewPass456",
  "confirm_password": "NewPass456"
}
```

### Get User Settings

```http
GET /api/settings
Authorization: Bearer <token>
```

### Update Module Preferences

```http
POST /api/update_modules
Authorization: Bearer <token>
Content-Type: application/json

{
  "modules": ["transactions", "forecasts", "invoices", "budgets"]
}
```

---

## Bank Reconciliation

### List Bank Statements

```http
GET /api/companies/{company_id}/bank-statements?page=1&per_page=20
Authorization: Bearer <token>
```

### Create Bank Statement

```http
POST /api/companies/{company_id}/bank-statements
Authorization: Bearer <token>
Content-Type: application/json

{
  "bank_name": "First National Bank",
  "account_number": "1234567890",
  "statement_date": "2026-01-01",
  "opening_balance": 10000.00,
  "closing_balance": 12500.00,
  "items": [
    {
      "date": "2026-01-05",
      "description": "Customer deposit",
      "amount": 5000.00,
      "reference": "DEP001"
    },
    {
      "date": "2026-01-10",
      "description": "Vendor payment",
      "amount": -2500.00,
      "reference": "CHK001"
    }
  ]
}
```

### Get Bank Statement Details

```http
GET /api/companies/{company_id}/bank-statements/{statement_id}
Authorization: Bearer <token>
```

### Auto-Match Transactions

```http
POST /api/companies/{company_id}/reconciliation/{statement_id}/auto-match?date_tolerance=2
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Auto-matching complete: 8 matched, 2 unmatched",
  "matched_count": 8,
  "unmatched_count": 2,
  "matches": [
    {
      "reconciliation_item_id": "...",
      "transaction_id": "...",
      "bank_description": "Customer deposit",
      "transaction_description": "Payment from Acme Corp",
      "amount": 5000.00
    }
  ],
  "errors": []
}
```

### Get Reconciliation Status

```http
GET /api/companies/{company_id}/reconciliation/{statement_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "statement": {
    "id": "...",
    "bank_name": "First National Bank",
    "statement_date": "2026-01-01",
    "opening_balance": 10000.00,
    "closing_balance": 12500.00
  },
  "summary": {
    "total_items": 10,
    "matched": 8,
    "unmatched": 2,
    "pending": 0,
    "match_rate": 80.0
  },
  "totals": {
    "bank_inflows": 8000.00,
    "bank_outflows": 5500.00,
    "bank_net": 2500.00,
    "matched_amount": 11000.00,
    "expected_balance_change": 2500.00
  },
  "discrepancies": [...]
}
```

### Manual Match

```http
POST /api/companies/{company_id}/reconciliation/items/{item_id}/match
Authorization: Bearer <token>
Content-Type: application/json

{
  "transaction_id": "507f1f77bcf86cd799439015",
  "notes": "Matched after reviewing bank reference"
}
```

### Unmatch Item

```http
POST /api/companies/{company_id}/reconciliation/items/{item_id}/unmatch
Authorization: Bearer <token>
```

### Get Potential Matches

```http
GET /api/companies/{company_id}/reconciliation/items/{item_id}/potential-matches?date_tolerance=5
Authorization: Bearer <token>
```

---

## Drawings (Owner Withdrawals)

### List Drawings

```http
GET /api/companies/{company_id}/drawings?owner_id={owner_id}&category=personal&start_date=2026-01-01&end_date=2026-01-31
Authorization: Bearer <token>
```

### Create Drawing

```http
POST /api/companies/{company_id}/drawings
Authorization: Bearer <token>
Content-Type: application/json

{
  "owner_id": "507f1f77bcf86cd799439016",
  "date": "2026-01-15",
  "description": "Personal expense withdrawal",
  "amount": 5000.00,
  "category": "personal",
  "create_transaction": true
}
```

**Category Values:** `personal`, `equity`, `loan`

### Get Drawing

```http
GET /api/companies/{company_id}/drawings/{drawing_id}
Authorization: Bearer <token>
```

### List Equity Accounts

```http
GET /api/companies/{company_id}/equity
Authorization: Bearer <token>
```

### Get Owner Equity Summary

```http
GET /api/companies/{company_id}/equity/{owner_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "owner": {
    "id": "...",
    "username": "owner1"
  },
  "equity_account": {
    "opening_balance": 100000.00,
    "current_balance": 85000.00,
    "total_drawings": 20000.00,
    "total_contributions": 5000.00
  },
  "drawings_by_category": {
    "personal": 15000.00,
    "equity": 5000.00,
    "loan": 0.00
  },
  "recent_drawings": [...]
}
```

### Update Equity Account

```http
PUT /api/companies/{company_id}/equity/{owner_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "opening_balance": 100000.00,
  "contribution": 25000.00
}
```

---

## Salary & Expenses

### Employees

#### List Employees

```http
GET /api/companies/{company_id}/employees?status=active&department=Engineering
Authorization: Bearer <token>
```

#### Create Employee

```http
POST /api/companies/{company_id}/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@company.com",
  "employee_id": "EMP001",
  "position": "Software Engineer",
  "department": "Engineering",
  "salary_amount": 75000.00,
  "salary_frequency": "annual",
  "hire_date": "2026-01-15"
}
```

**Salary Frequency Values:** `hourly`, `weekly`, `biweekly`, `monthly`, `annual`

#### Get Employee

```http
GET /api/companies/{company_id}/employees/{employee_id}
Authorization: Bearer <token>
```

#### Update Employee

```http
PUT /api/companies/{company_id}/employees/{employee_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "salary_amount": 80000.00,
  "position": "Senior Software Engineer"
}
```

#### Delete (Deactivate) Employee

```http
DELETE /api/companies/{company_id}/employees/{employee_id}
Authorization: Bearer <token>
```

### Salary Payments

#### List Salary Payments

```http
GET /api/companies/{company_id}/salary-payments?employee_id={id}&status=paid&start_date=2026-01-01
Authorization: Bearer <token>
```

#### Create Salary Payment

```http
POST /api/companies/{company_id}/salary-payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": "507f1f77bcf86cd799439017",
  "pay_period_start": "2026-01-01",
  "pay_period_end": "2026-01-15",
  "payment_date": "2026-01-20",
  "gross_amount": 3000.00,
  "tax_amount": 600.00,
  "other_deductions": 150.00,
  "deduction_details": [
    {"name": "Health Insurance", "amount": 100.00},
    {"name": "401k", "amount": 50.00}
  ],
  "notes": "Regular bi-weekly payment",
  "create_transaction": true
}
```

#### Process Pending Payment

```http
POST /api/companies/{company_id}/salary-payments/{payment_id}/process
Authorization: Bearer <token>
```

#### Cancel Payment

```http
POST /api/companies/{company_id}/salary-payments/{payment_id}/cancel
Authorization: Bearer <token>
```

### Expense Accounts

#### List Expense Accounts

```http
GET /api/companies/{company_id}/expense-accounts?type=salary&active_only=true
Authorization: Bearer <token>
```

#### Create Expense Account

```http
POST /api/companies/{company_id}/expense-accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_code": "5100",
  "account_name": "Salaries Expense",
  "description": "Employee salary payments",
  "account_type": "salary",
  "parent_account_id": null
}
```

**Account Types:** `salary`, `rent`, `utilities`, `supplies`, `travel`, `marketing`, `insurance`, `other`

---

## Bug Reports

### Submit Bug Report

```http
POST /api/bug-reports
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Dashboard chart not loading",
  "description": "When I navigate to the dashboard, the monthly balance chart shows a loading spinner indefinitely.",
  "severity": "medium",
  "category": "ui",
  "priority": 3,
  "browser": "Chrome 120",
  "device": "Windows 11",
  "url_path": "/dashboard",
  "company_id": "507f1f77bcf86cd799439011"
}
```

**Severity Values:** `low`, `medium`, `high`, `critical`

**Category Values:** `ui`, `api`, `performance`, `data`, `security`, `feature_request`, `other`

**Priority:** 1 (highest) to 5 (lowest)

### Submit Bug Report with Attachments

```http
POST /api/bug-reports
Authorization: Bearer <token>
Content-Type: multipart/form-data

title: Dashboard chart not loading
description: When I navigate to the dashboard...
severity: medium
category: ui
attachments: [screenshot.png]
```

**Allowed File Types:** `png`, `jpg`, `jpeg`, `gif`, `pdf`, `txt`, `log`, `json`, `csv`
**Max File Size:** 10MB per file
**Max Files:** 5 per report

### List Bug Reports

```http
GET /api/bug-reports?status=open&severity=high&category=api&search=dashboard&page=1&per_page=20
Authorization: Bearer <token>
```

> **Note:** SuperAdmin sees all bug reports. Regular users see only their own.

### Get My Bug Reports

```http
GET /api/my-bug-reports?status=open&page=1&per_page=20
Authorization: Bearer <token>
```

### Get Bug Report

```http
GET /api/bug-reports/{bug_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439018",
  "title": "Dashboard chart not loading",
  "description": "When I navigate to the dashboard...",
  "reported_by": {
    "id": "507f1f77bcf86cd799439016",
    "username": "john_doe"
  },
  "company_id": "507f1f77bcf86cd799439011",
  "severity": "medium",
  "category": "ui",
  "status": "open",
  "priority": 3,
  "browser": "Chrome 120",
  "device": "Windows 11",
  "url_path": "/dashboard",
  "attachments": ["uploads/bug_reports/507f.../screenshot.png"],
  "comments": [],
  "resolved_by": null,
  "resolved_at": null,
  "resolution_notes": null,
  "created_at": "2026-01-12T10:30:00Z",
  "updated_at": "2026-01-12T10:30:00Z"
}
```

### Update Bug Report

```http
PUT /api/bug-reports/{bug_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "severity": "high",
  "status": "in_progress",
  "priority": 2
}
```

> **Note:** Only bug owner can update `title` and `description`. SuperAdmin can update `status`, `priority`, and `resolution_notes`.

**Status Values:** `open`, `in_progress`, `resolved`, `closed`, `wont_fix`

### Delete Bug Report

```http
DELETE /api/bug-reports/{bug_id}
Authorization: Bearer <token>
```

> **Note:** Regular users can only delete their own reports with status `open`. SuperAdmin can delete any report.

### Add Comment

```http
POST /api/bug-reports/{bug_id}/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "I've identified the issue. Working on a fix."
}
```

### Get Comments

```http
GET /api/bug-reports/{bug_id}/comments
Authorization: Bearer <token>
```

**Response:**
```json
{
  "bug_id": "507f1f77bcf86cd799439018",
  "comments": [
    {
      "user_id": "507f1f77bcf86cd799439016",
      "username": "john_doe",
      "comment": "I've identified the issue...",
      "timestamp": "2026-01-12T11:00:00Z"
    }
  ],
  "count": 1
}
```

### Add Attachment to Existing Bug

```http
POST /api/bug-reports/{bug_id}/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data

attachment: [file.png]
```

### Download Attachment

```http
GET /api/bug-reports/{bug_id}/attachments/{attachment_index}
Authorization: Bearer <token>
```

### Bug Statistics (SuperAdmin Only)

```http
GET /api/bug-reports/statistics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 50,
  "by_status": {
    "open": 15,
    "in_progress": 10,
    "resolved": 20,
    "closed": 5,
    "wont_fix": 0
  },
  "by_severity": {
    "low": 5,
    "medium": 8,
    "high": 2,
    "critical": 0
  },
  "by_category": {
    "ui": 8,
    "api": 5,
    "performance": 2,
    "data": 0,
    "security": 0,
    "feature_request": 0,
    "other": 0
  },
  "total_resolved": 25,
  "open_count": 25,
  "recent_activity": {
    "opened_last_7_days": 12,
    "resolved_last_7_days": 8
  },
  "critical_open": 0,
  "high_priority_open": 2
}
```

### Recent Bug Reports (SuperAdmin Only)

```http
GET /api/bug-reports/recent?limit=10
Authorization: Bearer <token>
```

### Critical/High Severity Bugs (SuperAdmin Only)

```http
GET /api/bug-reports/critical
Authorization: Bearer <token>
```

---

## AI Features

### Auto-Categorize Transaction

```http
POST /api/ai/categorize
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Payment to Amazon Web Services",
  "amount": 500.00,
  "merchant": "AWS"
}
```

**Response:**
```json
{
  "message": "Transaction categorized successfully",
  "categorization": {
    "category": "operating",
    "subcategory": "cloud_services",
    "confidence": 0.95,
    "type": "outflow"
  }
}
```

### Detect Anomalies

```http
GET /api/ai/anomalies?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "anomalies": [
    {
      "transaction_id": "507f1f77bcf86cd799439019",
      "description": "Unusual large payment",
      "amount": 50000.00,
      "reason": "Amount is 5x higher than typical transactions",
      "severity": "high"
    }
  ],
  "total_analyzed": 100,
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Financial Chat

```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "What's my current runway and how can I improve it?",
  "company_id": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "response": "Based on your current burn rate of $5,000/month and cash balance of $50,000, your runway is approximately 10 months. To improve this, consider...",
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Get AI Insights

```http
GET /api/ai/insights?company_id={company_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "insights": [
    {
      "type": "warning",
      "title": "Increasing Expenses",
      "message": "Your operating expenses have increased 15% over the last 3 months",
      "recommendation": "Review vendor contracts and identify cost-saving opportunities"
    },
    {
      "type": "opportunity",
      "title": "Seasonal Revenue Pattern",
      "message": "Revenue peaks in Q4, consider adjusting cash reserves",
      "recommendation": "Build cash reserves in Q3 for Q1 operating needs"
    }
  ],
  "company_id": "507f1f77bcf86cd799439011"
}
```

### Enhance Transaction Description

```http
POST /api/transactions/{transaction_id}/enhance
Authorization: Bearer <token>
Content-Type: application/json

{
  "apply": true
}
```

**Response:**
```json
{
  "message": "Transaction description updated",
  "original": "AWS",
  "enhanced": "Amazon Web Services - Cloud hosting and computing services",
  "transaction": {...}
}
```

---

## Speech Services

### Process Speech to Forecast

```http
POST /api/companies/{company_id}/forecasts/speech
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcript": "I expect our revenue to increase by about 15% next quarter, with expenses growing by only 5%",
  "scenario_name": "Q2 Growth Projection"
}
```

### Get Dashboard Speech

```http
GET /api/companies/{company_id}/dashboard/speech?style=conversational
Authorization: Bearer <token>
```

**Style Options:**
- `conversational` - Natural, easy to understand
- `formal` - Professional business language  
- `brief` - Concise, under 100 words

### Get Invoice Speech

```http
GET /api/companies/{company_id}/invoices/{invoice_id}/speech?style=formal
Authorization: Bearer <token>
```

### Get Forecast Speech

```http
GET /api/companies/{company_id}/forecasts/{forecast_id}/speech?style=brief
Authorization: Bearer <token>
```

---

## Export/Import

### Export Transactions to CSV

```http
GET /api/companies/{company_id}/transactions/export/csv?include_balance=true&start_date=2026-01-01&end_date=2026-01-31
Authorization: Bearer <token>
```

**Response:** CSV file download

### Export Transactions to PDF

```http
GET /api/companies/{company_id}/transactions/export/pdf?start_date=2026-01-01&end_date=2026-01-31&title=Monthly%20Report
Authorization: Bearer <token>
```

**Response:** PDF file download

### Import Transactions from CSV

```http
POST /api/companies/{company_id}/transactions/import/csv?validate_only=false
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [transactions.csv]
```

**CSV Format:**
```csv
Date,Description,Type,Amount,Category,Currency
2026-01-12,Client payment,inflow,5000.00,operating,USD
2026-01-13,Office supplies,outflow,150.00,expenses,USD
```

**Response:**
```json
{
  "message": "Successfully imported 10 transactions.",
  "imported_count": 10,
  "transactions": [...],
  "errors": []
}
```

**Validate Only Mode:**
```http
POST /api/companies/{company_id}/transactions/import/csv?validate_only=true
```

**Response:**
```json
{
  "message": "Validation successful. 10 transactions ready to import.",
  "validated_count": 10,
  "errors": []
}
```

### Legacy Export Endpoints

```http
GET /api/export/csv?company_id={company_id}
GET /api/export/excel?company_id={company_id}
```

---

## Admin Endpoints (SuperAdmin Only)

### List All Users

```http
GET /api/admin/users
Authorization: Bearer <token>
```

### List All Companies

```http
GET /api/admin/companies
Authorization: Bearer <token>
```

---

## WebSocket Events (Future)

> WebSocket support is planned for real-time updates. Documentation will be added when available.

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Default | 200/day, 50/hour |
| Login | 10/hour |
| Registration | 5/hour |
| Password Change | 5/hour |
| File Upload | 10/hour |
| AI Forecast | 20/hour |
| Report Generation | 30/hour |

---

## TypeScript Types

```typescript
// Authentication
interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  default_company_id: string;
}

// Transaction
interface Transaction {
  id: string;
  date: string; // ISO 8601
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: TransactionCategory;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

type TransactionCategory = 
  | 'operating' | 'investing' | 'financing'
  | 'revenue' | 'expenses' | 'assets'
  | 'equipment' | 'loans' | 'equity';

// Invoice
interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  issue_date: string;
  due_date: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  notes?: string;
  paid_at?: string;
  payment_method?: string;
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// Bug Report
interface BugReport {
  id: string;
  title: string;
  description: string;
  reported_by: {
    id: string;
    username: string;
  };
  company_id?: string;
  severity: BugSeverity;
  category: BugCategory;
  status: BugStatus;
  priority: number; // 1-5
  browser?: string;
  device?: string;
  url_path?: string;
  attachments: string[];
  comments: Comment[];
  resolved_by?: {
    id: string;
    username: string;
  };
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

type BugSeverity = 'low' | 'medium' | 'high' | 'critical';
type BugCategory = 'ui' | 'api' | 'performance' | 'data' | 'security' | 'feature_request' | 'other';
type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

interface Comment {
  user_id: string;
  username: string;
  comment: string;
  timestamp: string;
}

// Pagination
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Error
interface ApiError {
  error: string;
  field?: string;
  details?: string;
}
```

---

## Example: React Integration

```typescript
// api.ts
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class FlowbackAPI {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  // Transactions
  async getTransactions(companyId: string, page = 1, perPage = 10) {
    return this.request<PaginatedResponse<Transaction>>(
      `/api/transactions?company_id=${companyId}&page=${page}&per_page=${perPage}`
    );
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>) {
    return this.request<{ message: string; transaction: Transaction }>(
      '/api/transactions',
      {
        method: 'POST',
        body: JSON.stringify(transaction),
      }
    );
  }

  // Bug Reports
  async submitBugReport(report: {
    title: string;
    description: string;
    severity?: BugSeverity;
    category?: BugCategory;
  }) {
    return this.request<{ message: string; bug_report: BugReport }>(
      '/api/bug-reports',
      {
        method: 'POST',
        body: JSON.stringify(report),
      }
    );
  }

  async getMyBugReports(page = 1) {
    return this.request<PaginatedResponse<BugReport>>(
      `/api/my-bug-reports?page=${page}`
    );
  }
}

export const api = new FlowbackAPI();
```

---

## Support

For API issues or questions:
- Submit a bug report via `/api/bug-reports`
- Contact: api-support@flowback.com

---

**Document Version:** 1.0.0  
**API Version:** 1.0.0  
**Last Updated:** January 12, 2026
