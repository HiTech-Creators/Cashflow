"""
Tests for Import/Export Service functionality.

Tests cover:
- CSV export for transactions
- CSV export for invoices
- PDF export for invoices
- PDF export for transaction reports
- CSV import with validation
- Error handling for malformed imports
"""

import pytest
import io
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from src.services.export_service import ExportService, get_export_service
from src.models import Transaction, Invoice, Company, Forecast


class TestExportService:
    """Test cases for ExportService class."""
    
    def test_get_export_service(self):
        """Test that get_export_service returns ExportService instance."""
        service = get_export_service()
        assert isinstance(service, ExportService)
    
    # =========================================================================
    # CSV Export Tests
    # =========================================================================
    
    def test_export_transactions_csv_basic(self, user_a, company_a, sample_transactions_a):
        """Test basic CSV export of transactions."""
        service = get_export_service()
        
        csv_data = service.export_transactions_csv(sample_transactions_a)
        
        assert csv_data is not None
        assert 'Date' in csv_data
        assert 'Description' in csv_data
        assert 'Type' in csv_data
        assert 'Amount' in csv_data
        assert 'Category' in csv_data
        assert 'Currency' in csv_data
        
        # Check that we have multiple lines (header + data)
        lines = csv_data.strip().split('\n')
        assert len(lines) > 1
    
    def test_export_transactions_csv_with_running_balance(self, user_a, company_a, sample_transactions_a):
        """Test CSV export with running balance column."""
        service = get_export_service()
        
        csv_data = service.export_transactions_csv(
            sample_transactions_a,
            include_running_balance=True,
            initial_balance=1000.0
        )
        
        assert 'Running_Balance' in csv_data
        
        # Verify running balance is calculated
        lines = csv_data.strip().split('\n')
        header = lines[0]
        assert 'Running_Balance' in header
    
    def test_export_transactions_csv_empty_list(self):
        """Test CSV export with empty transaction list."""
        service = get_export_service()
        
        csv_data = service.export_transactions_csv([])
        
        # Should have header row only
        lines = csv_data.strip().split('\n')
        assert len(lines) == 1  # Header only
    
    def test_export_invoices_csv(self, company_a, user_a):
        """Test CSV export of invoices."""
        # Create test invoices
        invoices = []
        for i in range(3):
            invoice = Invoice(
                company_id=company_a,
                invoice_number=f'INV-TEST-{i+1}',
                customer_name=f'Customer {i+1}',
                customer_email=f'customer{i+1}@test.com',
                due_date=datetime.utcnow() + timedelta(days=30),
                line_items=[{'description': 'Service', 'amount': 100}],
                subtotal=100.0,
                tax_rate=0.1,
                tax_amount=10.0,
                total_amount=110.0,
                status='draft',
                created_by=user_a
            ).save()
            invoices.append(invoice)
        
        service = get_export_service()
        csv_data = service.export_invoices_csv(invoices)
        
        assert 'Invoice_Number' in csv_data
        assert 'Customer_Name' in csv_data
        assert 'Total_Amount' in csv_data
        assert 'INV-TEST-1' in csv_data
    
    def test_export_forecasts_csv(self, user_a, company_a):
        """Test CSV export of forecasts."""
        # Create test forecasts
        forecasts = []
        for i in range(2):
            forecast = Forecast(
                user_id=user_a,
                company_id=company_a,
                scenario_name=f'Test Scenario {i+1}',
                projections={
                    'expected_revenue': 10000 * (i+1),
                    'expected_expenses': 5000 * (i+1),
                    'net_cash_flow': 5000 * (i+1)
                }
            ).save()
            forecasts.append(forecast)
        
        service = get_export_service()
        csv_data = service.export_forecasts_csv(forecasts)
        
        assert 'Scenario_Name' in csv_data
        assert 'Test Scenario 1' in csv_data
        assert 'Expected_Revenue' in csv_data or 'Net_Cash_Flow' in csv_data
    
    # =========================================================================
    # PDF Export Tests
    # =========================================================================
    
    def test_export_invoice_pdf(self, company_a, user_a):
        """Test PDF export of an invoice."""
        invoice = Invoice(
            company_id=company_a,
            invoice_number='INV-PDF-001',
            customer_name='PDF Test Customer',
            customer_email='pdf@test.com',
            due_date=datetime.utcnow() + timedelta(days=30),
            line_items=[
                {'description': 'Service A', 'quantity': 2, 'rate': 50, 'amount': 100},
                {'description': 'Service B', 'quantity': 1, 'rate': 200, 'amount': 200}
            ],
            subtotal=300.0,
            tax_rate=0.1,
            tax_amount=30.0,
            total_amount=330.0,
            status='sent',
            notes='Test invoice notes',
            created_by=user_a
        ).save()
        
        service = get_export_service()
        pdf_data = service.export_invoice_pdf(invoice, company=company_a)
        
        assert pdf_data is not None
        assert isinstance(pdf_data, bytes)
        assert len(pdf_data) > 0
        # Check PDF magic number
        assert pdf_data[:4] == b'%PDF'
    
    def test_export_invoice_pdf_without_company(self, company_a, user_a):
        """Test PDF export without company info."""
        invoice = Invoice(
            company_id=company_a,
            invoice_number='INV-PDF-002',
            customer_name='Another Customer',
            due_date=datetime.utcnow() + timedelta(days=30),
            line_items=[{'description': 'Service', 'amount': 100}],
            subtotal=100.0,
            total_amount=100.0,
            status='draft',
            created_by=user_a
        ).save()
        
        service = get_export_service()
        pdf_data = service.export_invoice_pdf(invoice, company=None)
        
        assert pdf_data is not None
        assert pdf_data[:4] == b'%PDF'
    
    def test_export_transactions_pdf(self, user_a, company_a, sample_transactions_a):
        """Test PDF export of transactions report."""
        service = get_export_service()
        
        pdf_data = service.export_transactions_pdf(
            sample_transactions_a,
            title='Monthly Transaction Report',
            company=company_a
        )
        
        assert pdf_data is not None
        assert isinstance(pdf_data, bytes)
        assert pdf_data[:4] == b'%PDF'
    
    def test_export_transactions_pdf_with_date_range(self, user_a, company_a, sample_transactions_a):
        """Test PDF export with date range."""
        service = get_export_service()
        
        date_range = (
            datetime.utcnow() - timedelta(days=30),
            datetime.utcnow()
        )
        
        pdf_data = service.export_transactions_pdf(
            sample_transactions_a,
            title='Period Report',
            company=company_a,
            date_range=date_range
        )
        
        assert pdf_data is not None
        assert pdf_data[:4] == b'%PDF'
    
    # =========================================================================
    # CSV Import Tests
    # =========================================================================
    
    def test_validate_transaction_csv_valid(self):
        """Test validation of valid CSV data."""
        csv_content = """Date,Description,Type,Amount,Category
2024-01-15,Test Transaction 1,inflow,1000,operating
2024-01-16,Test Transaction 2,outflow,500,expenses
2024-01-17,Test Transaction 3,inflow,750,revenue"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is True
        assert len(parsed_rows) == 3
        assert len(errors) == 0
        
        # Check parsed data
        assert parsed_rows[0]['description'] == 'Test Transaction 1'
        assert parsed_rows[0]['amount'] == 1000.0
        assert parsed_rows[0]['type'] == 'inflow'
    
    def test_validate_transaction_csv_missing_columns(self):
        """Test validation fails for missing required columns."""
        csv_content = """Date,Description,Amount
