"""
Input validation tests.

Tests for:
- Required field validation
- Type validation (numbers, strings, dates)
- Range validation
- Format validation (emails, dates, IDs)
- File upload validation
- Pagination validation
"""

import pytest
from tests.conftest import assert_validation_error
from io import BytesIO


@pytest.mark.validation
@pytest.mark.unit
class TestTransactionValidation:
    """Test transaction creation validation."""
    
    def test_create_transaction_success(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with valid data succeeds."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'Valid Transaction',
                'amount': 100.50,
                'type': 'inflow',
                'category': 'operating',
                'currency': 'USD',
                'date': '2024-01-15'
            }
        )
        
        assert response.status_code == 200
        assert 'transaction' in response.json
        assert response.json['transaction']['amount'] == 100.50
    
    def test_create_transaction_missing_description(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction without description fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'amount': 100,
                'type': 'inflow'
            }
        )
        
        assert_validation_error(response, 'description')
    
    def test_create_transaction_negative_amount(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with negative amount fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'Test',
                'amount': -100,
                'type': 'inflow'
            }
        )
        
        assert_validation_error(response, 'amount')
        assert 'positive' in response.json['error'].lower()
    
    def test_create_transaction_invalid_type(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with invalid type fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'Test',
                'amount': 100,
                'type': 'invalid_type'
            }
        )
        
        assert_validation_error(response, 'type')
    
    def test_create_transaction_invalid_category(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with invalid category fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'Test',
                'amount': 100,
                'type': 'inflow',
                'category': 'invalid_category'
            }
        )
        
        assert_validation_error(response, 'category')
    
    def test_create_transaction_invalid_currency(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with invalid currency fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': 'Test',
                'amount': 100,
                'type': 'inflow',
                'currency': 'XXX'
            }
        )
        
        assert_validation_error(response, 'currency')
    
    def test_create_transaction_empty_description(
        self, client, auth_headers_user_a, company_a
    ):
        """Test creating transaction with empty description fails."""
        response = client.post('/create-transaction',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'description': '',
                'amount': 100,
                'type': 'inflow'
            }
        )
        
        assert_validation_error(response, 'description')


@pytest.mark.validation
@pytest.mark.unit
class TestInitialBalanceValidation:
    """Test initial balance validation."""
    
    def test_set_initial_balance_success(
        self, client, auth_headers_user_a, company_a
    ):
        """Test setting valid initial balance."""
        response = client.post('/set-initial-balance',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'initial_balance': 50000.50
            }
        )
        
        assert response.status_code == 200
        assert 'message' in response.json
    
    def test_set_initial_balance_negative_allowed(
        self, client, auth_headers_user_a, company_a
    ):
        """Test setting negative initial balance (overdraft) is allowed."""
        response = client.post('/set-initial-balance',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'initial_balance': -1000
            }
        )
        
        assert response.status_code == 200
    
    def test_set_initial_balance_invalid_format(
        self, client, auth_headers_user_a, company_a
    ):
        """Test setting initial balance with invalid format fails."""
        response = client.post('/set-initial-balance',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'initial_balance': 'not_a_number'
            }
        )
        
        assert_validation_error(response, 'initial_balance')
    
    def test_set_initial_balance_extreme_value(
        self, client, auth_headers_user_a, company_a
    ):
        """Test setting initial balance beyond limits fails."""
        response = client.post('/set-initial-balance',
            headers=auth_headers_user_a,
            json={
                'company_id': str(company_a.id),
                'initial_balance': 9999999999999  # Extremely large
            }
        )
        
        assert response.status_code == 400


@pytest.mark.validation
@pytest.mark.unit
class TestFileUploadValidation:
    """Test file upload validation."""
    
    def test_upload_valid_csv(self, client, auth_headers_user_a):
        """Test uploading valid CSV file."""
        data = {
            'file': (BytesIO(b'date,description,amount,type\n2024-01-01,Test,100,inflow'), 'test.csv')
        }
        
        response = client.post('/upload',
            headers={'Authorization': auth_headers_user_a['Authorization']},
            data=data,
            content_type='multipart/form-data'
        )
        
        # May succeed or fail based on file content, but should not be validation error for file type
        assert response.status_code != 400 or 'file type' not in response.json.get('error', '').lower()
    
    def test_upload_invalid_file_type(self, client, auth_headers_user_a):
        """Test uploading invalid file type fails."""
        data = {
            'file': (BytesIO(b'invalid content'), 'test.txt')
        }
        
        response = client.post('/upload',
            headers={'Authorization': auth_headers_user_a['Authorization']},
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 400
        assert 'error' in response.json
    
    def test_upload_no_file(self, client, auth_headers_user_a):
        """Test upload without file fails."""
        response = client.post('/upload',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'error' in response.json


@pytest.mark.validation
@pytest.mark.unit
class TestBulkOperationValidation:
    """Test bulk transaction validation with partial failures."""
    
    def test_save_transactions_all_valid(
        self, client, auth_headers_user_a, company_a
    ):
        """Test saving all valid transactions."""
        transactions = [
            {
                'company_id': str(company_a.id),
                'description': f'Transaction {i}',
                'amount': 100 * (i + 1),
                'type': 'inflow',
                'category': 'operating',
                'date': '2024-01-15'
            }
            for i in range(3)
        ]
        
        response = client.post('/save_transactions',
            headers=auth_headers_user_a,
            json=transactions
        )
        
        assert response.status_code == 201
        assert response.json['summary']['succeeded'] == 3
        assert response.json['summary']['failed'] == 0
    
    def test_save_transactions_partial_failure(
        self, client, auth_headers_user_a, company_a
    ):
        """Test saving transactions with some invalid returns 207 Multi-Status."""
        transactions = [
            {
                'company_id': str(company_a.id),
                'description': 'Valid Transaction',
                'amount': 100,
                'type': 'inflow',
                'category': 'operating'
            },
            {
                'company_id': str(company_a.id),
                'description': '',  # Invalid: empty description
                'amount': -50,  # Invalid: negative amount
                'type': 'invalid',  # Invalid: wrong type
                'category': 'operating'
            },
            {
                'company_id': str(company_a.id),
                'description': 'Another Valid',
                'amount': 200,
                'type': 'outflow',
                'category': 'operating'
            }
        ]
        
        response = client.post('/save_transactions',
            headers=auth_headers_user_a,
            json=transactions
        )
        
        assert response.status_code == 207  # Multi-Status
        assert response.json['summary']['succeeded'] == 2
        assert response.json['summary']['failed'] == 1
        assert len(response.json['created']) == 2
        assert len(response.json['failed']) == 1
        assert 'success_rate' in response.json['summary']
    
    def test_save_transactions_all_invalid(
        self, client, auth_headers_user_a, company_a
    ):
        """Test saving all invalid transactions fails completely."""
        transactions = [
            {
                'company_id': str(company_a.id),
                'description': '',
                'amount': -100,
                'type': 'invalid'
            },
            {
                'company_id': str(company_a.id),
                'amount': 'not_a_number',
                'type': 'inflow'
            }
        ]
        
        response = client.post('/save_transactions',
            headers=auth_headers_user_a,
            json=transactions
        )
        
        assert response.status_code == 400
        assert response.json['summary']['succeeded'] == 0
        assert response.json['summary']['failed'] == 2

