"""
Invoice Automation Service for Flowback Cashflow API.

This module provides automated invoice generation functionality including:
- Template-based invoice creation with minimal inputs
- Scheduled automatic invoice generation
- Invoice number generation
- Overdue invoice detection and status updates
"""

from datetime import timedelta
from typing import Optional, Dict, Any, List
from flask import current_app

from src.models import InvoiceTemplate, Invoice, Company, User, utc_now
from src.constants import (
    INVOICE_STATUS_DRAFT,
    INVOICE_STATUS_OVERDUE,
    INVOICE_FREQUENCY_DAILY,
    INVOICE_FREQUENCY_WEEKLY,
    INVOICE_FREQUENCY_MONTHLY,
    DEFAULT_DUE_DAYS,
    DEFAULT_TAX_RATE
)


def generate_invoice_number(company_id: str) -> str:
    """
    Generate a unique invoice number for a company.
    
    Format: INV-{COMPANY_PREFIX}-{YEAR}{MONTH}-{SEQUENCE}
    Example: INV-ACME-202601-0001
    
    Args:
        company_id: The company's ObjectId as string
    
    Returns:
        str: Unique invoice number
    """
    from datetime import datetime
    
    try:
        company = Company.objects.get(id=company_id)
        # Create prefix from company name (first 4 chars uppercase)
        company_prefix = ''.join(c for c in company.name[:4].upper() if c.isalnum())
        if len(company_prefix) < 4:
            company_prefix = company_prefix.ljust(4, 'X')
    except Company.DoesNotExist:
        company_prefix = 'UNKN'
    
    now = utc_now()
    year_month = now.strftime('%Y%m')
    
    # Get the count of invoices for this company in the current month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1)
    else:
        next_month = now.replace(month=now.month + 1, day=1)
    
    invoice_count = Invoice.objects(
        company_id=company_id,
        created_at__gte=month_start,
        created_at__lt=next_month
    ).count()
    
    sequence = str(invoice_count + 1).zfill(4)
    
    return f"INV-{company_prefix}-{year_month}-{sequence}"


def generate_invoice_from_template(
    template_id: str,
    customer_data: Dict[str, Any],
    created_by_user_id: str,
    line_items_override: Optional[List[Dict]] = None
) -> Invoice:
    """
    Generate an invoice from a template with minimal inputs.
    
    Args:
        template_id: The InvoiceTemplate ObjectId
        customer_data: Dict containing at minimum 'customer_name', optionally 'customer_email'
        created_by_user_id: The user creating the invoice
        line_items_override: Optional list of line items to override template defaults
    
    Returns:
        Invoice: The created invoice document
    
    Raises:
        InvoiceTemplate.DoesNotExist: If template not found
        ValueError: If required customer data is missing
    """
    if not customer_data.get('customer_name'):
        raise ValueError("customer_name is required")
    
    template = InvoiceTemplate.objects.get(id=template_id)
    user = User.objects.get(id=created_by_user_id)
    
    # Generate invoice number
    invoice_number = generate_invoice_number(str(template.company_id.id))
    
    # Calculate due date
    due_days = template.default_due_days or DEFAULT_DUE_DAYS
    due_date = utc_now() + timedelta(days=due_days)
    
    # Use override line items or template defaults
    line_items = line_items_override or template.line_items_template or []
    
    # Calculate totals
    subtotal = sum(float(item.get('amount', 0)) for item in line_items)
    tax_rate = template.default_tax_rate or DEFAULT_TAX_RATE
    tax_amount = subtotal * tax_rate
    total_amount = subtotal + tax_amount
    
    # Create invoice
    invoice = Invoice(
        company_id=template.company_id,
        invoice_number=invoice_number,
        customer_name=customer_data['customer_name'],
        customer_email=customer_data.get('customer_email'),
        due_date=due_date,
        line_items=line_items,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        currency=template.company_id.currency or 'USD',
        status=INVOICE_STATUS_DRAFT,
        template_id=template,
        created_by=user
    )
    invoice.save()
    
    current_app.logger.info(
        f"Invoice {invoice_number} created from template {template.template_name} "
        f"for {customer_data['customer_name']}"
    )
    
    return invoice