2024-01-15,Test,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert 'type' in errors[0].lower()
    
    def test_validate_transaction_csv_invalid_type(self):
        """Test validation catches invalid transaction type."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Test Transaction,invalid_type,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert any('type' in e.lower() for e in errors)
    
    def test_validate_transaction_csv_invalid_amount(self):
        """Test validation catches invalid amount."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Test Transaction,inflow,not_a_number"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert any('amount' in e.lower() for e in errors)
    
    def test_validate_transaction_csv_negative_amount(self):
        """Test validation catches negative amount."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Test Transaction,inflow,-100"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert any('positive' in e.lower() for e in errors)
    
    def test_validate_transaction_csv_invalid_date(self):
        """Test validation catches invalid date format."""
        csv_content = """Date,Description,Type,Amount
not-a-date,Test Transaction,inflow,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert any('date' in e.lower() for e in errors)
    
    def test_validate_transaction_csv_empty_description(self):
        """Test validation catches empty description."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,,inflow,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert any('description' in e.lower() for e in errors)
    
    def test_validate_transaction_csv_case_insensitive_headers(self):
        """Test validation handles case-insensitive headers."""
        csv_content = """DATE,DESCRIPTION,TYPE,AMOUNT
2024-01-15,Test Transaction,inflow,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is True
        assert len(parsed_rows) == 1
    
    def test_import_transactions_csv_validate_only(self, company_a, user_a):
        """Test import with validate_only flag."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Import Test 1,inflow,1000
2024-01-16,Import Test 2,outflow,500"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        result = service.import_transactions_csv(
            csv_file=csv_file,
            company_id=str(company_a.id),
            user_id=str(user_a.id),
            validate_only=True
        )
        
        assert result['success'] is True
        assert result['validated_count'] == 2
        assert result['imported_count'] == 0  # Not imported, only validated
    
    def test_import_transactions_csv_actual_import(self, company_a, user_a):
        """Test actual import of transactions."""
        csv_content = """Date,Description,Type,Amount,Category
