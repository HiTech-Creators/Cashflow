# Bug Fixes Documentation

**Date:** December 18, 2025  
**Application:** Flowback Cashflow Management System  
**Total Issues Fixed:** 26

---

## Summary

| Severity | Issues Found | Status |
|----------|-------------|--------|
| 🔴 Critical/Security | 4 | ✅ Fixed |
| 🟠 Logic Bugs | 10 | ✅ Fixed |
| 🟡 Runtime Errors | 5 | ✅ Fixed |
| 🔵 Missing Validation | 2 | ✅ Fixed |
| 🟣 Model/Data Issues | 2 | ✅ Fixed |
| 🔷 API Design Issues | 2 | ✅ Fixed |
| 🔶 Performance Issues | 1 | ✅ Fixed |
| **Total** | **26** | **✅ All Fixed** |

---

## 🔴 Critical/Security Bugs (4 Issues)

### 1. Hardcoded Secret Key Fallback
**File:** `src/config.py:11`

**Issue:** Application used a hardcoded fallback secret key if `SECRET_KEY` environment variable was not set, creating a major security vulnerability in production.

**Before:**
```python
SECRET_KEY = os.environ.get('SECRET_KEY') or '333224232342323121332'
```

**After:**
```python
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("CRITICAL: SECRET_KEY environment variable must be set for production")
```

---

### 2. Permission Decorator Crash
**File:** `src/permissions.py:14-15`

**Issue:** `get_jwt_identity()` returns a string (user ID), but code tried to access it as a dictionary (`identity['role']`), causing `TypeError`.

**Before:**
```python
identity = get_jwt_identity()
if identity['role'] in allowed_roles:  # CRASH!
```

**After:**
```python
jwt_claims = get_jwt()
user_role = jwt_claims.get('role', 'User')
if user_role in allowed_roles:
```

---

### 3. Missing Authorization in `/cash-overview`
**File:** `src/routes.py:2199-2221`

**Issue:** Endpoint allowed users to query any company's data by passing a `company_id` without verifying access permissions.

**Fix:** Added `verify_company_access()` check before querying data.

---

### 4. Incorrect Balance Calculation
**File:** `src/routes.py:674`

**Issue:** Balance calculation added all transaction amounts regardless of type. Outflow transactions should be subtracted.

**Before:**
```python
current_balance = initial_balance + sum(t.amount for t in transactions)
```

**After:**
```python
current_balance = initial_balance + sum(
    t.amount if t.type == 'inflow' else -t.amount for t in transactions
)
```

---

## 🟠 Logic Bugs (10 Issues)

### 5. Undefined Variable in AI Forecast
**File:** `src/forecasting.py:61-64`

**Issue:** Variable `d` used before being defined, causing `NameError`.

**Fix:** Check first item's date type before iterating:
```python
first_item = historical_data[0]
if isinstance(first_item['date'], datetime):
    last_date = max(d['date'] for d in historical_data)
```

---

### 6. Empty Data Crash in Generate Forecast
**File:** `src/forecasting.py:32`

**Issue:** `max()` on empty sequence raised `ValueError` when no transactions existed.

**Fix:** Added early return for empty data:
```python
if not transactions:
    return {}
if not monthly_net:
    return {}
```

---

### 7. Wrong Model Attributes in Working Capital
**File:** `src/working_capital.py:34`

**Issue:** Code referenced `r.company.user_id.username` but:
- Receivable has `company_id`, not `company`
- Company doesn't have `user_id` attribute

**Fix:** Complete rewrite to find admin users through company memberships.

---

### 8. Incorrect Aging Report Logic
**File:** `src/working_capital.py:16-17`

**Issue:** Negative days (future due dates) incorrectly matched `days_overdue <= 30`.

**Fix:** Added separate 'current' bucket for not-yet-due items:
```python
if days_past_due <= 0:
    aging['current'] += item.amount
elif days_past_due <= 30:
    aging['1-30'] += item.amount
```

---

### 9. Inconsistent Return Types in get_user_companies
**File:** `src/company.py:25-33`

**Issue:** SuperAdmin got Company objects, others got ReferenceField objects.

**Fix:** Both now return actual Company objects:
```python
company_ids = [membership.company_id.id for membership in user.company_memberships]
return list(Company.objects(id__in=company_ids, is_active=True).all())
```

---

### 10. Wrong scipy Import for Seasonal Decomposition
**File:** `src/anthropic_service.py:7,23`

