"""
Authentication and JWT tests.

Tests for:
- User registration
- User login
- JWT token generation
- JWT token validation
- Token expiration
- Invalid tokens
- Missing tokens
"""

import pytest
from tests.conftest import assert_valid_jwt_error
import json


@pytest.mark.auth
@pytest.mark.unit
class TestAuthentication:
    """Test authentication endpoints and JWT handling."""
    
    def test_login_success(self, client, user_a):
        """Test successful login returns JWT token."""
        response = client.post('/auth/login',
            json={'username': 'user_a', 'password': 'UserA123'}
        )
        
        assert response.status_code == 200
        assert 'access_token' in response.json
        assert 'default_company_id' in response.json
        assert len(response.json['access_token']) > 50  # JWT tokens are long
    
    def test_login_invalid_credentials(self, client, user_a):
        """Test login with wrong password fails."""
        response = client.post('/auth/login',
            json={'username': 'user_a', 'password': 'WrongPassword'}
        )
        
        assert response.status_code == 401
        assert 'error' in response.json
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user fails."""
        response = client.post('/auth/login',
            json={'username': 'nonexistent', 'password': 'password'}
        )
        
        assert response.status_code == 401
        assert 'error' in response.json
    
    def test_login_missing_username(self, client):
        """Test login without username fails."""
        response = client.post('/auth/login',
            json={'password': 'password'}
        )
        
        assert response.status_code in [400, 401]
        assert 'error' in response.json
    
    def test_login_missing_password(self, client):
        """Test login without password fails."""
        response = client.post('/auth/login',
            json={'username': 'user_a'}
        )
        
        assert response.status_code in [400, 401]
        assert 'error' in response.json
    
    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without JWT token."""
        response = client.get('/cash-overview')
        
        assert_valid_jwt_error(response)
    
    def test_protected_endpoint_with_invalid_token(self, client):
        """Test accessing protected endpoint with invalid JWT token."""
        response = client.get('/cash-overview',
            headers={'Authorization': 'Bearer invalid_token_here'}
        )
        
        assert_valid_jwt_error(response)
    
    def test_protected_endpoint_with_valid_token(self, client, auth_headers_user_a):
        """Test accessing protected endpoint with valid JWT token."""
        response = client.get('/cash-overview',
            headers=auth_headers_user_a
        )
        
        # Should not be 401 (may be 200 or other based on business logic)
        assert response.status_code != 401
    
    def test_create_superadmin_first_time(self, client):
        """Test creating the first SuperAdmin."""
        response = client.post('/auth/create-superadmin',
            json={
                'username': 'firstadmin',
                'email': 'firstadmin@test.com',
                'password': 'Admin123456'
            }
        )
        
        assert response.status_code == 201
        assert 'user_id' in response.json
        assert response.json['role'] == 'SuperAdmin'
    
    def test_create_superadmin_already_exists(self, client, superadmin):
        """Test creating SuperAdmin when one already exists fails."""
        response = client.post('/auth/create-superadmin',
            json={
                'username': 'secondadmin',
                'email': 'secondadmin@test.com',
                'password': 'Admin123456'
            }
        )
        
        assert response.status_code == 400
        assert 'error' in response.json


@pytest.mark.auth
@pytest.mark.integration
class TestJWTErrorHandling:
    """Test JWT error handling across all endpoints."""
    
    @pytest.mark.parametrize('endpoint,method', [
        ('/', 'GET'),
        ('/home', 'GET'),
        ('/cash-overview', 'GET'),
        ('/cash-activities', 'GET'),
        ('/settings', 'GET'),
        ('/monthly-balances', 'GET'),
        ('/monthly-income-expense', 'GET'),
        ('/cashout-categories', 'GET'),
        ('/forecast', 'GET'),
        ('/ai-analysis', 'GET'),
    ])
    def test_get_endpoints_without_jwt(self, client, endpoint, method):
        """Test all GET endpoints return 401 without JWT."""
        response = client.get(endpoint)
        assert_valid_jwt_error(response)
    
    @pytest.mark.parametrize('endpoint', [
        '/set-initial-balance',
        '/change_password',
        '/update_profile',
        '/update_modules',
        '/create-transaction',
    ])
    def test_post_endpoints_without_jwt(self, client, endpoint):
        """Test all POST endpoints return 401 without JWT."""
        response = client.post(endpoint, json={})
        assert_valid_jwt_error(response)
    
    def test_all_endpoints_have_consistent_error_format(self, client):
        """Test all endpoints return consistent error format for missing JWT."""
        endpoints = [
            ('/', 'GET'),
            ('/cash-overview', 'GET'),
            ('/settings', 'GET'),
        ]
        
        for endpoint, method in endpoints:
            if method == 'GET':
                response = client.get(endpoint)
            else:
                response = client.post(endpoint, json={})
            
            assert response.status_code == 401
            assert 'error' in response.json
            assert 'Invalid or missing JWT token' in response.json['error']
            # All should have consistent format
            assert isinstance(response.json, dict)
            assert 'error' in response.json


@pytest.mark.auth
@pytest.mark.security
class TestPasswordSecurity:
    """Test password-related security features."""
    
    def test_change_password_success(self, client, auth_headers_user_a):
        """Test successful password change."""
        response = client.post('/change_password',
            headers=auth_headers_user_a,
            json={
                'current_password': 'UserA123',
                'new_password': 'NewPassword123',
                'confirm_password': 'NewPassword123'
            }
        )
        
        assert response.status_code == 200
        assert 'message' in response.json
    
    def test_change_password_wrong_current(self, client, auth_headers_user_a):
        """Test password change with wrong current password."""
        response = client.post('/change_password',
            headers=auth_headers_user_a,
            json={
                'current_password': 'WrongPassword',
                'new_password': 'NewPassword123',
                'confirm_password': 'NewPassword123'
            }
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
        assert 'incorrect' in response.json['error'].lower()
    
    def test_change_password_mismatch(self, client, auth_headers_user_a):
        """Test password change with mismatched new passwords."""
        response = client.post('/change_password',
            headers=auth_headers_user_a,
            json={
                'current_password': 'UserA123',
                'new_password': 'NewPassword123',
                'confirm_password': 'DifferentPassword123'
            }
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
        assert 'do not match' in response.json['error'].lower()