2024-01-15,Actual Import 1,inflow,1500,revenue
2024-01-16,Actual Import 2,outflow,750,expenses"""
        
        csv_file = io.StringIO(csv_content)
        
        # Count existing transactions
        initial_count = Transaction.objects(company_id=company_a.id).count()
        
        service = get_export_service()
        result = service.import_transactions_csv(
            csv_file=csv_file,
            company_id=str(company_a.id),
            user_id=str(user_a.id),
            validate_only=False
        )
        
        assert result['success'] is True
        assert result['imported_count'] == 2
        
        # Verify transactions were created
        final_count = Transaction.objects(company_id=company_a.id).count()
        assert final_count == initial_count + 2
    
    def test_import_transactions_csv_invalid_company(self, user_a):
        """Test import with invalid company ID."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Test,inflow,1000"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        result = service.import_transactions_csv(
            csv_file=csv_file,
            company_id='invalid_company_id',
            user_id=str(user_a.id),
            validate_only=False
        )
        
        assert result['success'] is False
        assert any('company' in e.lower() for e in result['errors'])
    
    def test_import_transactions_csv_partial_success(self, company_a, user_a):
        """Test import with some valid and some invalid rows."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Valid Transaction,inflow,1000
invalid-date,Invalid Transaction,inflow,500
2024-01-17,Another Valid,outflow,300"""
        
        csv_file = io.StringIO(csv_content)
        
        service = get_export_service()
        # Validation should fail on the invalid row
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        # Should have 2 valid rows
        assert len(parsed_rows) == 2
        assert len(errors) > 0


