# Test Suite for Cashflow Backend API

**Version:** 1.0.0  
**Framework:** pytest  
**Coverage Target:** 80%+

---

## 📚 Test Structure

```
tests/
├── __init__.py                    # Test package initialization
├── conftest.py                    # Shared fixtures and configuration
├── test_authentication.py         # Auth & JWT tests (70+ tests)
├── test_multitenant.py           # Multi-tenant isolation tests (40+ tests)
├── test_validation.py            # Input validation tests (50+ tests)
├── test_transactions.py          # Transaction CRUD tests (40+ tests)
├── test_endpoints.py             # All endpoint tests (60+ tests)
├── test_security_features.py     # Security features tests (30+ tests)
├── test_validators.py            # Validator unit tests (50+ tests)
├── test_utils.py                 # Utility function tests (30+ tests)
├── test_models.py                # Model tests (30+ tests)
├── test_performance.py           # Performance benchmarks (20+ tests)
└── README.md                     # This file
```

**Total:** ~420+ tests covering all aspects of the API

---

## 🚀 Quick Start

### Install Test Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- `pytest==7.4.3` - Testing framework
- `pytest-flask==1.3.0` - Flask testing utilities
- `pytest-cov==4.1.0` - Code coverage
- `pytest-mock==3.12.0` - Mocking utilities
- `mongomock==4.1.2` - MongoDB mocking
- `faker==20.1.0` - Test data generation

### Run All Tests
```bash
pytest
```

### Run with Coverage
```bash
pytest --cov=src --cov=main --cov-report=html
```

View coverage report:
```bash
# Open htmlcov/index.html in browser
```

---

## 🎯 Running Specific Tests

### By Test File
```bash
pytest tests/test_authentication.py      # Auth tests only
pytest tests/test_multitenant.py         # Multi-tenant tests
pytest tests/test_validation.py          # Validation tests
pytest tests/test_security_features.py   # Security tests
```

### By Test Class
```bash
pytest tests/test_authentication.py::TestAuthentication
pytest tests/test_multitenant.py::TestDataIsolation
```

### By Test Function
```bash
pytest tests/test_authentication.py::TestAuthentication::test_login_success
```

### By Marker
```bash
pytest -m unit              # Run only unit tests (fast)
pytest -m integration       # Run integration tests
pytest -m security          # Run security tests
pytest -m performance       # Run performance tests
pytest -m auth              # Run authentication tests
pytest -m multitenant       # Run multi-tenant tests
pytest -m validation        # Run validation tests
```

### Multiple Markers
```bash
pytest -m "unit and auth"          # Unit tests AND auth tests
pytest -m "integration and not slow"  # Integration but not slow tests
```

---

## 🏷️ Test Markers

| Marker | Description | Count |
|--------|-------------|-------|
| `unit` | Fast, isolated unit tests | ~200 |
| `integration` | Tests requiring DB/app context | ~180 |
| `security` | Security-related tests | ~80 |
| `performance` | Performance benchmarks | ~20 |
| `auth` | Authentication tests | ~50 |
| `multitenant` | Multi-tenant isolation tests | ~40 |
| `validation` | Input validation tests | ~50 |
| `ratelimit` | Rate limiting tests | ~10 |
| `slow` | Slow-running tests (> 1 second) | ~10 |

---

## 📊 Test Coverage

### Coverage by Module

| Module | Target | Description |
|--------|--------|-------------|
| `src/validators.py` | 95%+ | Validation functions |
| `src/utils.py` | 90%+ | Utility functions |
| `src/auth.py` | 90%+ | Authentication logic |
| `src/models.py` | 85%+ | Database models |
| `main.py` | 80%+ | Main endpoints |
| `src/routes.py` | 85%+ | Blueprint routes |

### How to Check Coverage
```bash
# Run tests with coverage
pytest --cov=src --cov=main --cov-report=term-missing

# Generate HTML report
pytest --cov=src --cov=main --cov-report=html

# View in browser
open htmlcov/index.html  # macOS
start htmlcov/index.html  # Windows
xdg-open htmlcov/index.html  # Linux
```

---

## 🧪 Test Categories

### 1. Authentication Tests (`test_authentication.py`)

