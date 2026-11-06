"""
Model tests.

Tests for:
- Model creation and validation
- Model indexes
- Model relationships
- MongoEngine constraints
"""

import pytest
from src.models import (
    User, Role, Company, Transaction, InitialBalance,
    Forecast, Budget, Receivable, Payable, Inventory, UserInvitation
)
from datetime import datetime


@pytest.mark.unit
class TestRoleModel:
    """Test Role model."""
    
    def test_create_role(self):
        """Test creating a role."""
        role = Role(
            name='TestRole',
            level=4,
            permissions=['test_permission']
        ).save()
        
        assert role.id is not None
        assert role.name == 'TestRole'
        assert role.level == 4
    
    def test_role_indexes_exist(self):
        """Test Role model has indexes."""
        meta = Role._meta
        assert 'indexes' in meta


@pytest.mark.unit
class TestTransactionModel:
    """Test Transaction model."""
    
    def test_create_transaction(self, user_a, company_a):
        """Test creating a transaction."""
        transaction = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow(),
            description='Test Transaction',
            amount=100.0,
            type='inflow',
            category='operating',
            currency='USD'
        ).save()
        
        assert transaction.id is not None
        assert transaction.amount == 100.0
    
    def test_transaction_type_validation(self, user_a, company_a):
        """Test transaction type must be valid choice."""
        with pytest.raises(Exception):  # MongoEngine ValidationError
            Transaction(
                user_id=user_a,
                company_id=company_a,
                date=datetime.utcnow(),
                description='Invalid Type',
                amount=100.0,
                type='invalid_type',  # Should fail
                category='operating',
                currency='USD'
            ).save()
    
    def test_transaction_indexes_exist(self):
        """Test Transaction model has comprehensive indexes."""
        meta = Transaction._meta
        assert 'indexes' in meta
        # Should have compound index on (user_id, company_id)
        assert any('user_id' in str(idx) and 'company_id' in str(idx) 
                   for idx in meta['indexes'] if isinstance(idx, tuple))


@pytest.mark.unit
class TestCompanyModel:
    """Test Company model."""
    
    def test_create_company(self, superadmin):
        """Test creating a company."""
        company = Company(
            name='Test Company',
            currency='USD',
            created_by=superadmin,
            is_active=True
        ).save()
        
        assert company.id is not None
        assert company.name == 'Test Company'
        assert company.is_active is True
    
    def test_company_indexes_exist(self):
        """Test Company model has indexes."""
        meta = Company._meta
        assert 'indexes' in meta


@pytest.mark.unit
class TestInitialBalanceModel:
    """Test InitialBalance model."""
    
    def test_create_initial_balance(self, user_a, company_a):
        """Test creating initial balance."""
        initial_balance = InitialBalance(
            user_id=user_a,
            company_id=company_a,
            balance=10000.0
        ).save()
        
        assert initial_balance.id is not None
        assert initial_balance.balance == 10000.0
    
    def test_initial_balance_indexes_exist(self):
        """Test InitialBalance has compound index."""
        meta = InitialBalance._meta
        assert 'indexes' in meta
        # Should have compound index on (user_id, company_id)
        assert any('user_id' in str(idx) and 'company_id' in str(idx) 
                   for idx in meta['indexes'] if isinstance(idx, tuple))


@pytest.mark.unit
class TestForecastModel:
    """Test Forecast model."""
    
    def test_create_forecast(self, user_a, company_a):
        """Test creating a forecast."""
        forecast = Forecast(
            user_id=user_a,
            company_id=company_a,
            scenario_name='Base Case',
            projections={'2024-01': 1000, '2024-02': 1100}
        ).save()
        
        assert forecast.id is not None
        assert forecast.scenario_name == 'Base Case'


@pytest.mark.unit
class TestBudgetModel:
    """Test Budget model."""
    
    def test_create_budget(self, company_a, user_a):
        """Test creating a budget."""
        budget = Budget(
            company_id=company_a,
            created_by=user_a,
            category='operating',
            amount=5000.0,
            period='2024-01'
        ).save()
        
        assert budget.id is not None
        assert budget.amount == 5000.0
    
    def test_budget_indexes_exist(self):
        """Test Budget model has indexes for variance queries."""
        meta = Budget._meta
        assert 'indexes' in meta


@pytest.mark.unit
class TestWorkingCapitalModels:
    """Test Receivable, Payable, and Inventory models."""
    
    def test_create_receivable(self, company_a, user_a):
        """Test creating a receivable."""
        receivable = Receivable(
            company_id=company_a,
            created_by=user_a,
            amount=1500.0,
            due_date=datetime.utcnow(),
            status='pending',
            description='Test Invoice'
        ).save()
        
        assert receivable.id is not None
        assert receivable.status == 'pending'
    
    def test_create_payable(self, company_a, user_a):
        """Test creating a payable."""
        payable = Payable(
            company_id=company_a,
            created_by=user_a,
            amount=2000.0,
            due_date=datetime.utcnow(),
            status='pending',
            description='Test Bill'
        ).save()
        
        assert payable.id is not None
    
    def test_create_inventory(self, company_a, user_a):
        """Test creating inventory item."""
        inventory = Inventory(
            company_id=company_a,
            created_by=user_a,
            item_name='Test Product',
            quantity=100,
            value=5000.0
        ).save()
        
        assert inventory.id is not None
        assert inventory.quantity == 100

