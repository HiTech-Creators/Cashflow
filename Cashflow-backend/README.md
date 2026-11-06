# Cashflow Management Backend API

> A comprehensive Flask-based REST API for cashflow management with AI-powered financial analytics, multi-tenant architecture, and advanced security features.

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1.0-green.svg)](https://flask.palletsprojects.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0+-green.svg)](https://www.mongodb.com/)


## Features

### Core Functionality
- **Transaction Management** - Track inflows and outflows with categorization
- **Cash Flow Analysis** - Operating (CFO), Investing (CFI), and Financing (CFF) activities
- **AI-Powered Forecasting** - Financial predictions using Anthropic Claude API
- **Dashboard & Analytics** - Real-time financial metrics and visualizations
- **Working Capital Management** - Track receivables, payables, and inventory
- **Budget Planning** - Create and monitor budgets with variance analysis
- **Import/Export** - CSV and Excel file support

### Architecture
- **Multi-Tenant Support** - Company-based data isolation
- **Role-Based Access Control** - SuperAdmin, CompanyAdmin, and User roles
- **JWT Authentication** - Secure token-based authentication
- **Security** - Rate limiting, CORS, security headers, input validation
- **MongoDB Database** - Scalable NoSQL storage with MongoEngine ODM
- **Comprehensive Testing** - 80%+ test coverage with pytest

## Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Database Models](#-database-models)
- [Authentication & Authorization](#-authentication--authorization)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## Quick Start

```bash
# Clone the repository
git clone 
cd 

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run the application
python main.py
```

The API will be available at `http://localhost:5000`

## Installation

### Prerequisites

- Python 3.8 or higher
- MongoDB 4.4 or higher
- pip (Python package manager)

### Dependencies

Key dependencies include:

- **Flask 3.1.0** - Web framework
- **Flask-JWT-Extended** - JWT authentication
- **Flask-MongoEngine** - MongoDB ODM
- **Anthropic** - AI-powered analytics
- **Flask-Limiter** - Rate limiting
- **Flask-CORS** - CORS support
- **Flask-Talisman** - Security headers
- **Pandas** - Data processing
- **Matplotlib** - Chart generation
- **pytest** - Testing framework

See [requirements.txt](requirements.txt) for complete list.

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Flask Configuration
SECRET_KEY=123
FLASK_ENV=development  # or production

# Database
MONGO_URI=mongodb://localhost:27017/cashflow_db
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/cashflow_db

# API Keys
ANTHROPIC_API_KEY=your-anthropic-api-key
EXCHANGE_API_KEY=your-exchange-rate-api-key

# Email Configuration (for notifications)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=noreply@yourapp.com

# Security
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Redis (optional, for rate limiting in production)
REDIS_URL=redis://localhost:6379
```

### Application Settings

Key configuration options in `src/config.py`:

- **SECRET_KEY** - Flask secret key for sessions and JWT
- **MONGO_URI** - MongoDB connection string
- **ANTHROPIC_API_KEY** - Required for AI features
- **UPLOAD_FOLDER** - Directory for file uploads
- **MAIL_SERVER** - SMTP server for email notifications

## API Documentation

### Base URL

```
http://localhost:5000
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Authentication

```http
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/profile
```

#### Transactions

```http
GET    /api/transactions              # List transactions
POST   /api/transactions              # Create transaction
GET    /api/transactions/{id}         # Get transaction
PUT    /api/transactions/{id}         # Update transaction
DELETE /api/transactions/{id}         # Delete transaction
```

#### Dashboard

```http
GET /api/dashboard/overview           # Financial overview
GET /api/dashboard/metrics            # Key metrics
GET /monthly-balances                 # Monthly balance data
GET /monthly-income-expense           # Income vs expense trends
```

#### Forecasting & AI

```http
GET /forecast                         # AI-powered forecast
GET /api/forecasts                    # List saved forecasts
POST /api/forecasts                   # Create forecast
GET /generate_cashflow_statement      # Generate AI statement
```

#### Working Capital

```http
GET  /api/working-capital/receivables # Accounts receivable
POST /api/working-capital/receivables # Create receivable
GET  /api/working-capital/payables    # Accounts payable
POST /api/working-capital/payables    # Create payable
GET  /api/working-capital/inventory   # Inventory items
POST /api/working-capital/inventory   # Add inventory
```

#### Budget Management

```http
GET    /api/budgets                   # List budgets
POST   /api/budgets                   # Create budget
GET    /api/budgets/{id}              # Get budget
PUT    /api/budgets/{id}              # Update budget
DELETE /api/budgets/{id}              # Delete budget
GET    /api/budgets/{id}/variance     # Budget variance analysis
```

#### Company Management (Admin)

```http
GET    /api/companies                 # List companies
POST   /api/companies                 # Create company
GET    /api/companies/{id}            # Get company
PUT    /api/companies/{id}            # Update company
DELETE /api/companies/{id}            # Delete company
```

#### User Management (Admin)

```http
GET    /api/users                     # List users
POST   /api/users/invite              # Invite user
GET    /api/users/{id}                # Get user
PUT    /api/users/{id}                # Update user
DELETE /api/users/{id}                # Delete user
```

#### Utilities

```http
GET  /health                          # Health check
GET  /status                          # System status
POST /upload                          # Upload CSV/Excel
GET  /export/{format}                 # Export data (csv/excel)
POST /set-initial-balance             # Set opening balance
POST /balance-by-date                 # Calculate balance at date
```

### Request Examples

#### Create Transaction

```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Office supplies",
    "amount": -150.00,
    "type": "outflow",
    "category": "operating",
    "currency": "USD",
    "date": "2024-10-15",
    "company_id": "company-id-here"
  }'
```

#### Get Dashboard Overview

```bash
curl -X GET "http://localhost:5000/api/dashboard/overview?company_id=company-id" \
  -H "Authorization: Bearer <token>"
```

#### AI Forecast

```bash
curl -X GET "http://localhost:5000/forecast?company_id=company-id" \
  -H "Authorization: Bearer <token>"
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Resource"
  },
  "message": "Operation successful"
}
```

#### Error Response

```json
{
  "error": "Validation error",
  "details": "Amount must be a positive number",
  "field": "amount"
}
```

#### Paginated Response

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Project Structure

```
cashflow_mahwiz_backend/
├── main.py                      # Application entry point
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (not in git)
├── .env.example                # Environment template
├── postman_collection.json     # Postman API collection
│
├── src/                        # Core application code
│   ├── __init__.py
│   ├── config.py              # Configuration settings
│   ├── constants.py           # HTTP codes and constants
│   ├── models.py              # Database models
│   ├── routes.py              # Blueprint registration
│   ├── auth.py                # Authentication logic
│   ├── transactions.py        # Transaction endpoints
│   ├── forecasting.py         # Forecasting logic
│   ├── budgeting.py           # Budget management
│   ├── working_capital.py     # Working capital features
│   ├── dashboard.py           # Dashboard endpoints
│   ├── company.py             # Company management
│   ├── permissions.py         # Authorization decorators
│   ├── validators.py          # Input validation
│   ├── utils.py               # Helper functions
│   ├── anthropic_service.py   # AI service integration
│   └── upload_handler.py      # File upload processing
│
├── tests/                      # Test suite
│   ├── conftest.py            # Test fixtures
│   ├── test_authentication.py
│   ├── test_transactions.py
│   ├── test_multitenant.py
│   ├── test_security_features.py
│   ├── test_validation.py
│   ├── test_models.py
│   ├── test_endpoints.py
│   ├── test_ai_features.py
│   ├── test_performance.py
│   └── test_utils.py
│
├── uploads/                    # File upload directory
├── instance/                   # Instance-specific files
└── .cursor/                    # Cursor IDE rules
    └── rules/
        ├── project-structure.mdc
        ├── python-style.mdc
        ├── security-validation.mdc
        ├── api-development.mdc
        └── testing.mdc
```

## Database Models

### Core Models

#### User
```python
{
  "username": String,
  "email": String,
  "password_hash": String,
  "role_id": Reference(Role),
  "company_memberships": [
    {
      "company_id": Reference(Company),
      "role": String,  # 'admin' or 'user'
      "joined_at": DateTime
    }
  ],
  "is_active": Boolean,
  "created_at": DateTime
}
```

#### Company
```python
{
  "name": String,
  "currency": String,
  "created_by": Reference(User),
  "is_active": Boolean,
  "settings": Dict,
  "created_at": DateTime
}
```

#### Transaction
```python
{
  "user_id": Reference(User),
  "company_id": Reference(Company),
  "date": DateTime,
  "description": String,
  "amount": Float,
  "type": String,  # 'inflow' or 'outflow'
  "category": String,  # 'operating', 'investing', 'financing'
  "currency": String,
  "created_at": DateTime,
  "updated_at": DateTime
}
```

#### Forecast
```python
{
  "company_id": Reference(Company),
  "user_id": Reference(User),
  "forecast_date": DateTime,
  "forecast_type": String,
  "predictions": Dict,
  "confidence_score": Float,
  "created_at": DateTime
}
```

#### Budget
```python
{
  "company_id": Reference(Company),
  "name": String,
  "start_date": DateTime,
  "end_date": DateTime,
  "categories": [
    {
      "name": String,
      "allocated_amount": Float,
      "spent_amount": Float
    }
  ],
  "status": String
}
```

### Indexes

All models have optimized indexes for:
- Multi-tenant queries (company_id + user_id)
- Date range queries
- Sorting and filtering
- Full-text search where applicable

## Authentication & Authorization

### Role Hierarchy

1. **SuperAdmin** (Level 1)
   - Can create and manage companies
   - Can invite CompanyAdmins
   - Full system access

2. **CompanyAdmin** (Level 2)
   - Can manage their company
   - Can invite users to their company
   - Can access all company data

3. **User** (Level 3)
   - Can access assigned company data
   - Can create/edit own transactions
   - Read-only for most reports

### Multi-Tenant Security

All data queries include both `user_id` and `company_id` filters to ensure data isolation:

```python
# Correct - Multi-tenant secure
transactions = Transaction.objects(
    user_id=current_user_id,
    company_id=company_id
)

# Wrong - Missing tenant isolation
transactions = Transaction.objects(user_id=current_user_id)
```

### Permission Decorators

```python
from src.permissions import role_required

@app.route('/api/admin/resource')
@jwt_required()
@role_required('CompanyAdmin')
def admin_only():
    pass
```

## Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_authentication.py

# Run with verbose output
pytest -v

# Run specific test
pytest tests/test_authentication.py::test_login_success
```

### Test Coverage

Current coverage: **80%+**

Coverage includes:
- ✅ Authentication and JWT flows
- ✅ Transaction CRUD operations
- ✅ Multi-tenant data isolation
- ✅ Input validation
- ✅ Rate limiting
- ✅ Security features
- ✅ AI service integration
- ✅ Working capital management
- ✅ Budget management

### Writing Tests

```python
def test_create_transaction(client, auth_headers, test_company):
    """Test creating a new transaction"""
    data = {
        "description": "Test transaction",
        "amount": 100.00,
        "type": "inflow",
        "category": "operating",
        "company_id": str(test_company.id)
    }
    
    response = client.post('/api/transactions',
                          json=data,
                          headers=auth_headers)
    
    assert response.status_code == 201
    assert response.json['success'] is True
```

## Deployment

### Production Checklist

- [ ] Set `FLASK_ENV=production` in `.env`
- [ ] Use strong `SECRET_KEY`
- [ ] Configure MongoDB Atlas or production database
- [ ] Set up Redis for rate limiting
- [ ] Configure SMTP for email notifications
- [ ] Set `ALLOWED_ORIGINS` for CORS
- [ ] Enable HTTPS (Talisman will enforce it)
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Review security headers
- [ ] Enable database indexes

### Docker Deployment (Example)

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]
```

### Environment-Specific Settings

**Development:**
- Debug mode enabled
- Verbose logging
- No HTTPS enforcement
- Memory-based rate limiting

**Production:**
- Debug mode disabled
- Error logging only
- HTTPS enforced
- Redis-based rate limiting
- Security headers enabled

## Security Features

### Implemented Security

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Rate Limiting** - Prevent API abuse
- ✅ **CORS Protection** - Configurable origins
- ✅ **Security Headers** - CSP, X-Frame-Options, etc.
- ✅ **Input Validation** - All inputs sanitized
- ✅ **SQL Injection Protection** - NoSQL with MongoEngine
- ✅ **XSS Protection** - Headers and output encoding
- ✅ **CSRF Protection** - Token-based
- ✅ **Request ID Tracking** - For debugging and audit
- ✅ **Multi-Tenant Isolation** - Company-level data separation

### Rate Limits

- General API: 200/day, 50/hour
- File uploads: 10/hour
- Password changes: 5/hour
- AI analysis: 20/hour
- Report generation: 30/hour

### Best Practices

1. Always use HTTPS in production
2. Rotate JWT secrets regularly
3. Monitor for suspicious activity
4. Keep dependencies updated
5. Regular security audits
6. Backup database regularly
7. Use environment variables for secrets
8. Implement logging and monitoring

## Performance Considerations

### Database Optimization

- Compound indexes on frequently queried fields
- Query optimization with `.only()` and `.exclude()`
- Pagination for large result sets
- Connection pooling

### Caching Strategy

- Redis for session storage (production)
- Cache expensive AI computations
- ETags for static resources

### Monitoring

- Request ID tracking for debugging
- Error logging with context
- Performance metrics
- Health check endpoint: `/health`

## Author

**MAHWIZ** 

## Acknowledgments

- Flask framework and community
- Anthropic for Claude API
- MongoDB team
- All contributors

## Roadmap

### Upcoming Features

- [ ] GraphQL API support
- [ ] Real-time notifications with WebSockets
- [ ] Advanced reporting with custom filters
- [ ] Multi-currency support enhancement
- [ ] Mobile app integration
- [ ] Automated reconciliation
- [ ] Invoice generation
- [ ] Tax calculation and reporting
- [ ] Integration with accounting software
- [ ] Machine learning for anomaly detection

---

**Built with ❤️ using Flask, MongoDB, and Claude AI**

