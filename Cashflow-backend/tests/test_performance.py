"""
Performance tests.

Tests for:
- Database query performance with indexes
- Response time benchmarks
- Pagination performance
- Bulk operation performance
"""

import pytest
import time
from datetime import datetime, timedelta


@pytest.mark.performance
@pytest.mark.slow
class TestDatabasePerformance:
    """Test database query performance with indexes."""
    
    def test_transaction_query_performance(
        self, client, auth_headers_user_a, company_a, user_a
    ):
        """Test transaction queries are fast with indexes."""
        from src.models import Transaction
        
        # Create 100 transactions
        for i in range(100):
            Transaction(
                user_id=user_a,
                company_id=company_a,
                date=datetime.utcnow() - timedelta(days=i),
                description=f'Performance Test {i}',
                amount=100.0,
                type='inflow' if i % 2 == 0 else 'outflow',
                category='operating',
                currency='USD'
            ).save()
        
        # Measure query time
        start_time = time.time()
        response = client.get(
            f'/api/transactions?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        end_time = time.time()
        
        query_time = (end_time - start_time) * 1000  # Convert to ms
        
        assert response.status_code == 200
        # With indexes, should be under 100ms even with 100 records
        assert query_time < 1000, f"Query took {query_time}ms, expected < 1000ms"
    
    def test_pagination_performance(
        self, client, auth_headers_user_a, company_a, user_a
    ):
        """Test pagination is efficient."""
        from src.models import Transaction
        
        # Create 200 transactions
        for i in range(200):
            Transaction(
                user_id=user_a,
                company_id=company_a,
                date=datetime.utcnow() - timedelta(days=i),
                description=f'Pagination Test {i}',
                amount=100.0,
                type='inflow',
                category='operating',
                currency='USD'
            ).save()
        
        # Test getting page 5 (skip 40, limit 10)
        start_time = time.time()
        response = client.get(
            f'/api/transactions?company_id={str(company_a.id)}&page=5&per_page=10',
            headers=auth_headers_user_a
        )
        end_time = time.time()
        
        query_time = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        assert query_time < 500, f"Pagination query took {query_time}ms"


@pytest.mark.performance
@pytest.mark.integration
class TestResponseTimes:
    """Test API response time benchmarks."""
    
    def test_home_endpoint_response_time(
        self, client, auth_headers_user_a, company_a
    ):
        """Test home endpoint responds quickly."""
        start_time = time.time()
        response = client.get(
            f'/?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        assert response_time < 500, f"Response time {response_time}ms exceeded 500ms"
    
    def test_cash_overview_response_time(
        self, client, auth_headers_user_a, sample_transactions_a, company_a
    ):
        """Test cash overview responds quickly."""
        start_time = time.time()
        response = client.get(
            f'/cash-overview?company_id={str(company_a.id)}',
            headers=auth_headers_user_a
        )
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        assert response_time < 1000, f"Response time {response_time}ms exceeded 1000ms"
    
    def test_health_check_response_time(self, client):
        """Test health check responds very quickly."""
        start_time = time.time()
        response = client.get('/health')
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000
        
        assert response.status_code == 200
        assert response_time < 100, f"Health check took {response_time}ms, should be <100ms"


@pytest.mark.performance
@pytest.mark.integration
class TestBulkOperationPerformance:
    """Test bulk operation performance."""
    
    def test_bulk_save_performance(
        self, client, auth_headers_user_a, company_a
    ):
        """Test saving bulk transactions is reasonably fast."""
        transactions = [
            {
                'company_id': str(company_a.id),
                'description': f'Bulk Test {i}',
                'amount': 100,
                'type': 'inflow',
                'category': 'operating'
            }
            for i in range(50)
        ]
        
        start_time = time.time()
        response = client.post('/save_transactions',
            headers=auth_headers_user_a,
            json=transactions
        )
        end_time = time.time()
        
        processing_time = (end_time - start_time) * 1000
        
        assert response.status_code == 201
        # 50 transactions should process in under 5 seconds
        assert processing_time < 5000, f"Bulk save took {processing_time}ms"
        
        # Verify all were created
        assert response.json['summary']['succeeded'] == 50

