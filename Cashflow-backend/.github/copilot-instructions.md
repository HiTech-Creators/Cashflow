# Flowback Cashflow API - AI Coding Instructions

## Architecture Overview

Flask REST API with MongoDB (MongoEngine ODM), JWT authentication, and multi-tenant architecture. All data is company-scoped.

### Key Components
- **[main.py](../main.py)** - App factory with Flask extensions (JWT, CORS, Talisman, MongoEngine)
- **[src/routes.py](../src/routes.py)** - Core API endpoints via Blueprints (`auth_bp`, `transactions_bp`, `forecasts_bp`, `invoices_bp`, etc.)
- **[src/routes/](../src/routes/)** - Phase 4 Sidebar Module routes (reconciliation, drawings, salary)
- **[src/models.py](../src/models.py)** - MongoEngine document models with `company_id` references
- **[src/permissions.py](../src/permissions.py)** - `@role_required()` decorator for role-based access
- **[src/utils.py](../src/utils.py)** - `verify_company_access()` for tenant isolation
- **[src/services/](../src/services/)** - Business logic services (invoice automation, reconciliation, etc.)

### Multi-Tenant Data Flow
```
Request → JWT Auth → verify_company_access(user_id, company_id) → Query with company_id filter
```
Every data query MUST filter by `company_id`. SuperAdmin (level=1) bypasses company checks.

## Critical Patterns

### Company Access Verification
Always use before accessing company-scoped data:
```python
from src.utils import verify_company_access
valid, result = verify_company_access(current_user_id, company_id)
if not valid:
    return jsonify({"error": result}), 403
```

### Role Hierarchy & Permissions
Defined in [src/constants.py](../src/constants.py):
- Level 1: `SuperAdmin` - system-wide access, view-only on company data
- Level 2: `CompanyAdmin` - company management, view-only on company data, can invite employees
- Level 3: `User` - full CRUD access to company data

Use `@view_only_for_admins` decorator to restrict admin write access:
```python
from src.permissions import view_only_for_admins, can_invite_employees, has_permission
```

### JWT Claims Pattern
Role is stored in JWT claims, NOT in `get_jwt_identity()`:
```python
from flask_jwt_extended import get_jwt, get_jwt_identity
user_id = get_jwt_identity()  # Returns string user ID
jwt_claims = get_jwt()
user_role = jwt_claims.get('role', 'User')
```

### Transaction Types
Transactions use `type` field: `'inflow'` or `'outflow'`. For balance calculations:
```python
amount = transaction.amount if transaction.type == 'inflow' else -transaction.amount
```

## Services

### Invoice Automation
Located in [src/services/invoice_automation.py](../src/services/invoice_automation.py):
```python
from src.services.invoice_automation import (
    generate_invoice_from_template,
    generate_invoice_number,
    process_automated_invoices,
    update_overdue_invoices,
    get_invoice_summary
)
```

### Speech Service
Located in [src/services/speech_service.py](../src/services/speech_service.py):
```python
from src.services.speech_service import get_speech_service

speech_service = get_speech_service()

# Process speech input to forecast data
forecast_data = speech_service.process_speech_to_forecast(transcript, company_id, context)

# Generate speech-friendly reports
speech_text = speech_service.generate_dashboard_speech(dashboard_data, style='conversational')
speech_text = speech_service.generate_invoice_speech(invoice_data, style='formal')
speech_text = speech_service.generate_report_speech(report_data, report_type, style='brief')
```

Speech styles: `'conversational'` (default), `'formal'`, `'brief'`

### Export/Import Service
Located in [src/services/export_service.py](../src/services/export_service.py):
```python
from src.services.export_service import get_export_service

export_service = get_export_service()

# Export transactions to CSV (with optional running balance)
csv_data = export_service.export_transactions_csv(transactions, include_running_balance=True)

# Export invoice to PDF
pdf_data = export_service.export_invoice_pdf(invoice, company=company)

# Export transactions report to PDF
pdf_data = export_service.export_transactions_pdf(transactions, title='Report', company=company)

# Import transactions from CSV (with validation)
result = export_service.import_transactions_csv(csv_file, company_id, user_id, validate_only=False)
```

## Testing

```bash
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest --cov=src               # With coverage
pytest tests/test_auth*.py     # Specific test file
```

Tests use MongoDB test database (`cashflow_test_db`). See [tests/conftest.py](../tests/conftest.py) for fixtures providing `superadmin`, `company_admin`, `user_a`, `company_a`, etc.

## Flask 3.x Compatibility

**Critical**: Call `patch_flask_for_mongoengine()` BEFORE importing flask_mongoengine:
```python
from flask_mongoengine_patch import patch_flask_for_mongoengine
patch_flask_for_mongoengine()
from flask_mongoengine import MongoEngine
```

## Environment Variables (Required)

```
SECRET_KEY=<required>
MONGO_URI=mongodb://localhost:27017/cashflow_db
ANTHROPIC_API_KEY=<for AI features including speech processing>
```

## Code Conventions

- Use `utc_now()` from models.py (not `datetime.utcnow()`) for timestamps
- Validators in [src/validators.py](../src/validators.py) raise `ValidationError` with `.to_dict()` method
- Constants defined in [src/constants.py](../src/constants.py) (pagination, currencies, categories)
- All models define `meta = {'indexes': [...]}` for MongoDB query optimization
- Services in [src/services/](../src/services/) handle complex business logic (invoice automation, speech, export/import)
## Phase 4: Sidebar Modules