**Coverage:**
- ✅ User login (success/failure)
- ✅ JWT token generation
- ✅ Token validation
- ✅ Invalid tokens
- ✅ Missing tokens
- ✅ Expired tokens
- ✅ SuperAdmin creation
- ✅ Password change security

**Example:**
```bash
pytest tests/test_authentication.py -v
```

### 2. Multi-Tenant Tests (`test_multitenant.py`)

**Coverage:**
- ✅ Data isolation between companies
- ✅ Cross-company access prevention
- ✅ SuperAdmin access to all companies
- ✅ Default company selection
- ✅ Company access verification
- ✅ Per-company initial balances

**Example:**
```bash
pytest tests/test_multitenant.py -v
```

### 3. Validation Tests (`test_validation.py`)

**Coverage:**
- ✅ Transaction validation
- ✅ Initial balance validation
- ✅ File upload validation
- ✅ Bulk operation validation
- ✅ Partial failure handling

**Example:**
```bash
pytest tests/test_validation.py -v
```

### 4. Transaction Tests (`test_transactions.py`)

**Coverage:**
- ✅ Transaction CRUD operations
- ✅ Pagination
- ✅ Export functionality (CSV/Excel)
- ✅ Analytics endpoints
- ✅ Authorization checks

**Example:**
```bash
pytest tests/test_transactions.py -v
```

### 5. Endpoint Tests (`test_endpoints.py`)

**Coverage:**
- ✅ Dashboard endpoints
- ✅ Forecast endpoints
- ✅ Budget endpoints
- ✅ Working capital endpoints
- ✅ Company management
- ✅ User management
- ✅ Admin endpoints

**Example:**
```bash
pytest tests/test_endpoints.py -v
```

### 6. Security Tests (`test_security_features.py`)

**Coverage:**
- ✅ Security headers
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Request ID tracking
- ✅ Health check
- ✅ Debug endpoint protection
- ✅ Authorization before fetch
- ✅ Deprecation warnings

**Example:**
```bash
pytest tests/test_security_features.py -v
```

### 7. Validator Unit Tests (`test_validators.py`)

**Coverage:**
- ✅ All 14 validation functions
- ✅ Edge cases
- ✅ Error messages
- ✅ Type conversions

**Example:**
```bash
pytest tests/test_validators.py -v
```

### 8. Utility Tests (`test_utils.py`)

**Coverage:**
- ✅ Company access verification
- ✅ Role checks
- ✅ User permissions
- ✅ Financial calculations

**Example:**
```bash
pytest tests/test_utils.py -v
```

### 9. Model Tests (`test_models.py`)

**Coverage:**
- ✅ Model creation
- ✅ Model validation
- ✅ Model indexes
- ✅ Constraints

**Example:**
```bash
pytest tests/test_models.py -v
```

### 10. Performance Tests (`test_performance.py`)

**Coverage:**
- ✅ Database query performance
- ✅ Response time benchmarks
- ✅ Pagination performance
- ✅ Bulk operation performance

**Example:**
```bash
pytest tests/test_performance.py -v
```

---

## 🔧 Configuration

### pytest.ini
Configuration file with:
- Test discovery patterns
- Coverage settings (80% minimum)
- Logging configuration
- Test markers
- Environment variables

### conftest.py
Shared fixtures:
- `app` - Flask application
- `client` - Test client
- `db` - Database (auto-cleanup)
- `superadmin`, `user_a`, `user_b` - Test users
- `company_a`, `company_b` - Test companies
- `auth_headers_*` - JWT tokens
- Helper functions for assertions

---

## 📋 Running Tests

### Run All Tests (Fast)
```bash
pytest -v
```

### Run Only Fast Tests
```bash
pytest -m "unit and not slow"
```

### Run Specific Category
```bash
pytest -m security      # Security tests
pytest -m multitenant   # Multi-tenant tests
pytest -m validation    # Validation tests
```

### Run with Detailed Output
```bash
pytest -vv              # Very verbose
pytest -s               # Show print statements
pytest -x               # Stop on first failure
pytest --pdb            # Drop into debugger on failure
```

