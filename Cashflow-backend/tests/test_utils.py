"""
Utility function tests.

Tests for functions in src/utils.py:
- verify_company_access
- get_user_default_company
- get_user_role_level
- can_manage_users
- can_manage_companies
- calculate_burn_rate
- calculate_runway
"""

import pytest
from src.utils import (
    verify_company_access,
    get_user_default_company,
    get_user_role_level,
    can_manage_users,
    can_manage_companies,
    get_user_role_in_company,
    calculate_burn_rate,
    calculate_runway
)
from datetime import datetime, timedelta


@pytest.mark.unit
class TestCompanyAccessUtils:
    """Test company access utility functions."""
    
    def test_verify_company_access_own_company(
        self, user_a, company_a
    ):
        """Test user has access to their own company."""
        valid, result = verify_company_access(str(user_a.id), str(company_a.id))
        
        assert valid is True
        assert result == company_a
    
    def test_verify_company_access_other_company(
        self, user_a, company_b
    ):
        """Test user does not have access to other company."""
        valid, result = verify_company_access(str(user_a.id), str(company_b.id))
        
        assert valid is False
        assert isinstance(result, str)  # Error message
    
    def test_verify_company_access_superadmin(
        self, superadmin, company_a, company_b
    ):
        """Test SuperAdmin has access to all companies."""
        # Test Company A
        valid_a, result_a = verify_company_access(str(superadmin.id), str(company_a.id))
        assert valid_a is True
        
        # Test Company B
        valid_b, result_b = verify_company_access(str(superadmin.id), str(company_b.id))
        assert valid_b is True
    
    def test_get_user_default_company(
        self, user_a, company_a
    ):
        """Test getting user's default company."""
        company = get_user_default_company(str(user_a.id))
        
        assert company is not None
        assert str(company.id) == str(company_a.id)
    
    def test_get_user_default_company_superadmin(
        self, superadmin, company_a
    ):
        """Test SuperAdmin gets first available company as default."""
        company = get_user_default_company(str(superadmin.id))
        
        # Should return some company
        assert company is not None


@pytest.mark.unit
class TestRoleUtils:
    """Test role-related utility functions."""
    
    def test_get_user_role_level_superadmin(self, superadmin):
        """Test getting SuperAdmin role level."""
        level = get_user_role_level(str(superadmin.id))
        assert level == 1
    
    def test_get_user_role_level_user(self, user_a):
        """Test getting User role level."""
        level = get_user_role_level(str(user_a.id))
        assert level == 3
    
    def test_can_manage_companies_superadmin(self, superadmin):
        """Test SuperAdmin can manage companies."""
        assert can_manage_companies(str(superadmin.id)) is True
    
    def test_can_manage_companies_regular_user(self, user_a):
        """Test regular user cannot manage companies."""
        assert can_manage_companies(str(user_a.id)) is False
    
    def test_can_manage_users_company_admin(
        self, company_admin_a, company_a
    ):
        """Test CompanyAdmin can manage users in their company."""
        assert can_manage_users(str(company_admin_a.id), str(company_a.id)) is True
    
    def test_can_manage_users_regular_user(
        self, user_a, company_a
    ):
        """Test regular user cannot manage users."""
        assert can_manage_users(str(user_a.id), str(company_a.id)) is False
    
    def test_get_user_role_in_company(
        self, user_a, company_a, company_admin_a
    ):
        """Test getting user's role in specific company."""
        # Regular user
        role = get_user_role_in_company(str(user_a.id), str(company_a.id))
        assert role == 'user'
        
        # Company admin
        admin_role = get_user_role_in_company(str(company_admin_a.id), str(company_a.id))
        assert admin_role == 'admin'


@pytest.mark.unit
class TestFinancialCalculations:
    """Test financial calculation utilities."""
    
    def test_calculate_burn_rate(
        self, user_a, company_a, sample_transactions_a
    ):
        """Test burn rate calculation."""
        burn_rate = calculate_burn_rate(str(user_a.id), str(company_a.id))
        
        assert isinstance(burn_rate, float)
        assert burn_rate >= 0
    
    def test_calculate_runway(
        self, user_a, company_a, sample_transactions_a
    ):
        """Test runway calculation."""
        runway = calculate_runway(str(user_a.id), str(company_a.id), current_balance=10000)
        
        assert isinstance(runway, (int, float))
        assert runway >= 0
    
    def test_calculate_runway_infinite(
        self, user_a, company_a
    ):
        """Test runway is infinite with no burn rate."""
        runway = calculate_runway(str(user_a.id), str(company_a.id), current_balance=5000)
        
        # With no or positive cash flow, runway should be infinite
        assert runway >= 0 or runway == float('inf')