### Bank Reconciliation Module
Located in [src/routes/reconciliation_routes.py](../src/routes/reconciliation_routes.py) and [src/services/reconciliation_service.py](../src/services/reconciliation_service.py):

**Models**: `BankStatement`, `ReconciliationItem`

**Endpoints**:
- `GET/POST /api/companies/<id>/bank-statements` - List/create bank statements
- `GET/DELETE /api/companies/<id>/bank-statements/<id>` - Get/delete statement
- `POST /api/companies/<id>/reconciliation/<id>/auto-match` - Auto-match transactions
- `GET /api/companies/<id>/reconciliation/<id>` - Get reconciliation report
- `POST /api/companies/<id>/reconciliation/items/<id>/match` - Manual match
- `POST /api/companies/<id>/reconciliation/items/<id>/unmatch` - Unmatch item

**Usage**:
```python
from src.services.reconciliation_service import get_reconciliation_service

service = get_reconciliation_service()
results = service.auto_match_transactions(bank_statement_id, company_id, user_id)
report = service.get_reconciliation_report(bank_statement_id, company_id)
```

### Drawings Module
Located in [src/routes/drawings_routes.py](../src/routes/drawings_routes.py):

**Models**: `Drawing`, `EquityAccount`

**Endpoints**:
- `GET/POST /api/companies/<id>/drawings` - List/create drawings
- `GET/PUT/DELETE /api/companies/<id>/drawings/<id>` - CRUD for individual drawing
- `GET /api/companies/<id>/equity` - List all equity accounts
- `GET/PUT /api/companies/<id>/equity/<owner_id>` - Get/update owner equity

**Drawing Categories**: `personal`, `equity`, `loan`

### Expense/Salary Module
Located in [src/routes/salary_routes.py](../src/routes/salary_routes.py):

**Models**: `Employee`, `SalaryPayment`, `ExpenseAccount`

**Endpoints**:
- `GET/POST /api/companies/<id>/employees` - List/create employees
- `GET/PUT/DELETE /api/companies/<id>/employees/<id>` - Employee CRUD
- `GET/POST /api/companies/<id>/salary-payments` - List/create payments
- `POST /api/companies/<id>/salary-payments/<id>/process` - Process pending payment
- `POST /api/companies/<id>/salary-payments/<id>/cancel` - Cancel payment
- `GET/POST /api/companies/<id>/expense-accounts` - List/create expense accounts
- `PUT/DELETE /api/companies/<id>/expense-accounts/<id>` - Update/delete account

**Salary Frequencies**: `hourly`, `weekly`, `biweekly`, `monthly`, `annual`
**Payment Statuses**: `pending`, `paid`, `cancelled`
**Expense Types**: `salary`, `rent`, `utilities`, `supplies`, `travel`, `marketing`, `insurance`, `other`

## Phase 5: Bug Report Forum

### Bug Report Module
Located in [src/routes/bug_report_routes.py](../src/routes/bug_report_routes.py) and [src/services/bug_report_service.py](../src/services/bug_report_service.py):

**Model**: `BugReport`

**Endpoints**:
- `GET /api/bug-reports` - List all bug reports (SuperAdmin only)
- `POST /api/bug-reports` - Create new bug report (any authenticated user)
- `GET /api/bug-reports/<id>` - Get bug report details
- `PUT /api/bug-reports/<id>` - Update bug report
- `DELETE /api/bug-reports/<id>` - Delete bug report
- `POST /api/bug-reports/<id>/comments` - Add comment to bug report
- `POST /api/bug-reports/<id>/resolve` - Mark bug as resolved (SuperAdmin only)
- `POST /api/bug-reports/<id>/close` - Close bug report
- `GET /api/bug-reports/statistics` - Get bug report statistics (SuperAdmin only)
- `GET /api/my-bug-reports` - List current user's bug reports

**Usage**:
```python
from src.services.bug_report_service import get_bug_report_service

service = get_bug_report_service()

# Create bug report
bug_report = service.create_bug_report(
    title="UI Issue",
    description="Button not working",
    reported_by_user_id=user_id,
    severity='medium',
    category='ui'
)

# Add comment
service.add_comment(bug_report_id, user_id, "Looking into this")

# Resolve bug
service.resolve_bug(bug_report_id, resolver_user_id, "Fixed in version 1.2")

# Get statistics
stats = service.get_statistics()
```

**Bug Severities**: `low`, `medium`, `high`, `critical`
**Bug Categories**: `ui`, `api`, `performance`, `data`, `security`, `feature_request`, `other`
**Bug Statuses**: `open`, `in_progress`, `resolved`, `closed`, `wont_fix`
**Bug Priorities**: 1-5 (1=highest, 5=lowest)

**Access Control**:
- SuperAdmin: Can view all bug reports, resolve bugs, view statistics
- Regular Users: Can only view/edit their own bug reports

**File Attachments**:
- Upload path: `uploads/bug_reports/`
- Allowed extensions: `png`, `jpg`, `jpeg`, `gif`, `pdf`, `txt`, `log`, `json`, `csv`
- Max file size: 10MB
- Max files per report: 5