### Run with Coverage
```bash
# Terminal report
pytest --cov=src --cov=main --cov-report=term-missing

# HTML report
pytest --cov=src --cov=main --cov-report=html

# Both
pytest --cov=src --cov=main --cov-report=term-missing --cov-report=html
```

### Run Performance Tests
```bash
pytest -m performance -v
```

### Skip Slow Tests
```bash
pytest -m "not slow"
```

---

## 🎯 Test Workflow

### During Development
```bash
# Run only unit tests (fast feedback)
pytest -m unit -v

# Run related tests
pytest tests/test_validators.py -v
```

### Before Commit
```bash
# Run all tests except slow ones
pytest -m "not slow" -v

# Check coverage
pytest --cov=src --cov-report=term-missing
```

### Before Deployment
```bash
# Run ALL tests including slow ones
pytest -v

# Generate coverage report
pytest --cov=src --cov=main --cov-report=html

# Check coverage meets 80% minimum
# (pytest.ini enforces this)
```

### CI/CD Pipeline
```bash
# Run all tests with coverage
pytest --cov=src --cov=main --cov-report=xml --cov-fail-under=80 -v
```

---

## 🔍 Debugging Failed Tests

### Show More Details
```bash
pytest -vv --tb=long
```

### Stop on First Failure
```bash
pytest -x
```

### Enter Debugger on Failure
```bash
pytest --pdb
```

### Show Print Statements
```bash
pytest -s
```

### Run Specific Failed Test
```bash
pytest tests/test_authentication.py::TestAuthentication::test_login_success -v
```

---

## 📊 Expected Test Results

### Test Summary (All Passing)
```
======================== test session starts =========================
collected 420 items

tests/test_authentication.py ........................................  [ 16%]
tests/test_multitenant.py .......................................  [ 25%]
tests/test_validation.py .......................................  [ 37%]
tests/test_transactions.py .....................................  [ 47%]
tests/test_endpoints.py ........................................  [ 61%]
tests/test_security_features.py ................................  [ 68%]
tests/test_validators.py .......................................  [ 80%]
tests/test_utils.py ............................................  [ 87%]
tests/test_models.py ...........................................  [ 94%]
tests/test_performance.py ......................................  [100%]

========================= 420 passed in 45.23s ==========================
```

### Coverage Report (Target: 80%+)
```
Name                    Stmts   Miss  Cover   Missing
-----------------------------------------------------
src/validators.py         120      5    96%   45-47
src/utils.py              150     15    90%   
src/auth.py               100      8    92%   
src/models.py              80      5    94%   
main.py                   400     80    80%   
src/routes.py             200     25    88%   
-----------------------------------------------------
TOTAL                    1050    138    87%
```

---

## ⚠️ Important Notes

### Database Setup
Tests use a separate test database: `cashflow_test_db`
- Created automatically
- Cleaned after each test
- Never affects production data

### Rate Limiting
Rate limiting is **disabled** in tests by default:
```python
app.config['RATELIMIT_ENABLED'] = False
```

To test rate limiting, use the specific rate limit tests in `test_security_features.py`.

### External API Calls
Tests that require external APIs (e.g., Anthropic AI) are **skipped** by default:
```python
@pytest.mark.skip(reason="Requires ANTHROPIC_API_KEY")
```

### Slow Tests
Performance tests are marked as `slow`:
```bash
# Skip slow tests for fast feedback
pytest -m "not slow"
```

---

## 🧰 Useful Commands

### Test Discovery
```bash
# List all tests without running
pytest --collect-only

# List tests with markers
pytest --markers
```

### Test Report
```bash
# JUnit XML (for CI/CD)
pytest --junitxml=test-results.xml

# Generate test report
pytest --html=report.html --self-contained-html
```

### Parallel Testing
```bash
# Install pytest-xdist
pip install pytest-xdist

# Run tests in parallel
pytest -n auto  # Use all CPU cores
pytest -n 4     # Use 4 workers
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```bash
# Ensure MongoDB is running
sudo systemctl start mongodb  # Linux
brew services start mongodb-community  # macOS

# Or use Docker
docker run -d -p 27017:27017 mongo:latest
```

### Import Errors
```bash
# Ensure you're in project root
cd /path/to/cashflow_mahwiz_backend

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest
```

### Fixture Not Found
```bash
# Check conftest.py is present
ls tests/conftest.py