**Issue:** `seasonal_decompose` is from `statsmodels`, not `scipy.stats`.

**Fix:** 
```python
try:
    from statsmodels.tsa.seasonal import seasonal_decompose
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False
```

---

### 10b. SVD Did Not Converge Error (Additional Fix)
**File:** `src/anthropic_service.py`

**Issue:** `np.polyfit()` threw "SVD did not converge in Linear Least Squares" warnings when data had numerical issues.

**Fix:** Created `safe_polyfit()` function with:
- Data normalization before fitting
- Warning suppression using `warnings.catch_warnings()`
- Manual least-squares fallback
- NaN/Inf validation at each step

```python
def safe_polyfit(x, y, degree=1):
    # Normalize data to avoid numerical issues
    x_norm = (x_array - x_mean) / x_std
    y_norm = (y_array - y_mean) / y_std
    
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        coeffs_norm = np.polyfit(x_norm, y_norm, degree, rcond=None)
    
    # Fallback: manual least squares if polyfit fails
```

---

### 11. Upload Handler Missing Parameter
**Files:** `src/upload_handler.py:68`, `src/routes.py:417`

**Issue:** `process_upload()` expected 2 arguments but was called with only 1.

**Fix:** Updated function signature with defaults and passed parameters correctly:
```python
def process_upload(file, user_id=None, company_id=None):
```

---

### 12. Incorrect Income/Expense Detection
**File:** `src/routes.py:2367-2370`

**Issue:** Used `amount > 0` vs `< 0` instead of checking `type` field.

**Fix:**
```python
if transaction.type == 'inflow':
    monthly_data[month]['income'] += transaction.amount
else:
    monthly_data[month]['expense'] += transaction.amount
```

---

### 13. Wrong Outflow Query
**File:** `src/routes.py:2405-2410`

**Issue:** Queried `amount__lt=0` but outflows have positive amounts with `type='outflow'`.

**Fix:**
```python
transactions = Transaction.objects(
    user_id=current_user_id,
    company_id=company_id,
    type='outflow'
).all()
```

---

### 14. Dashboard Shows All Users' Data
**File:** `src/routes.py:732-735`

**Issue:** Dashboard queried by `company_id` only, showing all users' transactions.

**Fix:** Added `user_id` filter:
```python
inflows_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow')
```

---

## 🟡 Runtime Errors (5 Issues)

### 15. Double JSON Encoding
**File:** `src/routes.py:108`

**Issue:** `to_json()` returns JSON string, then `jsonify()` encodes again.

**Fix:** Return proper dict:
```python
return jsonify({
    "message": "Transaction added", 
    "transaction": {
        "id": str(transaction.id),
        "date": transaction.date.isoformat(),
        ...
    }
})
```

---

### 16. Invalid `__dict__` Serialization
**File:** `src/routes.py:1607-1608`

**Issue:** MongoEngine `__dict__` contains internal fields.

**Fix:** Explicit serialization:
```python
prefs_data = {
    'id': str(user_preferences.id),
    'modules': user_preferences.modules,
    'email_notifications': user_preferences.email_notifications
}
```

---

### 17. Bare Except Clauses
**File:** `src/utils.py` (multiple locations)

**Issue:** Silent `except:` hides all exceptions including system ones.

**Fix:** Specific exception handling with logging:
```python
except User.DoesNotExist:
    current_app.logger.warning(f"User not found: {user_id}")
    return None
except Exception as e:
    current_app.logger.error(f"Error: {str(e)}")
    return None
```

---

### 18. Invalid Date Handling
**Files:** `src/routes.py:874, 911, 976, 1012`

**Issue:** `datetime.fromisoformat()` crashes on invalid input.

**Fix:** Added try/except with validation:
```python
try:
    due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
except (ValueError, KeyError, AttributeError):
    return jsonify({"error": "Invalid due_date format"}), 400
```

---

### 19. Variable Shadowing Built-in
**File:** `src/routes.py:843`

**Issue:** `type = request.args.get(...)` shadows Python's `type()`.

**Fix:** Renamed to `report_type`:
```python
report_type = request.args.get('type', 'receivables')
```

---

## 🔵 Missing Validation (2 Issues)

### 20. No Amount Validation in Create Endpoints
**Files:** `src/routes.py` (receivables, payables, inventory)

**Issue:** No validation for positive amounts.