def calculate_next_generation_date(frequency: str, from_date=None) -> 'datetime':
    """
    Calculate the next invoice generation date based on frequency.
    
    Args:
        frequency: One of 'daily', 'weekly', 'monthly'
        from_date: Starting date (defaults to now)
    
    Returns:
        datetime: Next generation date
    """
    from_date = from_date or utc_now()
    
    if frequency == INVOICE_FREQUENCY_DAILY:
        return from_date + timedelta(days=1)
    elif frequency == INVOICE_FREQUENCY_WEEKLY:
        return from_date + timedelta(weeks=1)
    elif frequency == INVOICE_FREQUENCY_MONTHLY:
        # Add approximately one month
        if from_date.month == 12:
            return from_date.replace(year=from_date.year + 1, month=1)
        else:
            # Handle varying month lengths
            next_month = from_date.month + 1
            try:
                return from_date.replace(month=next_month)
            except ValueError:
                # Day doesn't exist in next month (e.g., Jan 31 -> Feb)
                # Go to last day of next month
                if next_month == 12:
                    last_day = from_date.replace(year=from_date.year + 1, month=1, day=1) - timedelta(days=1)
                else:
                    last_day = from_date.replace(month=next_month + 1, day=1) - timedelta(days=1)
                return last_day
    else:
        # Default to monthly
        return from_date + timedelta(days=30)


def process_automated_invoices() -> Dict[str, Any]:
    """
    Background task to generate invoices based on schedule.
    
    This function should be called by a scheduler (e.g., APScheduler, Celery)
    to process templates with auto_generate=True that are due.
    
    Returns:
        Dict with 'processed', 'failed', and 'errors' counts/details
    """
    results = {
        'processed': 0,
        'failed': 0,
        'errors': [],
        'invoices_created': []
    }
    
    now = utc_now()
    
    # Find templates due for generation
    templates = InvoiceTemplate.objects(
        auto_generate=True,
        is_active=True,
        next_generation_date__lte=now
    )
    
    for template in templates:
        try:
            # For automated invoices, we need a default customer or skip
            # In a real implementation, you might have a recurring customer linked to the template
            # For now, we'll create a placeholder that should be updated
            
            customer_data = {
                'customer_name': f"Auto-generated - {template.template_name}",
                'customer_email': None
            }
            
            # Get the template creator as the invoice creator
            invoice = generate_invoice_from_template(
                template_id=str(template.id),
                customer_data=customer_data,
                created_by_user_id=str(template.created_by.id)
            )
            
            # Update next generation date
            template.next_generation_date = calculate_next_generation_date(
                template.generation_frequency,
                now
            )
            template.save()
            
            results['processed'] += 1
            results['invoices_created'].append(invoice.invoice_number)
            
            current_app.logger.info(
                f"Auto-generated invoice {invoice.invoice_number} from template "
                f"{template.template_name}. Next generation: {template.next_generation_date}"
            )
            
        except Exception as e:
            results['failed'] += 1
            error_msg = f"Template {template.id}: {str(e)}"
            results['errors'].append(error_msg)
            current_app.logger.error(f"Failed to auto-generate invoice: {error_msg}")
    
    return results


def update_overdue_invoices() -> Dict[str, Any]:
    """
    Update status of invoices that are past due date.
    
    This function should be called daily to mark invoices as overdue.
    
    Returns:
        Dict with 'updated' count and 'invoice_numbers' list
    """
    results = {
        'updated': 0,
        'invoice_numbers': []
    }
    
    now = utc_now()
    
    # Find invoices that are past due and not already paid/overdue
    overdue_invoices = Invoice.objects(
        due_date__lt=now,
        status__in=[INVOICE_STATUS_DRAFT, 'sent']
    )
    
    for invoice in overdue_invoices:
        invoice.status = INVOICE_STATUS_OVERDUE
        invoice.save()
        
        results['updated'] += 1
        results['invoice_numbers'].append(invoice.invoice_number)
        
        current_app.logger.info(f"Invoice {invoice.invoice_number} marked as overdue")
    
    return results


def get_invoice_summary(company_id: str) -> Dict[str, Any]:
    """
    Get invoice summary statistics for a company.
    
    Args:
        company_id: The company's ObjectId as string
    
    Returns:
        Dict with invoice counts and totals by status
    """
    summary = {
        'total_invoices': 0,
        'by_status': {
            'draft': {'count': 0, 'total': 0.0},
            'sent': {'count': 0, 'total': 0.0},
            'paid': {'count': 0, 'total': 0.0},
            'overdue': {'count': 0, 'total': 0.0}
        },
        'total_outstanding': 0.0,
        'total_paid': 0.0
    }
    
    invoices = Invoice.objects(company_id=company_id)
    
    for invoice in invoices:
        summary['total_invoices'] += 1
        status = invoice.status
        
        if status in summary['by_status']:
            summary['by_status'][status]['count'] += 1
            summary['by_status'][status]['total'] += invoice.total_amount
        
        if status in ['draft', 'sent', 'overdue']:
            summary['total_outstanding'] += invoice.total_amount
        elif status == 'paid':
            summary['total_paid'] += invoice.total_amount
    
    return summary
