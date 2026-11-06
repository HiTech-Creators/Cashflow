"""
Tests for Phase 4: Sidebar Modules

This module tests:
- Bank Reconciliation (4.1)
- Drawings Module (4.2)
- Expense/Salary Module (4.3)
"""

import pytest
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token

from src.models import (
    BankStatement, ReconciliationItem, Drawing, EquityAccount,
    Employee, SalaryPayment, ExpenseAccount, Transaction, CompanyMembership
)


# =============================================================================
# Bank Reconciliation Tests (4.1)
# =============================================================================

class TestBankStatements:
    """Test bank statement CRUD operations."""
    
    def test_create_bank_statement(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating a bank statement."""
        data = {
            "bank_name": "Chase Bank",
            "account_number": "****1234",
            "statement_date": "2026-01-31",
            "opening_balance": 10000.00,
            "closing_balance": 12500.00
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/bank-statements',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['bank_statement']['bank_name'] == 'Chase Bank'
        assert response.json['bank_statement']['opening_balance'] == 10000.00
    
    def test_create_bank_statement_with_items(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating a bank statement with reconciliation items."""
        data = {
            "bank_name": "Chase Bank",
            "account_number": "****1234",
            "statement_date": "2026-01-31",
            "opening_balance": 10000.00,
            "closing_balance": 12500.00,
            "items": [
                {
                    "bank_date": "2026-01-15",
                    "bank_description": "Client Payment",
                    "bank_amount": 2000.00,
                    "bank_reference": "REF001"
                },
                {
                    "bank_date": "2026-01-20",
                    "bank_description": "Office Rent",
                    "bank_amount": -500.00,
                    "bank_reference": "REF002"
                }
            ]
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/bank-statements',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['items_created'] == 2
    
    def test_list_bank_statements(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing bank statements."""
        # Create a statement first
        BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/bank-statements',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['bank_statements']) == 1
    
    def test_get_bank_statement_detail(self, client, auth_headers_user_a, company_a, user_a):
        """Test getting bank statement with items."""
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/bank-statements/{statement.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['bank_name'] == 'Chase Bank'
    
    def test_delete_bank_statement(self, client, auth_headers_user_a, company_a, user_a):
        """Test deleting bank statement."""
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        response = client.delete(
            f'/api/companies/{company_a.id}/bank-statements/{statement.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert BankStatement.objects(id=statement.id).first() is None


class TestReconciliation:
    """Test reconciliation operations."""
    
    def test_auto_match_transactions(self, client, auth_headers_user_a, company_a, user_a):
        """Test auto-matching bank items with transactions."""
        # Create bank statement with items
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        # Create matching transaction
        transaction = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow(),
            description="Client Payment",
            amount=2000.00,
            type='inflow',
            category='operating',
            currency='USD'
        ).save()
        
        # Create reconciliation item
        ReconciliationItem(
            company_id=company_a,
            bank_statement=statement,
            bank_date=datetime.utcnow(),
            bank_description="Client Payment",
            bank_amount=2000.00,
            bank_reference="REF001",
            status='pending'
        ).save()
        
        response = client.post(
            f'/api/companies/{company_a.id}/reconciliation/{statement.id}/auto-match',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'matched' in response.json
    
    def test_manual_match(self, client, auth_headers_user_a, company_a, user_a):
        """Test manual matching of reconciliation item."""
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        transaction = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow(),
            description="Client Payment",
            amount=2000.00,
            type='inflow',
            category='operating',
            currency='USD'
        ).save()
        
        item = ReconciliationItem(
            company_id=company_a,
            bank_statement=statement,
            bank_date=datetime.utcnow(),
            bank_description="Client Payment",
            bank_amount=2000.00,
            bank_reference="REF001",
            status='pending'
        ).save()
        
        response = client.post(
            f'/api/companies/{company_a.id}/reconciliation/items/{item.id}/match',
            json={"transaction_id": str(transaction.id), "notes": "Manual match"},
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['item']['status'] == 'matched'
    
    def test_unmatch(self, client, auth_headers_user_a, company_a, user_a):
        """Test unmatching a reconciliation item."""
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        transaction = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow(),
            description="Client Payment",
            amount=2000.00,
            type='inflow',
            category='operating',
            currency='USD'
        ).save()
        
        item = ReconciliationItem(
            company_id=company_a,
            bank_statement=statement,
            bank_date=datetime.utcnow(),
            bank_description="Client Payment",
            bank_amount=2000.00,
            bank_reference="REF001",
            status='matched',
            transaction=transaction
        ).save()
        
        response = client.post(
            f'/api/companies/{company_a.id}/reconciliation/items/{item.id}/unmatch',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['item']['status'] == 'pending'
    
    def test_get_reconciliation_report(self, client, auth_headers_user_a, company_a, user_a):
        """Test getting reconciliation report."""
        statement = BankStatement(
            company_id=company_a,
            bank_name="Chase Bank",
            account_number="****1234",
            statement_date=datetime.utcnow(),
            opening_balance=10000.00,
            closing_balance=12500.00,
            uploaded_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/reconciliation/{statement.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'total_items' in response.json


# =============================================================================
# Drawings Module Tests (4.2)
# =============================================================================

class TestDrawings:
    """Test drawings CRUD operations."""
    
    def test_create_drawing(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating a drawing."""
        data = {
            "owner_id": str(user_a.id),
            "date": "2026-01-15",
            "description": "Owner withdrawal for personal use",
            "amount": 5000.00,
            "category": "personal"
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/drawings',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['drawing']['amount'] == 5000.00
    
    def test_create_drawing_with_transaction(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating a drawing that also creates a transaction."""
        data = {
            "owner_id": str(user_a.id),
            "date": "2026-01-15",
            "description": "Owner withdrawal",
            "amount": 3000.00,
            "category": "personal",
            "create_transaction": True
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/drawings',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['drawing']['transaction_id'] is not None
    
    def test_list_drawings(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing drawings."""
        Drawing(
            company_id=company_a,
            owner=user_a,
            date=datetime.utcnow(),
            description="Test drawing",
            amount=1000.00,
            category='personal',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/drawings',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['drawings']) == 1
    
    def test_list_drawings_with_filter(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing drawings with owner filter."""
        Drawing(
            company_id=company_a,
            owner=user_a,
            date=datetime.utcnow(),
            description="Test drawing",
            amount=1000.00,
            category='personal',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/drawings?owner_id={user_a.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['drawings']) == 1
    
    def test_update_drawing(self, client, auth_headers_user_a, company_a, user_a):
        """Test updating a drawing."""
        drawing = Drawing(
            company_id=company_a,
            owner=user_a,
            date=datetime.utcnow(),
            description="Test drawing",
            amount=1000.00,
            category='personal',
            created_by=user_a
        ).save()
        
        response = client.put(
            f'/api/companies/{company_a.id}/drawings/{drawing.id}',
            json={"amount": 1500.00, "description": "Updated drawing"},
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['drawing']['amount'] == 1500.00
    
    def test_delete_drawing(self, client, auth_headers_user_a, company_a, user_a):
        """Test deleting a drawing."""
        drawing = Drawing(
            company_id=company_a,
            owner=user_a,
            date=datetime.utcnow(),
            description="Test drawing",
            amount=1000.00,
            category='personal',
            created_by=user_a
        ).save()
        
        response = client.delete(
            f'/api/companies/{company_a.id}/drawings/{drawing.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert Drawing.objects(id=drawing.id).first() is None


class TestEquityAccounts:
    """Test equity account operations."""
    
    def test_list_equity_accounts(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing equity accounts."""
        EquityAccount(
            company_id=company_a,
            owner=user_a,
            opening_balance=50000.00,
            current_balance=45000.00,
            total_drawings=5000.00,
            total_contributions=0.00
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/equity',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['equity_accounts']) == 1
    
    def test_get_equity_account(self, client, auth_headers_user_a, company_a, user_a):
        """Test getting specific owner's equity account."""
        EquityAccount(
            company_id=company_a,
            owner=user_a,
            opening_balance=50000.00,
            current_balance=45000.00,
            total_drawings=5000.00,
            total_contributions=0.00
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/equity/{user_a.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['opening_balance'] == 50000.00
    
    def test_update_equity_account(self, client, auth_headers_user_a, company_a, user_a):
        """Test updating equity account (contribution)."""
        EquityAccount(
            company_id=company_a,
            owner=user_a,
            opening_balance=50000.00,
            current_balance=45000.00,
            total_drawings=5000.00,
            total_contributions=0.00
        ).save()
        
        response = client.put(
            f'/api/companies/{company_a.id}/equity/{user_a.id}',
            json={"contribution_amount": 10000.00},
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['equity_account']['total_contributions'] == 10000.00


# =============================================================================
# Employee/Salary Module Tests (4.3)
# =============================================================================

class TestEmployees:
    """Test employee CRUD operations."""
    
    def test_create_employee(self, client, auth_headers_user_a, company_a):
        """Test creating an employee."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "employee_id": "EMP001",
            "position": "Software Engineer",
            "department": "Engineering",
            "salary_amount": 75000.00,
            "salary_frequency": "annual",
            "hire_date": "2026-01-15"
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/employees',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['employee']['full_name'] == 'John Doe'
    
    def test_create_employee_duplicate_email(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating employee with duplicate email fails."""
        Employee(
            company_id=company_a,
            first_name="Jane",
            last_name="Doe",
            email="jane.doe@example.com",
            salary_amount=65000.00,
            salary_frequency='annual',
            created_by=user_a
        ).save()
        
        data = {
            "first_name": "John",
            "last_name": "Smith",
            "email": "jane.doe@example.com",  # Duplicate
            "salary_amount": 70000.00
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/employees',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'already exists' in response.json['error']
    
    def test_list_employees(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing employees."""
        Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=75000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/employees',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['employees']) == 1
    
    def test_list_employees_by_department(self, client, auth_headers_user_a, company_a, user_a):
        """Test filtering employees by department."""
        Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            department="Engineering",
            salary_amount=75000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_a
        ).save()
        
        Employee(
            company_id=company_a,
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            department="Marketing",
            salary_amount=65000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/employees?department=Engineering',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['employees']) == 1
        assert response.json['employees'][0]['department'] == 'Engineering'
    
    def test_update_employee(self, client, auth_headers_user_a, company_a, user_a):
        """Test updating an employee."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=75000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_a
        ).save()
        
        response = client.put(
            f'/api/companies/{company_a.id}/employees/{employee.id}',
            json={"salary_amount": 80000.00, "position": "Senior Engineer"},
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
    
    def test_delete_employee(self, client, auth_headers_user_a, company_a, user_a):
        """Test deactivating an employee."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=75000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_a
        ).save()
        
        response = client.delete(
            f'/api/companies/{company_a.id}/employees/{employee.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        
        # Check it's deactivated, not deleted
        employee.reload()
        assert employee.status == 'inactive'


class TestSalaryPayments:
    """Test salary payment operations."""
    
    def test_create_salary_payment(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating a salary payment."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=6000.00,
            salary_frequency='monthly',
            status='active',
            created_by=user_a
        ).save()
        
        data = {
            "employee_id": str(employee.id),
            "pay_period_start": "2026-01-01",
            "pay_period_end": "2026-01-31",
            "payment_date": "2026-02-01",
            "gross_amount": 6000.00,
            "tax_amount": 1200.00,
            "other_deductions": 300.00,
            "deduction_details": [
                {"name": "Health Insurance", "amount": 200.00},
                {"name": "401k", "amount": 100.00}
            ]
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/salary-payments',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['payment']['gross_amount'] == 6000.00
        assert response.json['payment']['net_amount'] == 4500.00  # 6000 - 1200 - 300
    
    def test_create_salary_payment_with_transaction(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating salary payment that creates a transaction."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=6000.00,
            salary_frequency='monthly',
            status='active',
            created_by=user_a
        ).save()
        
        data = {
            "employee_id": str(employee.id),
            "pay_period_start": "2026-01-01",
            "pay_period_end": "2026-01-31",
            "payment_date": "2026-02-01",
            "gross_amount": 6000.00,
            "tax_amount": 1200.00,
            "create_transaction": True
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/salary-payments',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['payment']['status'] == 'paid'
        assert response.json['payment']['transaction_id'] is not None
    
    def test_list_salary_payments(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing salary payments."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=6000.00,
            salary_frequency='monthly',
            status='active',
            created_by=user_a
        ).save()
        
        SalaryPayment(
            company_id=company_a,
            employee=employee,
            pay_period_start=datetime.utcnow() - timedelta(days=30),
            pay_period_end=datetime.utcnow(),
            payment_date=datetime.utcnow(),
            gross_amount=6000.00,
            net_amount=4800.00,
            status='pending',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/salary-payments',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['payments']) == 1
    
    def test_process_salary_payment(self, client, auth_headers_user_a, company_a, user_a):
        """Test processing a pending salary payment."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=6000.00,
            salary_frequency='monthly',
            status='active',
            created_by=user_a
        ).save()
        
        payment = SalaryPayment(
            company_id=company_a,
            employee=employee,
            pay_period_start=datetime.utcnow() - timedelta(days=30),
            pay_period_end=datetime.utcnow(),
            payment_date=datetime.utcnow(),
            gross_amount=6000.00,
            net_amount=4800.00,
            status='pending',
            created_by=user_a
        ).save()
        
        response = client.post(
            f'/api/companies/{company_a.id}/salary-payments/{payment.id}/process',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['payment']['status'] == 'paid'
        assert response.json['payment']['transaction_id'] is not None
    
    def test_cancel_salary_payment(self, client, auth_headers_user_a, company_a, user_a):
        """Test cancelling a pending salary payment."""
        employee = Employee(
            company_id=company_a,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            salary_amount=6000.00,
            salary_frequency='monthly',
            status='active',
            created_by=user_a
        ).save()
        
        payment = SalaryPayment(
            company_id=company_a,
            employee=employee,
            pay_period_start=datetime.utcnow() - timedelta(days=30),
            pay_period_end=datetime.utcnow(),
            payment_date=datetime.utcnow(),
            gross_amount=6000.00,
            net_amount=4800.00,
            status='pending',
            created_by=user_a
        ).save()
        
        response = client.post(
            f'/api/companies/{company_a.id}/salary-payments/{payment.id}/cancel',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        
        payment.reload()
        assert payment.status == 'cancelled'


class TestExpenseAccounts:
    """Test expense account operations."""
    
    def test_create_expense_account(self, client, auth_headers_user_a, company_a):
        """Test creating an expense account."""
        data = {
            "account_code": "5100",
            "account_name": "Salaries Expense",
            "description": "Employee salary payments",
            "account_type": "salary"
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/expense-accounts',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['account']['account_code'] == '5100'
    
    def test_create_expense_account_duplicate_code(self, client, auth_headers_user_a, company_a, user_a):
        """Test creating expense account with duplicate code fails."""
        ExpenseAccount(
            company_id=company_a,
            account_code="5100",
            account_name="Existing Account",
            account_type='salary',
            created_by=user_a
        ).save()
        
        data = {
            "account_code": "5100",  # Duplicate
            "account_name": "New Account",
            "account_type": "salary"
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/expense-accounts',
            json=data,
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'already exists' in response.json['error']
    
    def test_list_expense_accounts(self, client, auth_headers_user_a, company_a, user_a):
        """Test listing expense accounts."""
        ExpenseAccount(
            company_id=company_a,
            account_code="5100",
            account_name="Salaries",
            account_type='salary',
            is_active=True,
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/expense-accounts',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['expense_accounts']) == 1
    
    def test_list_expense_accounts_by_type(self, client, auth_headers_user_a, company_a, user_a):
        """Test filtering expense accounts by type."""
        ExpenseAccount(
            company_id=company_a,
            account_code="5100",
            account_name="Salaries",
            account_type='salary',
            is_active=True,
            created_by=user_a
        ).save()
        
        ExpenseAccount(
            company_id=company_a,
            account_code="5200",
            account_name="Rent",
            account_type='rent',
            is_active=True,
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/expense-accounts?type=salary',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['expense_accounts']) == 1
        assert response.json['expense_accounts'][0]['account_type'] == 'salary'
    
    def test_update_expense_account(self, client, auth_headers_user_a, company_a, user_a):
        """Test updating an expense account."""
        account = ExpenseAccount(
            company_id=company_a,
            account_code="5100",
            account_name="Salaries",
            account_type='salary',
            is_active=True,
            created_by=user_a
        ).save()
        
        response = client.put(
            f'/api/companies/{company_a.id}/expense-accounts/{account.id}',
            json={"account_name": "Salaries and Wages", "description": "All employee compensation"},
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['account']['account_name'] == 'Salaries and Wages'
    
    def test_delete_expense_account(self, client, auth_headers_user_a, company_a, user_a):
        """Test deactivating an expense account."""
        account = ExpenseAccount(
            company_id=company_a,
            account_code="5100",
            account_name="Salaries",
            account_type='salary',
            is_active=True,
            created_by=user_a
        ).save()
        
        response = client.delete(
            f'/api/companies/{company_a.id}/expense-accounts/{account.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        
        account.reload()
        assert account.is_active is False


# =============================================================================
# Multi-Tenant Isolation Tests
# =============================================================================

class TestPhase4MultiTenant:
    """Test multi-tenant isolation for Phase 4 modules."""
    
    def test_user_cannot_access_other_company_bank_statements(
        self, client, auth_headers_user_a, auth_headers_user_b, company_a, company_b, user_b
    ):
        """Test user cannot access bank statements from another company."""
        statement = BankStatement(
            company_id=company_b,
            bank_name="Other Bank",
            account_number="****5678",
            statement_date=datetime.utcnow(),
            opening_balance=5000.00,
            closing_balance=6000.00,
            uploaded_by=user_b
        ).save()
        
        # user_a tries to access company_b's statement
        response = client.get(
            f'/api/companies/{company_b.id}/bank-statements',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
    
    def test_user_cannot_access_other_company_employees(
        self, client, auth_headers_user_a, auth_headers_user_b, company_a, company_b, user_b
    ):
        """Test user cannot access employees from another company."""
        Employee(
            company_id=company_b,
            first_name="Other",
            last_name="Employee",
            email="other@example.com",
            salary_amount=50000.00,
            salary_frequency='annual',
            status='active',
            created_by=user_b
        ).save()
        
        # user_a tries to access company_b's employees
        response = client.get(
            f'/api/companies/{company_b.id}/employees',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
    
    def test_user_cannot_access_other_company_drawings(
        self, client, auth_headers_user_a, auth_headers_user_b, company_a, company_b, user_b
    ):
        """Test user cannot access drawings from another company."""
        Drawing(
            company_id=company_b,
            owner=user_b,
            date=datetime.utcnow(),
            description="Other company drawing",
            amount=2000.00,
            category='personal',
            created_by=user_b
        ).save()
        
        # user_a tries to access company_b's drawings
        response = client.get(
            f'/api/companies/{company_b.id}/drawings',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