**Fix:** Added validation:
```python
if not data.get('amount') or float(data['amount']) <= 0:
    return jsonify({"error": "Amount must be a positive number"}), 400
```

---

### 21. No Date Validation in balance_by_date
**File:** `src/routes.py:2169-2172`

**Issue:** No validation before parsing date.

**Fix:**
```python
if not date_str:
    return jsonify({'error': 'Date is required'}), 400
try:
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
except ValueError:
    return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
```

---

## 🟣 Model/Data Issues (2 Issues)

### 22. `updated_at` Not Auto-Updating
**File:** `src/models.py:82`

**Issue:** `default=datetime.utcnow` only sets on creation.

**Fix:** Override `save()` method:
```python
def save(self, *args, **kwargs):
    self.updated_at = utc_now()
    return super().save(*args, **kwargs)
```

---

### 23. Deprecated `datetime.utcnow()`
**Files:** Multiple

**Issue:** `datetime.utcnow()` deprecated in Python 3.12+.

**Fix:** Created `utc_now()` helper:
```python
from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)
```

---

## 🔷 API Design Issues (2 Issues)

### 24. Non-RESTful Delete Endpoint
**File:** `src/routes.py:232`

**Issue:** Used `POST /delete/<id>` instead of `DELETE /transactions/<id>`.

**Fix:** Added proper DELETE route:
```python
@transactions_bp.route('/transactions/<transaction_id>', methods=['DELETE'])
@transactions_bp.route('/delete/<transaction_id>', methods=['POST'])  # Deprecated
```

---

### 25. Mixed GET/POST on Edit Endpoint
**File:** `src/routes.py:154`

**Issue:** Single endpoint handled both retrieval and update.

**Fix:** Added proper REST routes:
```python
@transactions_bp.route('/transactions/<transaction_id>', methods=['GET', 'PUT', 'PATCH'])
@transactions_bp.route('/edit/<transaction_id>', methods=['GET', 'POST'])  # Deprecated
```

---

## 🔶 Performance Issues (1 Issue)

### 26. Redundant Database Queries
**File:** `src/routes.py:1923-1935`

**Issue:** 4+ separate database queries for same data.

**Fix:** Single query with in-memory aggregation:
```python
all_transactions = list(Transaction.objects(user_id=current_user_id, company_id=company_id))

for t in all_transactions:
    if t.type == 'inflow':
        total_inflow += t.amount
        if t.date >= thirty_days_ago:
            monthly_revenue += t.amount
    else:
        total_outflow += t.amount
        if t.date >= thirty_days_ago:
            monthly_expenses += t.amount
```

---

## Additional Changes

### Dependencies Added
**File:** `requirements.txt`

Added:
- `statsmodels==0.14.1` - For seasonal decomposition in financial analytics
- `python-dateutil==2.8.2` - For robust date handling

---

## Testing Recommendations

1. Run full test suite after deployment
2. Verify all API endpoints with proper authentication
3. Test with edge cases (empty data, invalid inputs)
4. Verify timezone handling across different locales
5. Load test the optimized queries

---

## Migration Notes

1. **SECRET_KEY Required:** Application will not start without `SECRET_KEY` environment variable
2. **New REST Endpoints:** Old endpoints (`/delete/<id>`, `/edit/<id>`) still work but are deprecated
3. **Aging Report:** New 'current' bucket added for not-yet-due items
4. **Timezone:** All timestamps now timezone-aware (UTC)

---

---

## Files Modified

| File | Changes |
|------|---------|
| `src/config.py` | Made SECRET_KEY mandatory |
| `src/permissions.py` | Fixed JWT claims access |
| `src/routes.py` | Fixed 15+ issues (auth, serialization, validation, API design) |
| `src/models.py` | Added utc_now(), auto-update timestamps, save() overrides |
| `src/utils.py` | Replaced bare except clauses, added error logging |
| `src/forecasting.py` | Fixed undefined variable, empty data handling |
| `src/working_capital.py` | Fixed model references, aging logic |
| `src/company.py` | Fixed inconsistent return types |
| `src/anthropic_service.py` | Fixed statsmodels import |
| `src/upload_handler.py` | Fixed function signature, added validation |
| `main.py` | Updated to timezone-aware datetime |
| `requirements.txt` | Added statsmodels, python-dateutil |

---

*Generated by automated bug fix process - December 18, 2025*
