"""
Pytest configuration and shared fixtures for Cashflow Backend API tests.

This module provides:
- Flask app fixture
- Database fixtures
- Authentication fixtures
- Test data factories
- Common test utilities
"""

import pytest
import os
from datetime import datetime, timedelta
from mongoengine import connect, disconnect
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash

# Set test environment variables before importing app
# Use existing MONGO_URI from environment but switch to test database
production_mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cashflow_db')
# Replace database name with test database
if 'mongodb+srv://' in production_mongo_uri or 'mongodb://' in production_mongo_uri:
    # For Atlas or any MongoDB URI, replace the database name with test database
    if '?' in production_mongo_uri:
        # Has query parameters
        base_uri = production_mongo_uri.split('?')[0]
        query_params = '?' + production_mongo_uri.split('?')[1]
        if '/' in base_uri.rsplit('/', 1)[-1]:
            test_uri = base_uri.rsplit('/', 1)[0] + '/cashflow_test_db' + query_params
        else:
            test_uri = base_uri + '/cashflow_test_db' + query_params
    else:
        # No query parameters
        if '/' in production_mongo_uri.rsplit('/', 1)[-1]:
            test_uri = production_mongo_uri.rsplit('/', 1)[0] + '/cashflow_test_db'
        else:
            test_uri = production_mongo_uri + '/cashflow_test_db'
    os.environ['MONGO_URI'] = test_uri
else:
    os.environ['MONGO_URI'] = 'mongodb://localhost:27017/cashflow_test_db'

os.environ['FLASK_ENV'] = 'testing'
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret'
os.environ['ANTHROPIC_API_KEY'] = os.environ.get('ANTHROPIC_API_KEY', 'test-api-key')

from main import app as flask_app
from src.models import (
    User, Role, Company, Transaction, InitialBalance,
    Forecast, Budget, Receivable, Payable, Inventory,
    UserInvitation, CompanyMembership, InvoiceTemplate, Invoice,
    BugReport
)


@pytest.fixture(scope='session')
def app():
    """Create and configure a Flask application instance for testing."""
    # Get the test database URI from environment (already set above)
    test_db_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cashflow_test_db')
    
    flask_app.config.update({
        'TESTING': True,
        'MONGODB_SETTINGS': {
            'host': test_db_uri,
            'db': 'cashflow_test_db'
        },
        'WTF_CSRF_ENABLED': False,
        'JWT_SECRET_KEY': 'test-jwt-secret',
    })
    
    # Disable rate limiting and security headers for tests
    flask_app.config['RATELIMIT_ENABLED'] = False
    flask_app.config['TALISMAN_ENABLED'] = False
    
    yield flask_app


@pytest.fixture(scope='function')
def client(app):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture(scope='function')
def runner(app):
    """Create a test CLI runner."""
    return app.test_cli_runner()


@pytest.fixture(scope='function', autouse=True)
def db(app):
    """
    Set up and tear down test database for each test.
    Automatically used for all tests.
    """
    # Connect to test database (uses MONGO_URI from environment, already modified to use test DB)
    disconnect()
    test_db_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cashflow_test_db')
    connect('cashflow_test_db', host=test_db_uri)
    
    yield
    
    # Clean up after test
    try:
        User.drop_collection()
        Role.drop_collection()
        Company.drop_collection()
        Transaction.drop_collection()
        InitialBalance.drop_collection()
        Forecast.drop_collection()
        Budget.drop_collection()
        Receivable.drop_collection()
        Payable.drop_collection()
        Inventory.drop_collection()
        UserInvitation.drop_collection()
        InvoiceTemplate.drop_collection()
        Invoice.drop_collection()
        BugReport.drop_collection()
    except Exception as e:
        # Ignore errors during cleanup (e.g., collection doesn't exist)
        pass
    
    disconnect()


@pytest.fixture
def superadmin_role():
    """Create SuperAdmin role."""
    return Role(
        name='SuperAdmin',
        level=1,
        permissions=['manage_companies', 'manage_users', 'view_all_data', 'system_admin']
    ).save()


@pytest.fixture
def company_admin_role():
    """Create CompanyAdmin role."""
    return Role(
        name='CompanyAdmin',
        level=2,
        permissions=['manage_company_users', 'view_company_data', 'manage_company_settings']
    ).save()


@pytest.fixture
def user_role():
    """Create User role."""
    return Role(
        name='User',
        level=3,
        permissions=['view_company_data', 'create_transactions']
    ).save()


@pytest.fixture
def superadmin(superadmin_role):
    """Create a SuperAdmin user for testing."""
    return User(
        username='superadmin',
        email='superadmin@test.com',
        password_hash=generate_password_hash('SuperAdmin123'),
        role_id=superadmin_role,
        is_active=True,
        company_memberships=[]
    ).save()


@pytest.fixture
def company_a(superadmin):
    """Create Company A for testing."""
    return Company(
        name='Company A',
        currency='USD',
        created_by=superadmin,
        is_active=True
    ).save()


@pytest.fixture
def company_b(superadmin):
    """Create Company B for testing."""
    return Company(
        name='Company B',
        currency='EUR',
        created_by=superadmin,
        is_active=True
    ).save()