# Run with verbose output
pytest -v
```

### All Tests Failing
```bash
# Check MongoDB connection
python -c "from mongoengine import connect; connect('test'); print('Connected')"

# Check imports
python -c "from main import app; print('Imports OK')"

# Run single test for debugging
pytest tests/test_authentication.py::TestAuthentication::test_login_success -vv
```

---

## ✅ Test Checklist

### Before Committing Code
- [ ] Run: `pytest -m unit` (fast tests pass)
- [ ] Run: `pytest -m "not slow"` (all non-slow tests pass)
- [ ] Check: Coverage > 80%
- [ ] Fix: Any failing tests

### Before Deploying to Staging
- [ ] Run: `pytest` (all tests pass)
- [ ] Run: `pytest --cov=src --cov=main` (coverage report)
- [ ] Review: Any skipped tests
- [ ] Run: Performance tests
- [ ] Verify: No regressions

### Before Production Deployment
- [ ] Run: Full test suite on staging data
- [ ] Run: Performance benchmarks
- [ ] Run: Security tests
- [ ] Verify: All assertions passing
- [ ] Review: Test logs for warnings

---

## 📈 Test Metrics

### Current Status (Expected)
- **Total Tests:** ~420
- **Passing:** ~410 (98%)
- **Skipped:** ~10 (AI API tests)
- **Coverage:** ~87%
- **Duration:** ~45 seconds

### Performance Benchmarks
- **Unit tests:** <10 seconds
- **Integration tests:** ~30 seconds
- **All tests:** ~45 seconds
- **With coverage:** ~60 seconds

---

## 🎓 Writing New Tests

### Test Structure Template
```python
import pytest

@pytest.mark.unit  # Add appropriate markers
class TestMyFeature:
    """Test description."""
    
    def test_success_case(self, client, auth_headers_user_a):
        """Test successful operation."""
        response = client.post('/my-endpoint',
            headers=auth_headers_user_a,
            json={'data': 'value'}
        )
        
        assert response.status_code == 200
        assert 'expected_key' in response.json
    
    def test_failure_case(self, client, auth_headers_user_a):
        """Test failure scenario."""
        response = client.post('/my-endpoint',
            headers=auth_headers_user_a,
            json={'invalid': 'data'}
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
```

### Using Fixtures
```python
def test_with_fixtures(
    self, client,                  # Test client
    auth_headers_user_a,           # JWT token for user_a
    company_a,                     # Company A instance
    sample_transaction_a           # Sample transaction
):
    # Your test code
    pass
```

### Adding Markers
```python
@pytest.mark.unit          # Unit test
@pytest.mark.integration   # Integration test
@pytest.mark.security      # Security test
@pytest.mark.slow          # Slow test (>1 second)
def test_something(self):
    pass
```

---

## 🎯 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest --cov=src --cov=main --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## 📚 Resources

### Pytest Documentation
- https://docs.pytest.org/
- https://pytest-flask.readthedocs.io/

### Testing Best Practices
- Write tests for all new features
- Test both success and failure cases
- Use descriptive test names
- Keep tests independent
- Use fixtures for setup/teardown
- Mock external dependencies

---

## ✨ Test Quality Standards

### Every Test Should:
- ✅ Have a clear, descriptive name
- ✅ Have a docstring explaining what it tests
- ✅ Test one specific behavior
- ✅ Use appropriate fixtures
- ✅ Have clear assertions
- ✅ Clean up after itself (via fixtures)
- ✅ Be independent of other tests
- ✅ Run in <1 second (except performance tests)

---

## 🎊 Success Criteria

### Test Suite is Successful When:
- ✅ 95%+ tests passing
- ✅ 80%+ code coverage
- ✅ All security tests passing
- ✅ All multi-tenant tests passing
- ✅ Performance benchmarks met
- ✅ No critical failures
- ✅ Fast execution (<2 minutes)

---

**🎉 Happy Testing! Your comprehensive test suite is ready!**

**Quick Start:** `pytest -v`  
**Coverage:** `pytest --cov=src --cov=main --cov-report=html`  
**Fast Tests:** `pytest -m unit`  

**Total: ~420 tests covering all aspects of your API!**

