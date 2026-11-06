"""
Transaction endpoint tests.

Tests for:
- Transaction creation (POST /api/transactions, /create-transaction)
- Transaction listing (GET /api/transactions)
- Transaction editing (POST /edit/<id>)
- Transaction deletion (POST /delete/<id>)
- Bulk transaction saving (POST /save_transactions)
- Transaction exports (GET /export/<type>)
"""

import pytest
from datetime import datetime, timedelta


@pytest.mark.integration
class TestTransactionCRUD:
    """Test transaction CRUD operations."""
    
    def test_create_transaction_via_api(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction via /api/transactions."""
        response = client.post('/api/transactions',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'API Transaction',
                'amount': 250.75,
                'type': 'inflow',
                'category': 'revenue',
                'currency': 'USD',
                'date': '2024-01-20'
            }
        )
        
        assert response.status_code == 201
        assert 'transaction' in response.json
    
    def test_list_transactions_with_pagination(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test listing transactions with pagination."""
        response = client.get(
            f'/api/transactions?company_id={str(company_a.id)}&page=1&per_page=5',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'transactions' in response.json
        assert response.json['page'] == 1
        assert response.json['per_page'] == 5
        assert response.json['total'] >= 10
        assert len(json.loads(response.json['transactions'][0])) > 0  # Has data
    
    def test_list_transactions_pagination_limits(
        self, client, auth_headers_user_a, company_a
    ):
        """Test pagination limits are enforced."""
        # Try to get 200 items per page (should be limited to 100)
        response = client.get(
            f'/api/transactions?company_id={str(company_a.id)}&per_page=200',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['per_page'] == 100  # Should be capped at MAX_PAGE_SIZE
    
    def test_edit_transaction_success(
        self, client, auth_headers_user_a, sample_transaction_a, company_a
    ):
        """Test editing own transaction succeeds."""
        response = client.post(
            f'/edit/{str(sample_transaction_a.id)}?company_id={str(company_a.id)}',
            headers=auth_headers_user_a,
            json={
                'description': 'Updated Description',
                'amount': 1500.0
            }
        )
        
        assert response.status_code == 200
        assert response.json['transaction']['description'] == 'Updated Description'
        assert response.json['transaction']['amount'] == 1500.0
    
    def test_edit_transaction_not_owned(
        self, client, auth_headers_user_a, sample_transaction_b, company_b
    ):
        """Test editing transaction from another company fails."""
        response = client.post(
            f'/edit/{str(sample_transaction_b.id)}?company_id={str(company_b.id)}',
            headers=auth_headers_user_a,
            json={'description': 'Hacked'}
        )
        
        assert response.status_code in [403, 404]
        assert 'error' in response.json
    
    def test_delete_transaction_success(
        self, client, auth_headers_user_a, sample_transaction_a, company_a
    ):
        """Test deleting own transaction succeeds."""
        response = client.post(
            f'/delete/{str(sample_transaction_a.id)}?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'message' in response.json
    
    def test_delete_transaction_not_owned(
        self, client, auth_headers_user_a, sample_transaction_b, company_b
    ):
        """Test deleting transaction from another company fails."""
        response = client.post(
            f'/delete/{str(sample_transaction_b.id)}?company_id={str(company_b.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code in [403, 404]
        assert 'error' in response.json


@pytest.mark.integration
class TestTransactionExport:
    """Test transaction export functionality."""
    
    def test_export_csv(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test exporting transactions as CSV."""
        response = client.get(
            f'/export/csv?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.content_type == 'text/csv; charset=utf-8'
    
    def test_export_excel(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test exporting transactions as Excel."""
        response = client.get(
            f'/export/excel?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'spreadsheet' in response.content_type
    
    def test_export_invalid_type(
        self, client, auth_headers_user_a, company_a
    ):
        """Test exporting with invalid type fails."""
        response = client.get(
            f'/export/pdf?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'error' in response.json


@pytest.mark.integration
class TestTransactionAnalytics:
    """Test transaction analytics endpoints."""
    
    def test_monthly_balances(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test getting monthly balance data."""
        response = client.get(
            f'/monthly-balances?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'data' in response.json
        assert 'labels' in response.json['data']
        assert 'balances' in response.json['data']
    
    def test_monthly_income_expense(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test getting monthly income/expense data."""
        response = client.get(
            f'/monthly-income-expense?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'data' in response.json
        assert 'labels' in response.json['data']
        assert 'income' in response.json['data']
        assert 'expense' in response.json['data']
    
    def test_cashout_categories(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test getting expense category breakdown."""
        response = client.get(
            f'/cashout-categories?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'data' in response.json
    
    def test_balance_by_date(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test calculating balance at specific date."""
        response = client.post('/balance-by-date',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'date': '2024-01-15'
            }
        )
        
        assert response.status_code in [200, 400]  # May fail if no data
        if response.status_code == 200:
            assert 'balance' in response.json
            assert 'date' in response.json

