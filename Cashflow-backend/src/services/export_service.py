"""
Export/Import Service for Flowback Cashflow API.

This module provides data export and import functionality including:
- CSV export for transactions and forecasts
- PDF export for invoices and reports
- CSV import with validation
- Error handling for malformed imports

Dependencies:
    pip install reportlab pandas openpyxl
"""

import io
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from flask import current_app
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfgen import canvas

from src.models import Transaction, Invoice, Forecast, Company, utc_now


class ExportService:
    """
    Service for exporting and importing financial data.
    
    Supports CSV and PDF formats for various data types.
    """
    
    # ==========================================================================
    # CSV Export Methods
    # ==========================================================================
    
    @staticmethod
    def export_transactions_csv(
        transactions: List[Transaction],
        include_running_balance: bool = False,
        initial_balance: float = 0.0
    ) -> str:
        """
        Export transactions to CSV format.
        
        Args:
            transactions: List of Transaction documents
            include_running_balance: Whether to include running balance column
            initial_balance: Starting balance for running balance calculation
        
        Returns:
            str: CSV formatted string
        """
        data = []
        running_balance = initial_balance
        
        # Sort by date for accurate running balance
        sorted_transactions = sorted(transactions, key=lambda x: x.date or datetime.min)
        
        for txn in sorted_transactions:
            row = {
                'Date': txn.date.strftime('%Y-%m-%d') if txn.date else '',
                'Description': txn.description,
                'Type': txn.type,
                'Amount': txn.amount,
                'Category': txn.category,
                'Currency': txn.currency or 'USD'
            }
            
            if include_running_balance:
                if txn.type == 'inflow':
                    running_balance += txn.amount
                else:
                    running_balance -= txn.amount
                row['Running_Balance'] = round(running_balance, 2)
            
            data.append(row)
        
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue()
    
    @staticmethod
    def export_forecasts_csv(forecasts: List[Forecast]) -> str:
        """
        Export forecasts to CSV format.
        
        Args:
            forecasts: List of Forecast documents
        
        Returns:
            str: CSV formatted string
        """
        data = []
        
        for forecast in forecasts:
            projections = forecast.projections or {}
            
            # Flatten projections for CSV
            row = {
                'Scenario_Name': forecast.scenario_name,
                'Created_At': forecast.created_at.strftime('%Y-%m-%d %H:%M:%S') if forecast.created_at else '',
            }
            
            # Add projection data
            if 'monthly_breakdown' in projections:
                for i, month_data in enumerate(projections['monthly_breakdown']):
                    row[f'Month_{i+1}_Revenue'] = month_data.get('revenue', 0)
                    row[f'Month_{i+1}_Expenses'] = month_data.get('expenses', 0)
            else:
                row['Expected_Revenue'] = projections.get('expected_revenue', 0)
                row['Expected_Expenses'] = projections.get('expected_expenses', 0)
                row['Net_Cash_Flow'] = projections.get('net_cash_flow', 0)
            
            data.append(row)
        
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue()
    
    @staticmethod
    def export_invoices_csv(invoices: List[Invoice]) -> str:
        """
        Export invoices to CSV format.
        
        Args:
            invoices: List of Invoice documents
        
        Returns:
            str: CSV formatted string
        """
        data = []
        
        for invoice in invoices:
            row = {
                'Invoice_Number': invoice.invoice_number,
                'Customer_Name': invoice.customer_name,
                'Customer_Email': invoice.customer_email or '',
                'Issue_Date': invoice.issue_date.strftime('%Y-%m-%d') if invoice.issue_date else '',
                'Due_Date': invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else '',
                'Subtotal': invoice.subtotal,
                'Tax_Rate': invoice.tax_rate,
                'Tax_Amount': invoice.tax_amount,
                'Total_Amount': invoice.total_amount,
                'Currency': invoice.currency or 'USD',
                'Status': invoice.status,
                'Paid_At': invoice.paid_at.strftime('%Y-%m-%d') if invoice.paid_at else ''
            }
            data.append(row)
        
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue()
    
    # ==========================================================================
    # PDF Export Methods
    # ==========================================================================
    
    @staticmethod
    def export_invoice_pdf(invoice: Invoice, company: Optional[Company] = None) -> bytes:
        """
        Export invoice to PDF format.
        
        Args:
            invoice: Invoice document to export
            company: Optional company for header information
        
        Returns:
            bytes: PDF file content
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                               rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#2C3E50')
        )
        
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=6
        )
        
        # Invoice Title
        elements.append(Paragraph(f"INVOICE", title_style))
        elements.append(Paragraph(f"#{invoice.invoice_number}", styles['Heading2']))
        elements.append(Spacer(1, 20))
        
        # Company info (if available)
        if company:
            elements.append(Paragraph(f"<b>From:</b> {company.name}", header_style))
            elements.append(Spacer(1, 10))
        
        # Customer info
        elements.append(Paragraph(f"<b>Bill To:</b>", header_style))
        elements.append(Paragraph(f"{invoice.customer_name}", header_style))
        if invoice.customer_email:
            elements.append(Paragraph(f"{invoice.customer_email}", header_style))
        elements.append(Spacer(1, 20))
        
        # Dates
        issue_date = invoice.issue_date.strftime('%B %d, %Y') if invoice.issue_date else 'N/A'
        due_date = invoice.due_date.strftime('%B %d, %Y') if invoice.due_date else 'N/A'
        
        date_data = [
            ['Issue Date:', issue_date],
            ['Due Date:', due_date],
            ['Status:', invoice.status.upper()]
        ]
        
        date_table = Table(date_data, colWidths=[1.5*inch, 2*inch])
        date_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(date_table)
        elements.append(Spacer(1, 30))
        
        # Line items table
        elements.append(Paragraph("<b>Line Items</b>", styles['Heading3']))
        elements.append(Spacer(1, 10))
        
        line_items_data = [['Description', 'Qty', 'Rate', 'Amount']]
        
        for item in invoice.line_items:
            qty = item.get('quantity', 1)
            rate = item.get('rate', item.get('amount', 0))
            amount = item.get('amount', qty * rate)
            line_items_data.append([
                item.get('description', 'Item'),
                str(qty),
                f"${rate:,.2f}",
                f"${amount:,.2f}"
            ])
        
        line_table = Table(line_items_data, colWidths=[3.5*inch, 0.75*inch, 1*inch, 1*inch])
        line_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ECF0F1')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#BDC3C7')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(line_table)
        elements.append(Spacer(1, 20))
        
        # Totals
        currency = invoice.currency or 'USD'
        totals_data = [
            ['Subtotal:', f"${invoice.subtotal:,.2f}"],
            [f'Tax ({invoice.tax_rate * 100:.1f}%):', f"${invoice.tax_amount:,.2f}"],
            ['Total:', f"${invoice.total_amount:,.2f} {currency}"]
        ]
        
        totals_table = Table(totals_data, colWidths=[5*inch, 1.25*inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
        ]))
        elements.append(totals_table)
        
        # Notes
        if invoice.notes:
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("<b>Notes:</b>", styles['Heading4']))
            elements.append(Paragraph(invoice.notes, styles['Normal']))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def export_transactions_pdf(
        transactions: List[Transaction],
        title: str = "Transaction Report",
        company: Optional[Company] = None,
        date_range: Optional[Tuple[datetime, datetime]] = None
    ) -> bytes:
        """
        Export transactions to PDF report format.
        
        Args:
            transactions: List of Transaction documents
            title: Report title
            company: Optional company for header
            date_range: Optional tuple of (start_date, end_date)
        
        Returns:
            bytes: PDF file content
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                               rightMargin=50, leftMargin=50,
                               topMargin=50, bottomMargin=50)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            textColor=colors.HexColor('#2C3E50')
        )
        elements.append(Paragraph(title, title_style))
        
        # Company and date info
        if company:
            elements.append(Paragraph(f"Company: {company.name}", styles['Normal']))
        
        if date_range:
            start_str = date_range[0].strftime('%Y-%m-%d')
            end_str = date_range[1].strftime('%Y-%m-%d')
            elements.append(Paragraph(f"Period: {start_str} to {end_str}", styles['Normal']))
        
        elements.append(Paragraph(f"Generated: {utc_now().strftime('%Y-%m-%d %H:%M UTC')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Summary statistics
        total_inflows = sum(t.amount for t in transactions if t.type == 'inflow')
        total_outflows = sum(t.amount for t in transactions if t.type == 'outflow')
        net_flow = total_inflows - total_outflows
        
        summary_data = [
            ['Total Inflows:', f"${total_inflows:,.2f}"],
            ['Total Outflows:', f"${total_outflows:,.2f}"],
            ['Net Cash Flow:', f"${net_flow:,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TEXTCOLOR', (1, -1), (1, -1), 
             colors.green if net_flow >= 0 else colors.red),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        # Transactions table
        elements.append(Paragraph("<b>Transaction Details</b>", styles['Heading3']))
        elements.append(Spacer(1, 10))
        
        table_data = [['Date', 'Description', 'Type', 'Category', 'Amount']]
        
        sorted_transactions = sorted(transactions, key=lambda x: x.date or datetime.min, reverse=True)
        
        for txn in sorted_transactions[:100]:  # Limit to prevent huge PDFs
            amount_str = f"${txn.amount:,.2f}"
            if txn.type == 'outflow':
                amount_str = f"-{amount_str}"
            
            table_data.append([
                txn.date.strftime('%Y-%m-%d') if txn.date else '',
                txn.description[:40] + '...' if len(txn.description) > 40 else txn.description,
                txn.type.capitalize(),
                txn.category.capitalize(),
                amount_str
            ])
        
        txn_table = Table(table_data, colWidths=[1*inch, 2.5*inch, 0.8*inch, 1*inch, 1*inch])
        txn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BDC3C7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9F9')]),
        ]))
        elements.append(txn_table)
        
        if len(transactions) > 100:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(
                f"<i>Showing first 100 of {len(transactions)} transactions</i>",
                styles['Normal']
            ))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    # ==========================================================================
    # CSV Import Methods
    # ==========================================================================
    
    @staticmethod
    def validate_transaction_csv(csv_file) -> Tuple[bool, List[Dict], List[str]]:
        """
        Validate a CSV file for transaction import.
        
        Args:
            csv_file: File-like object containing CSV data
        
        Returns:
            Tuple of (is_valid, parsed_rows, errors)
        """
        errors = []
        parsed_rows = []
        
        try:
            df = pd.read_csv(csv_file)
        except Exception as e:
            return False, [], [f"Failed to parse CSV: {str(e)}"]
        
        # Check required columns (case-insensitive)
        df.columns = [col.strip().lower() for col in df.columns]
        required_columns = ['date', 'description', 'type', 'amount']
        
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return False, [], [f"Missing required columns: {', '.join(missing_cols)}"]
        
        # Validate each row
        for idx, row in df.iterrows():
            row_num = idx + 2  # Account for 0-index and header
            row_errors = []
            
            # Validate date
            try:
                date_val = pd.to_datetime(row['date'])
                if pd.isna(date_val):
                    row_errors.append(f"Row {row_num}: Invalid date")
            except:
                row_errors.append(f"Row {row_num}: Invalid date format")
                date_val = None
            
            # Validate description
            description = str(row.get('description', '')).strip()
            if not description or description == 'nan':
                row_errors.append(f"Row {row_num}: Description is required")
            
            # Validate type
            txn_type = str(row.get('type', '')).strip().lower()
            if txn_type not in ['inflow', 'outflow']:
                row_errors.append(f"Row {row_num}: Type must be 'inflow' or 'outflow', got '{txn_type}'")
            
            # Validate amount
            try:
                amount = float(row['amount'])
                if amount <= 0:
                    row_errors.append(f"Row {row_num}: Amount must be positive")
            except:
                row_errors.append(f"Row {row_num}: Invalid amount")
                amount = None
            
            # Validate category (optional)
            category = str(row.get('category', 'operating')).strip().lower()
            valid_categories = ['operating', 'investing', 'financing', 'revenue', 
                              'expenses', 'assets', 'equipment', 'loans', 'equity']
            if category and category != 'nan' and category not in valid_categories:
                category = 'operating'  # Default to operating if invalid
            elif category == 'nan' or not category:
                category = 'operating'
            
            # Currency (optional)
            currency = str(row.get('currency', 'USD')).strip().upper()
            if currency == 'NAN' or not currency:
                currency = 'USD'
            
            if row_errors:
                errors.extend(row_errors)
            else:
                parsed_rows.append({
                    'date': date_val,
                    'description': description,
                    'type': txn_type,
                    'amount': amount,
                    'category': category,
                    'currency': currency
                })
        
        is_valid = len(errors) == 0
        return is_valid, parsed_rows, errors
    
    @staticmethod
    def import_transactions_csv(
        csv_file,
        company_id: str,
        user_id: str,
        validate_only: bool = False
    ) -> Dict[str, Any]:
        """
        Import transactions from CSV file.
        
        Args:
            csv_file: File-like object containing CSV data
            company_id: Company ID to import transactions into
            user_id: User ID performing the import
            validate_only: If True, only validate without importing
        
        Returns:
            Dict with 'success', 'imported_count', 'errors', and 'transactions' keys
        """
        from src.models import Company
        
        # Validate first
        is_valid, parsed_rows, errors = ExportService.validate_transaction_csv(csv_file)
        
        result = {
            'success': is_valid,
            'validated_count': len(parsed_rows),
            'errors': errors,
            'imported_count': 0,
            'transactions': []
        }
        
        if validate_only or not is_valid:
            return result
        
        # Import transactions
        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            result['success'] = False
            result['errors'].append(f"Company not found: {company_id}")
            return result
        
        imported = []
        for row in parsed_rows:
            try:
                txn = Transaction(
                    company_id=company,
                    user_id=user_id,
                    date=row['date'],
                    description=row['description'],
                    type=row['type'],
                    amount=row['amount'],
                    category=row['category'],
                    currency=row['currency']
                )
                txn.save()
                imported.append({
                    'id': str(txn.id),
                    'description': txn.description,
                    'amount': txn.amount
                })
            except Exception as e:
                result['errors'].append(f"Failed to import '{row['description']}': {str(e)}")
        
        result['imported_count'] = len(imported)
        result['transactions'] = imported
        result['success'] = len(imported) > 0
        
        current_app.logger.info(
            f"Imported {len(imported)} transactions for company {company_id}"
        )
        
        return result


def get_export_service() -> ExportService:
    """
    Factory function to get an ExportService instance.
    
    Returns:
        ExportService: Export service instance
    """
    return ExportService()