class TestExportRoutes:
    """Test cases for export/import API routes."""
    
    def test_export_transactions_csv_route(self, client, auth_headers_user_a, company_a, sample_transactions_a):
        """Test GET /api/companies/<id>/transactions/export/csv endpoint."""
        response = client.get(
            f'/api/companies/{company_a.id}/transactions/export/csv',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.content_type == 'text/csv'
        assert 'attachment' in response.headers.get('Content-Disposition', '')
    
    def test_export_transactions_csv_with_balance(self, client, auth_headers_user_a, company_a, sample_transactions_a):
        """Test CSV export with running balance."""
        response = client.get(
            f'/api/companies/{company_a.id}/transactions/export/csv?include_balance=true',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert b'Running_Balance' in response.data
    
    def test_export_transactions_csv_date_filter(self, client, auth_headers_user_a, company_a, sample_transactions_a):
        """Test CSV export with date filtering."""
        today = datetime.utcnow().strftime('%Y-%m-%d')
        response = client.get(
            f'/api/companies/{company_a.id}/transactions/export/csv?start_date=2024-01-01&end_date={today}',
            headers=auth_headers_user_a
        )
        
        # May return 200 or 404 depending on transaction dates
        assert response.status_code in [200, 404]
    
    def test_export_transactions_csv_no_auth(self, client, company_a):
        """Test that export requires authentication."""
        response = client.get(
            f'/api/companies/{company_a.id}/transactions/export/csv'
        )
        
        assert response.status_code == 401
    
    def test_export_transactions_csv_wrong_company(self, client, auth_headers_user_a, company_b):
        """Test export is denied for unauthorized company."""
        response = client.get(
            f'/api/companies/{company_b.id}/transactions/export/csv',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
    
    def test_export_transactions_pdf_route(self, client, auth_headers_user_a, company_a, sample_transactions_a):
        """Test GET /api/companies/<id>/transactions/export/pdf endpoint."""
        response = client.get(
            f'/api/companies/{company_a.id}/transactions/export/pdf',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.content_type == 'application/pdf'
        assert response.data[:4] == b'%PDF'
    
    def test_import_transactions_csv_route(self, client, auth_headers_user_a, company_a):
        """Test POST /api/companies/<id>/transactions/import/csv endpoint."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,API Import Test,inflow,2000"""
        
        data = {
            'file': (io.BytesIO(csv_content.encode()), 'test.csv')
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/transactions/import/csv',
            headers=auth_headers_user_a,
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 201
        assert response.json['imported_count'] == 1
    
    def test_import_transactions_csv_validate_only(self, client, auth_headers_user_a, company_a):
        """Test import with validate_only query param."""
        csv_content = """Date,Description,Type,Amount
2024-01-15,Validate Only Test,inflow,1000"""
        
        data = {
            'file': (io.BytesIO(csv_content.encode()), 'test.csv')
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/transactions/import/csv?validate_only=true',
            headers=auth_headers_user_a,
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 200
        assert response.json['validated_count'] == 1
    
    def test_import_transactions_csv_no_file(self, client, auth_headers_user_a, company_a):
        """Test import without file."""
        response = client.post(
            f'/api/companies/{company_a.id}/transactions/import/csv',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'file' in response.json['error'].lower()
    
    def test_import_transactions_csv_wrong_extension(self, client, auth_headers_user_a, company_a):
        """Test import with wrong file extension."""
        data = {
            'file': (io.BytesIO(b'test content'), 'test.txt')
        }
        
        response = client.post(
            f'/api/companies/{company_a.id}/transactions/import/csv',
            headers=auth_headers_user_a,
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 400
        assert 'csv' in response.json['error'].lower()
    
    def test_export_invoice_pdf_route(self, client, auth_headers_user_a, company_a, user_a):
        """Test GET /api/companies/<id>/invoices/<id>/export/pdf endpoint."""
        # Create test invoice
        invoice = Invoice(
            company_id=company_a,
            invoice_number='INV-ROUTE-001',
            customer_name='Route Test Customer',
            due_date=datetime.utcnow() + timedelta(days=30),
            line_items=[{'description': 'Service', 'amount': 100}],
            subtotal=100.0,
            total_amount=100.0,
            status='draft',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/invoices/{invoice.id}/export/pdf',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.content_type == 'application/pdf'
        assert response.data[:4] == b'%PDF'
    
    def test_export_invoices_csv_route(self, client, auth_headers_user_a, company_a, user_a):
        """Test GET /api/companies/<id>/invoices/export/csv endpoint."""
        # Create test invoice
        Invoice(
            company_id=company_a,
            invoice_number='INV-CSV-001',
            customer_name='CSV Test Customer',
            due_date=datetime.utcnow() + timedelta(days=30),
            line_items=[{'description': 'Service', 'amount': 100}],
            subtotal=100.0,
            total_amount=100.0,
            status='draft',
            created_by=user_a
        ).save()
        
        response = client.get(
            f'/api/companies/{company_a.id}/invoices/export/csv',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.content_type == 'text/csv'
        assert b'Invoice_Number' in response.data


class TestExportServiceEdgeCases:
    """Test edge cases and error handling."""
    
    def test_export_csv_with_special_characters(self, user_a, company_a):
        """Test CSV export handles special characters in descriptions."""
        # Create transaction with special characters
        txn = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=datetime.utcnow(),
            description='Test "quoted" text, with commas & special chars',
            amount=100.0,
            type='inflow',
            category='operating'
        ).save()
        
        service = get_export_service()
        csv_data = service.export_transactions_csv([txn])
        
        # Should not raise an error
        assert csv_data is not None
        # CSV should properly escape special characters
        assert 'Test' in csv_data
    
    def test_export_csv_with_null_date(self, user_a, company_a):
        """Test CSV export handles null dates gracefully."""
        txn = Transaction(
            user_id=user_a,
            company_id=company_a,
            date=None,  # Null date
            description='No Date Transaction',
            amount=50.0,
            type='outflow',
            category='operating'
        )
        # Don't save - just test export
        
        service = get_export_service()
        csv_data = service.export_transactions_csv([txn])
        
        assert csv_data is not None
    
    def test_validate_csv_malformed_file(self):
        """Test validation handles completely malformed CSV."""
        csv_file = io.StringIO("this is not a valid csv file content")
        
        service = get_export_service()
        is_valid, parsed_rows, errors = service.validate_transaction_csv(csv_file)
        
        assert is_valid is False
        assert len(errors) > 0
    
    def test_pdf_export_large_invoice(self, company_a, user_a):
        """Test PDF export handles invoice with many line items."""
        # Create invoice with many line items
        line_items = [
            {'description': f'Service Item {i}', 'quantity': i, 'rate': 10*i, 'amount': 10*i*i}
            for i in range(1, 51)
        ]
        
        invoice = Invoice(
            company_id=company_a,
            invoice_number='INV-LARGE-001',
            customer_name='Large Invoice Customer',
            due_date=datetime.utcnow() + timedelta(days=30),
            line_items=line_items,
            subtotal=sum(item['amount'] for item in line_items),
            total_amount=sum(item['amount'] for item in line_items),
            status='draft',
            created_by=user_a
        ).save()
        
        service = get_export_service()
        pdf_data = service.export_invoice_pdf(invoice)
        
        assert pdf_data is not None
        assert pdf_data[:4] == b'%PDF'
