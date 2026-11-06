from datetime import datetime, timedelta
from src.models import Receivable, Payable, User, Company
from flask_mail import Message
from flask import current_app

def get_aging_report(company_id, report_type='receivables'):
    """
    Generate aging report for receivables or payables.
    
    Args:
        company_id: The company ID to filter by
        report_type: Either 'receivables' or 'payables'
    
    Returns:
        dict: Aging buckets with total amounts
    """
    today = datetime.utcnow().date()
    if report_type == 'receivables':
        items = Receivable.objects(company_id=company_id)
    else:
        items = Payable.objects(company_id=company_id)
    
    # Categories: current (not yet due), and overdue buckets
    aging = {'current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0}
    
    for item in items:
        if item.status != 'paid':
            days_past_due = (today - item.due_date.date()).days
            
            if days_past_due <= 0:
                # Not yet due (current)
                aging['current'] += item.amount
            elif days_past_due <= 30:
                aging['1-30'] += item.amount
                if item.status != 'overdue':
                    item.status = 'overdue'
                    item.save()
            elif days_past_due <= 60:
                aging['31-60'] += item.amount
                if item.status != 'overdue':
                    item.status = 'overdue'
                    item.save()
            elif days_past_due <= 90:
                aging['61-90'] += item.amount
                if item.status != 'overdue':
                    item.status = 'overdue'
                    item.save()
            else:
                aging['90+'] += item.amount
                if item.status != 'overdue':
                    item.status = 'overdue'
                    item.save()
    
    return aging

def check_overdue_and_remind():
    """
    Check for overdue items and send reminder emails to company admins.
    """
    try:
        receivables = Receivable.objects(status='overdue')
        for r in receivables:
            # Get company and find admin users
            company = Company.objects(id=r.company_id.id).first()
            if company:
                # Get users with admin role in this company
                admin_users = User.objects(
                    company_memberships__company_id=company.id,
                    company_memberships__role='admin',
                    is_active=True
                )
                for admin in admin_users:
                    send_reminder(
                        admin.email, 
                        f"Overdue Receivable: {r.description or 'No description'}", 
                        f"Amount: {r.amount} due on {r.due_date.strftime('%Y-%m-%d')}"
                    )
        
        payables = Payable.objects(status='overdue')
        for p in payables:
            company = Company.objects(id=p.company_id.id).first()
            if company:
                admin_users = User.objects(
                    company_memberships__company_id=company.id,
                    company_memberships__role='admin',
                    is_active=True
                )
                for admin in admin_users:
                    send_reminder(
                        admin.email, 
                        f"Overdue Payable: {p.description or 'No description'}", 
                        f"Amount: {p.amount} due on {p.due_date.strftime('%Y-%m-%d')}"
                    )
    except Exception as e:
        current_app.logger.error(f"Error in check_overdue_and_remind: {str(e)}")

def send_reminder(to_email, subject, body):
    """
    Send reminder email. Handles errors gracefully.
    """
    try:
        if not current_app or 'mail' not in current_app.extensions:
            current_app.logger.warning("Mail extension not available, skipping reminder email")
            return False
        
        msg = Message(subject, recipients=[to_email])
        msg.body = body
        current_app.extensions['mail'].send(msg)
        current_app.logger.info(f"Reminder sent to {to_email}: {subject}")
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send reminder to {to_email}: {str(e)}")
        return False
