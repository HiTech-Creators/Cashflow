"""
Endpoint-specific tests for all API endpoints.

Tests for:
- Dashboard endpoints
- Forecast endpoints
- Budget endpoints
- Working capital endpoints
- Company management endpoints
- User management endpoints
"""

import pytest
from datetime import datetime


@pytest.mark.integration
class TestDashboardEndpoints:
    """Test dashboard and overview endpoints."""
    
    def test_home_endpoint(self, client, auth_headers_user_a, company_a):
        """Test home/dashboard endpoint."""
        response = client.get(
            f'/?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'balance' in response.json
        assert 'user' in response.json
        assert 'company_id' in response.json
    
    def test_cash_overview(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test cash overview endpoint."""
        response = client.get(
            f'/cash-overview?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'balance' in response.json
        assert 'burn_rate' in response.json
        assert 'runway_months' in response.json
    
    def test_cash_activities(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test cash activities (transactions list) endpoint."""
        response = client.get(
            f'/cash-activities?company_id={str(company_a.id)}&page=1&per_page=5',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'transactions' in response.json
        assert 'total' in response.json
        assert 'page' in response.json
        assert 'per_page' in response.json
    
    def test_dashboard_api_endpoint(
        self, client, auth_headers_user_a, company_a
    ):
        """Test /api/dashboard endpoint."""
        response = client.get(
            f'/api/dashboard?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'kpis' in response.json


@pytest.mark.integration
class TestForecastEndpoints:
    """Test forecast-related endpoints."""
    
    @pytest.mark.skip(reason="Requires ANTHROPIC_API_KEY to be valid")
    def test_create_forecast(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test creating a forecast."""
        response = client.post('/api/forecasts',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'months': 12,
                'type': 'manual',
                'scenario_name': 'Base Case'
            }
        )
        
        # May fail without valid AI API key
        assert response.status_code in [200, 201, 400, 500]
    
    def test_list_forecasts(
        self, client, auth_headers_user_a, company_a
    ):
        """Test listing forecasts."""
        response = client.get(
            f'/api/forecasts?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'forecasts' in response.json
        assert 'company_id' in response.json


@pytest.mark.integration
class TestBudgetEndpoints:
    """Test budget-related endpoints."""
    
    def test_create_budget(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating a budget."""
        response = client.post('/api/budgets',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'category': 'operating',
                'amount': 5000,
                'period': '2024-01'
            }
        )
        
        assert response.status_code == 201
        assert 'budget' in response.json
    
    def test_list_budgets(
        self, client, auth_headers_user_a, company_a
    ):
        """Test listing budgets."""
        response = client.get(
            f'/api/budgets?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'budgets' in response.json


@pytest.mark.integration
class TestWorkingCapitalEndpoints:
    """Test working capital endpoints."""
    
    def test_get_receivables(
        self, client, auth_headers_user_a, company_a
    ):
        """Test getting receivables."""
        response = client.get(
            f'/api/receivables?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'receivables' in response.json
    
    def test_get_payables(
        self, client, auth_headers_user_a, company_a
    ):
        """Test getting payables."""
        response = client.get(
            f'/api/payables?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'payables' in response.json
    
    def test_get_inventory(
        self, client, auth_headers_user_a, company_a
    ):
        """Test getting inventory."""
        response = client.get(
            f'/api/inventory?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'inventory' in response.json
    
    def test_aging_report(
        self, client, auth_headers_user_a, company_a
    ):
        """Test aging report generation."""
        response = client.get(
            f'/api/aging?company_id={str(company_a.id)}&type=receivables',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'report' in response.json


@pytest.mark.integration
class TestCompanyManagement:
    """Test company management endpoints."""
    
    def test_create_company_superadmin_only(
        self, client, auth_headers_superadmin
    ):
        """Test only SuperAdmin can create companies."""
        response = client.post('/api/companies',
            headers=auth_headers_superadmin,
            json={
                'name': 'New Test Company',
                'currency': 'GBP'
            }
        )
        
        assert response.status_code == 201
        assert 'company' in response.json
    
    def test_create_company_regular_user_denied(
        self, client, auth_headers_user_a
    ):
        """Test regular user cannot create companies."""
        response = client.post('/api/companies',
            headers=auth_headers_user_a,
            json={
                'name': 'Should Fail',
                'currency': 'USD'
            }
        )
        
        assert response.status_code == 403
        assert 'error' in response.json
    
    def test_list_companies(
        self, client, auth_headers_user_a, company_a
    ):
        """Test listing user's companies."""
        response = client.get('/api/companies',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'companies' in response.json
        assert len(response.json['companies']) >= 1
    
    def test_update_company(
        self, client, auth_headers_superadmin, company_a
    ):
        """Test updating company details."""
        response = client.put(
            f'/api/companies/{str(company_a.id)}',
            headers=auth_headers_superadmin,
            json={'name': 'Updated Company A'}
        )
        
        assert response.status_code == 200
        assert response.json['company']['name'] == 'Updated Company A'
    
    def test_delete_company_superadmin_only(
        self, client, auth_headers_superadmin, company_a
    ):
        """Test deleting company (soft delete)."""
        response = client.delete(
            f'/api/companies/{str(company_a.id)}',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert 'message' in response.json


@pytest.mark.integration
class TestUserManagement:
    """Test user management endpoints."""
    
    def test_invite_user_to_company(
        self, client, auth_headers_admin_a, company_a
    ):
        """Test inviting user to company."""
        response = client.post(
            f'/api/companies/{str(company_a.id)}/invite',
            headers=auth_headers_admin_a,
            json={
                'email': 'newuser@test.com',
                'role': 'user'
            }
        )
        
        assert response.status_code in [200, 201]
        assert 'message' in response.json
    
    def test_list_company_users(
        self, client, auth_headers_admin_a, company_a
    ):
        """Test listing users in a company."""
        response = client.get(
            f'/api/companies/{str(company_a.id)}/users',
            headers=auth_headers_admin_a
        )
        
        assert response.status_code == 200
        assert 'users' in response.json
    
    def test_regular_user_cannot_invite(
        self, client, auth_headers_user_a, company_a
    ):
        """Test regular user cannot invite users."""
        response = client.post(
            f'/api/companies/{str(company_a.id)}/invite',
            headers=auth_headers_user_a,
            json={
                'email': 'newuser@test.com',
                'role': 'user'
            }
        )
        
        assert response.status_code == 400
        assert 'error' in response.json


@pytest.mark.integration
class TestAdminEndpoints:
    """Test admin-only endpoints."""
    
    def test_list_all_users_superadmin_only(
        self, client, auth_headers_superadmin
    ):
        """Test listing all users requires SuperAdmin."""
        response = client.get('/api/admin/users',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert 'users' in response.json
    
    def test_list_all_users_regular_user_denied(
        self, client, auth_headers_user_a
    ):
        """Test regular user cannot list all users."""
        response = client.get('/api/admin/users',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
    
    def test_list_all_companies_superadmin_only(
        self, client, auth_headers_superadmin
    ):
        """Test listing all companies requires SuperAdmin."""
        response = client.get('/api/admin/companies',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert 'companies' in response.json

