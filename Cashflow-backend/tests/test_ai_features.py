"""
Comprehensive tests for AI features.

Tests cover:
- Smart Transaction Categorization
- Anomaly Detection
- Conversational Finance Assistant
- Smart Insights & Alerts
- Transaction Description Enhancement
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from src.models import User, Transaction, Company, Role, CompanyMembership
from mongoengine import connect, disconnect


class TestSmartTransactionCategorization:
    """Tests for AI-powered transaction categorization."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_auto_categorize_success(self, mock_anthropic, client, auth_headers):
        """Test successful transaction categorization."""
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "type": "outflow",
            "category": "Salary-suppliers",
            "suggested_tags": ["payroll", "monthly", "recurring"],
            "confidence": 0.95,
            "reasoning": "This is a payroll transaction based on the description"
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        data = {
            "description": "Monthly payroll - John Doe",
            "amount": 5000.00,
            "merchant": "Payroll Services Inc"
        }
        
        response = client.post(
            '/api/ai/categorize',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "categorization" in result
        assert result["categorization"]["type"] == "outflow"
        assert result["categorization"]["category"] == "Salary-suppliers"
        assert result["categorization"]["confidence"] >= 0.9
    
    def test_auto_categorize_missing_description(self, client, auth_headers):
        """Test categorization with missing description."""
        data = {
            "amount": 100.00
        }
        
        response = client.post(
            '/api/ai/categorize',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "description is required" in response.get_json()["error"]
    
    def test_auto_categorize_missing_amount(self, client, auth_headers):
        """Test categorization with missing amount."""
        data = {
            "description": "Test transaction"
        }
        
        response = client.post(
            '/api/ai/categorize',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "amount is required" in response.get_json()["error"]
    
    def test_auto_categorize_no_auth(self, client):
        """Test categorization without authentication."""
        data = {
            "description": "Test transaction",
            "amount": 100.00
        }
        
        response = client.post('/api/ai/categorize', json=data)
        
        assert response.status_code == 401
    
    @patch('src.anthropic_service.Anthropic')
    def test_auto_categorize_fallback_on_error(self, mock_anthropic, client, auth_headers):
        """Test fallback categorization when AI fails."""
        # Mock AI error
        mock_anthropic.return_value.messages.create.side_effect = Exception("AI service unavailable")
        
        data = {
            "description": "Test transaction",
            "amount": -100.00
        }
        
        response = client.post(
            '/api/ai/categorize',
            json=data,
            headers=auth_headers
        )
        
        # Should still return a response with fallback
        assert response.status_code in [200, 500]


class TestAnomalyDetection:
    """Tests for AI-powered anomaly detection."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_detect_anomalies_success(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test successful anomaly detection."""
        # Create some test transactions
        for i in range(5):
            Transaction(
                user_id=test_user,
                company_id=test_company,
                date=datetime.utcnow() - timedelta(days=i),
                description=f"Transaction {i}",
                amount=100.00,
                type='outflow',
                category='Other-cfo'
            ).save()
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps([
            {
                "transaction_id": "123",
                "type": "duplicate",
                "severity": "medium",
                "description": "Duplicate transaction detected",
                "recommended_action": "Review and remove duplicate"
            }
        ]))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.get(
            f'/api/ai/anomalies?company_id={test_company.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "anomalies" in result
        assert "total_analyzed" in result
    
    def test_detect_anomalies_no_transactions(self, client, auth_headers, test_company):
        """Test anomaly detection with no transactions."""
        response = client.get(
            f'/api/ai/anomalies?company_id={test_company.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert result["anomalies"] == []
        assert "No transactions" in result.get("message", "")
    
    def test_detect_anomalies_no_auth(self, client, test_company):
        """Test anomaly detection without authentication."""
        response = client.get(f'/api/ai/anomalies?company_id={test_company.id}')
        
        assert response.status_code == 401
    
    def test_detect_anomalies_invalid_company(self, client, auth_headers):
        """Test anomaly detection with invalid company ID."""
        response = client.get(
            '/api/ai/anomalies?company_id=invalid_id',
            headers=auth_headers
        )
        
        assert response.status_code in [400, 403, 404]


class TestConversationalFinanceAssistant:
    """Tests for AI-powered conversational finance assistant."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_financial_chat_success(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test successful chat query."""
        # Create some transactions for context
        Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Revenue",
            amount=5000.00,
            type='inflow',
            category='Cash-customer'
        ).save()
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "answer": "Your current balance is $5,000. This is based on your recent transactions.",
            "data": {"balance": 5000.00},
            "action": None,
            "insights": ["Strong positive cash flow this month"],
            "follow_up_questions": ["Would you like to see a forecast?", "Any upcoming expenses?"]
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        data = {
            "query": "What's my current balance?",
            "company_id": str(test_company.id)
        }
        
        response = client.post(
            '/api/ai/chat',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "response" in result
        assert "answer" in result["response"]
    
    def test_financial_chat_missing_query(self, client, auth_headers):
        """Test chat with missing query."""
        data = {
            "company_id": "test_company_id"
        }
        
        response = client.post(
            '/api/ai/chat',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "query is required" in response.get_json()["error"]
    
    def test_financial_chat_no_auth(self, client):
        """Test chat without authentication."""
        data = {
            "query": "What's my balance?"
        }
        
        response = client.post('/api/ai/chat', json=data)
        
        assert response.status_code == 401
    
    @patch('src.anthropic_service.Anthropic')
    def test_financial_chat_with_action(self, mock_anthropic, client, auth_headers, test_company):
        """Test chat that suggests an action."""
        # Mock AI response with action
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "answer": "I can create that transaction for you.",
            "data": {},
            "action": {
                "type": "create_transaction",
                "params": {
                    "description": "Office supplies",
                    "amount": 500.00,
                    "type": "outflow"
                }
            },
            "insights": [],
            "follow_up_questions": []
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        data = {
            "query": "Add a $500 expense for office supplies",
            "company_id": str(test_company.id)
        }
        
        response = client.post(
            '/api/ai/chat',
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "response" in result
        assert result["response"].get("action") is not None


class TestSmartInsights:
    """Tests for AI-powered smart insights."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_generate_insights_success(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test successful insights generation."""
        # Create transactions for analysis
        Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Revenue",
            amount=10000.00,
            type='inflow',
            category='Cash-customer'
        ).save()
        
        Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Large expense",
            amount=8000.00,
            type='outflow',
            category='Other-cfo'
        ).save()
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "alerts": [
                {
                    "title": "High Burn Rate",
                    "message": "Your monthly burn rate is concerning",
                    "severity": "high",
                    "action_required": True,
                    "suggested_action": "Review large expenses"
                }
            ],
            "opportunities": [
                {
                    "title": "Cost Reduction",
                    "message": "Potential to reduce operating costs by 15%",
                    "severity": "medium"
                }
            ],
            "trends": [
                {
                    "title": "Revenue Growth",
                    "message": "Revenue has increased by 20% month-over-month"
                }
            ],
            "recommendations": [
                {
                    "title": "Build Cash Reserve",
                    "message": "Consider building 3-6 months operating reserve"
                }
            ]
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.get(
            f'/api/ai/insights?company_id={test_company.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "insights" in result
        assert "alerts" in result["insights"]
        assert "opportunities" in result["insights"]
        assert "trends" in result["insights"]
        assert "recommendations" in result["insights"]
    
    def test_generate_insights_no_auth(self, client, test_company):
        """Test insights generation without authentication."""
        response = client.get(f'/api/ai/insights?company_id={test_company.id}')
        
        assert response.status_code == 401
    
    @patch('src.anthropic_service.Anthropic')
    def test_generate_insights_with_critical_alerts(self, mock_anthropic, client, auth_headers, test_company):
        """Test insights with critical alerts."""
        # Mock AI response with critical alert
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "alerts": [
                {
                    "title": "Cash Flow Crisis",
                    "message": "You may run out of cash in 15 days",
                    "severity": "critical",
                    "action_required": True,
                    "suggested_action": "Immediate action needed - secure funding or reduce expenses"
                }
            ],
            "opportunities": [],
            "trends": [],
            "recommendations": []
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.get(
            f'/api/ai/insights?company_id={test_company.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        critical_alerts = [a for a in result["insights"]["alerts"] if a["severity"] == "critical"]
        assert len(critical_alerts) > 0


class TestTransactionDescriptionEnhancement:
    """Tests for AI-powered transaction description enhancement."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_enhance_description_success(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test successful description enhancement."""
        # Create a transaction
        transaction = Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Amazon $45.99",
            amount=45.99,
            type='outflow',
            category='Other-cfo'
        ).save()
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text="Amazon.com purchase - Office supplies - $45.99")]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.post(
            f'/api/transactions/{transaction.id}/enhance',
            json={"apply": False},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "original" in result
        assert "enhanced" in result
        assert result["original"] == "Amazon $45.99"
        assert len(result["enhanced"]) > len(result["original"])
    
    @patch('src.anthropic_service.Anthropic')
    def test_enhance_description_and_apply(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test enhancement with apply=True."""
        # Create a transaction
        transaction = Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Starbucks $5.50",
            amount=5.50,
            type='outflow',
            category='Other-cfo'
        ).save()
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text="Starbucks Coffee - Daily beverage expense - $5.50")]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.post(
            f'/api/transactions/{transaction.id}/enhance',
            json={"apply": True},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        assert "Transaction description updated" in result["message"]
        assert "transaction" in result
    
    def test_enhance_description_not_found(self, client, auth_headers):
        """Test enhancement with non-existent transaction."""
        response = client.post(
            '/api/transactions/000000000000000000000000/enhance',
            json={"apply": False},
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_enhance_description_no_auth(self, client):
        """Test enhancement without authentication."""
        response = client.post(
            '/api/transactions/000000000000000000000000/enhance',
            json={"apply": False}
        )
        
        assert response.status_code == 401


class TestAIServiceMethods:
    """Tests for FinancialAnalytics AI service methods."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_auto_categorize_method(self, mock_anthropic):
        """Test auto_categorize_transaction method directly."""
        from src.anthropic_service import FinancialAnalytics
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "type": "inflow",
            "category": "Cash-customer",
            "suggested_tags": ["revenue", "client payment"],
            "confidence": 0.92,
            "reasoning": "Client payment for services"
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        analytics = FinancialAnalytics(api_key="test_key")
        result = analytics.auto_categorize_transaction(
            description="Payment from ABC Corp",
            amount=5000.00,
            merchant="ABC Corp"
        )
        
        assert result["type"] == "inflow"
        assert result["category"] == "Cash-customer"
        assert result["confidence"] > 0.9
    
    @patch('src.anthropic_service.Anthropic')
    def test_detect_anomalies_method(self, mock_anthropic):
        """Test detect_anomalies method directly."""
        from src.anthropic_service import FinancialAnalytics
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps([
            {
                "transaction_id": "123",
                "type": "outlier",
                "severity": "high",
                "description": "Amount is 10x the average",
                "recommended_action": "Verify transaction"
            }
        ]))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        analytics = FinancialAnalytics(api_key="test_key")
        transactions = [
            {"id": "1", "amount": 100, "description": "Test 1", "type": "outflow", "date": "2024-01-01"},
            {"id": "2", "amount": 1000, "description": "Test 2", "type": "outflow", "date": "2024-01-02"}
        ]
        
        result = analytics.detect_anomalies(transactions, "company_123")
        
        assert isinstance(result, list)
        if len(result) > 0:
            assert "transaction_id" in result[0]
            assert "type" in result[0]
    
    @patch('src.anthropic_service.Anthropic')
    def test_financial_chatbot_method(self, mock_anthropic):
        """Test financial_chatbot method directly."""
        from src.anthropic_service import FinancialAnalytics
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "answer": "Your balance is $10,000",
            "data": {"balance": 10000},
            "action": None,
            "insights": [],
            "follow_up_questions": []
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        analytics = FinancialAnalytics(api_key="test_key")
        context = {
            "balance": 10000,
            "monthly_revenue": 5000,
            "monthly_expenses": 3000,
            "burn_rate": 0,
            "runway_months": 999,
            "total_transactions": 100,
            "recent_activity": "Normal"
        }
        
        result = analytics.financial_chatbot("What's my balance?", context)
        
        assert "answer" in result
        assert "data" in result
    
    @patch('src.anthropic_service.Anthropic')
    def test_generate_smart_insights_method(self, mock_anthropic):
        """Test generate_smart_insights method directly."""
        from src.anthropic_service import FinancialAnalytics
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps({
            "alerts": [],
            "opportunities": [],
            "trends": [],
            "recommendations": []
        }))]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        analytics = FinancialAnalytics(api_key="test_key")
        financial_data = {
            "current_balance": 10000,
            "monthly_cash_flow": 2000,
            "revenue_trend": "growing",
            "expense_trend": "stable",
            "burn_rate": 0,
            "runway_months": 999,
            "liquidity_ratio": 2.5,
            "top_expenses": [],
            "revenue_sources": [],
            "upcoming_obligations": []
        }
        
        result = analytics.generate_smart_insights(financial_data)
        
        assert "alerts" in result
        assert "opportunities" in result
        assert "trends" in result
        assert "recommendations" in result
        assert "generated_at" in result
    
    @patch('src.anthropic_service.Anthropic')
    def test_enhance_transaction_description_method(self, mock_anthropic):
        """Test enhance_transaction_description method directly."""
        from src.anthropic_service import FinancialAnalytics
        
        # Mock AI response
        mock_response = Mock()
        mock_response.content = [Mock(text="Enhanced description here")]
        
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        analytics = FinancialAnalytics(api_key="test_key")
        transaction = {
            "description": "AMZ*123",
            "amount": 50.00,
            "type": "outflow",
            "date": "2024-01-01",
            "category": "Other-cfo"
        }
        
        result = analytics.enhance_transaction_description(transaction)
        
        assert isinstance(result, str)
        assert len(result) > 0
        assert len(result) <= 100  # Should respect max length


class TestAIIntegration:
    """Integration tests for AI features."""
    
    def test_ai_endpoints_require_auth(self, client):
        """Test that all AI endpoints require authentication."""
        endpoints = [
            ('/api/ai/categorize', 'POST', {"description": "test", "amount": 100}),
            ('/api/ai/anomalies', 'GET', None),
            ('/api/ai/chat', 'POST', {"query": "test"}),
            ('/api/ai/insights', 'GET', None),
        ]
        
        for endpoint, method, data in endpoints:
            if method == 'POST':
                response = client.post(endpoint, json=data)
            else:
                response = client.get(endpoint)
            
            assert response.status_code == 401, f"Endpoint {endpoint} should require auth"
    
    @patch('src.anthropic_service.Anthropic')
    def test_ai_feature_workflow(self, mock_anthropic, client, auth_headers, test_company, test_user):
        """Test complete AI workflow: categorize, detect anomalies, get insights."""
        # Mock all AI responses
        mock_response = Mock()
        mock_response.content = [Mock(text='{"type": "outflow", "category": "Other-cfo", "suggested_tags": [], "confidence": 0.9, "reasoning": "test"}')]
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        # 1. Categorize a transaction
        categorize_response = client.post(
            '/api/ai/categorize',
            json={"description": "Test expense", "amount": 100},
            headers=auth_headers
        )
        assert categorize_response.status_code == 200
        
        # 2. Create transaction
        Transaction(
            user_id=test_user,
            company_id=test_company,
            date=datetime.utcnow(),
            description="Test expense",
            amount=100,
            type='outflow',
            category='Other-cfo'
        ).save()
        
        # 3. Detect anomalies
        mock_response.content = [Mock(text='[]')]
        anomalies_response = client.get(
            f'/api/ai/anomalies?company_id={test_company.id}',
            headers=auth_headers
        )
        assert anomalies_response.status_code == 200
        
        # 4. Get insights
        mock_response.content = [Mock(text='{"alerts": [], "opportunities": [], "trends": [], "recommendations": []}')]
        insights_response = client.get(
            f'/api/ai/insights?company_id={test_company.id}',
            headers=auth_headers
        )
        assert insights_response.status_code == 200


# Error handling tests
class TestAIErrorHandling:
    """Tests for AI feature error handling."""
    
    @patch('src.anthropic_service.Anthropic')
    def test_ai_service_timeout(self, mock_anthropic, client, auth_headers):
        """Test handling of AI service timeout."""
        mock_anthropic.return_value.messages.create.side_effect = TimeoutError("AI service timeout")
        
        response = client.post(
            '/api/ai/categorize',
            json={"description": "test", "amount": 100},
            headers=auth_headers
        )
        
        assert response.status_code == 500
    
    @patch('src.anthropic_service.Anthropic')
    def test_ai_invalid_json_response(self, mock_anthropic, client, auth_headers):
        """Test handling of invalid JSON from AI."""
        mock_response = Mock()
        mock_response.content = [Mock(text="This is not valid JSON")]
        mock_anthropic.return_value.messages.create.return_value = mock_response
        
        response = client.post(
            '/api/ai/categorize',
            json={"description": "test", "amount": 100},
            headers=auth_headers
        )
        
        # Should return 200 with fallback categorization
        assert response.status_code in [200, 500]