@pytest.fixture
def user_a(user_role, company_a, superadmin):
    """Create a user belonging to Company A."""
    user = User(
        username='user_a',
        email='usera@test.com',
        password_hash=generate_password_hash('UserA123'),
        role_id=user_role,
        is_active=True,
        created_by=superadmin,
        company_memberships=[
            CompanyMembership(
                company_id=company_a,
                role='user',
                invited_by=superadmin
            )
        ]
    ).save()
    return user


@pytest.fixture
def user_b(user_role, company_b, superadmin):
    """Create a user belonging to Company B."""
    user = User(
        username='user_b',
        email='userb@test.com',
        password_hash=generate_password_hash('UserB123'),
        role_id=user_role,
        is_active=True,
        created_by=superadmin,
        company_memberships=[
            CompanyMembership(
                company_id=company_b,
                role='user',
                invited_by=superadmin
            )
        ]
    ).save()
    return user


@pytest.fixture
def company_admin_a(company_admin_role, company_a, superadmin):
    """Create a CompanyAdmin for Company A."""
    user = User(
        username='admin_a',
        email='admina@test.com',
        password_hash=generate_password_hash('AdminA123'),
        role_id=company_admin_role,
        is_active=True,
        created_by=superadmin,
        company_memberships=[
            CompanyMembership(
                company_id=company_a,
                role='admin',
                invited_by=superadmin
            )
        ]
    ).save()
    return user


@pytest.fixture
def user_both_companies(user_role, company_a, company_b, superadmin):
    """Create a user belonging to both companies."""
    user = User(
        username='user_both',
        email='userboth@test.com',
        password_hash=generate_password_hash('UserBoth123'),
        role_id=user_role,
        is_active=True,
        created_by=superadmin,
        company_memberships=[
            CompanyMembership(
                company_id=company_a,
                role='user',
                invited_by=superadmin
            ),
            CompanyMembership(
                company_id=company_b,
                role='user',
                invited_by=superadmin
            )
        ]
    ).save()
    return user


@pytest.fixture
def auth_headers_superadmin(app, superadmin):
    """Generate JWT token and headers for superadmin."""
    with app.app_context():
        token = create_access_token(
            identity=str(superadmin.id),
            additional_claims={
                'username': superadmin.username,
                'email': superadmin.email,
                'role': 'SuperAdmin',
                'role_level': 1
            }
        )
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture
def auth_headers_user_a(app, user_a, company_a):
    """Generate JWT token and headers for user_a."""
    with app.app_context():
        token = create_access_token(
            identity=str(user_a.id),
            additional_claims={
                'username': user_a.username,
                'email': user_a.email,
                'role': 'User',
                'role_level': 3,
                'default_company_id': str(company_a.id)
            }
        )
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture
def auth_headers_user_b(app, user_b, company_b):
    """Generate JWT token and headers for user_b."""
    with app.app_context():
        token = create_access_token(
            identity=str(user_b.id),
            additional_claims={
                'username': user_b.username,
                'email': user_b.email,
                'role': 'User',
                'role_level': 3,
                'default_company_id': str(company_b.id)
            }
        )
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture
def auth_headers_admin_a(app, company_admin_a, company_a):
    """Generate JWT token and headers for company_admin_a."""
    with app.app_context():
        token = create_access_token(
            identity=str(company_admin_a.id),
            additional_claims={
                'username': company_admin_a.username,
                'email': company_admin_a.email,
                'role': 'CompanyAdmin',
                'role_level': 2,
                'default_company_id': str(company_a.id)
            }
        )
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture
def sample_transaction_a(user_a, company_a):
    """Create a sample transaction for Company A."""
    return Transaction(
        user_id=user_a,
        company_id=company_a,
        date=datetime.utcnow(),
        description='Test Transaction A',
        amount=1000.0,
        type='inflow',
        category='operating',
        currency='USD'
    ).save()


@pytest.fixture
def sample_transaction_b(user_b, company_b):
    """Create a sample transaction for Company B."""
    return Transaction(
        user_id=user_b,
        company_id=company_b,
        date=datetime.utcnow(),
        description='Test Transaction B',
        amount=500.0,
        type='outflow',
        category='operating',
        currency='EUR'
    ).save()


@pytest.fixture
def sample_transactions_a(user_a, company_a):
    """Create multiple sample transactions for Company A."""
    transactions = []
    for i in range(10):
        trans = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow() - timedelta(days=i),
            description=f'Transaction {i}',
            amount=100.0 * (i + 1),
            type='inflow' if i % 2 == 0 else 'outflow',
            category='operating',
            currency='USD'
        ).save()
        transactions.append(trans)
    return transactions


# Helper functions for tests

def assert_valid_jwt_error(response):
    """Assert response is a valid JWT error."""
    assert response.status_code == 401
    assert 'error' in response.json
    assert 'Invalid or missing JWT token' in response.json['error']


def assert_forbidden_error(response):
    """Assert response is a valid forbidden error."""
    assert response.status_code == 403
    assert 'error' in response.json


def assert_validation_error(response, field=None):
    """Assert response is a valid validation error."""
    assert response.status_code == 400
    assert 'error' in response.json
    if field:
        assert response.json.get('field') == field


def assert_not_found_error(response):
    """Assert response is a valid not found error."""
    assert response.status_code == 404
    assert 'error' in response.json


def assert_rate_limit_error(response):
    """Assert response is a rate limit error."""
    assert response.status_code == 429
    assert 'error' in response.json
    assert 'Rate limit exceeded' in response.json['error']

