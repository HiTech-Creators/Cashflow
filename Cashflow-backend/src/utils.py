import json
import pandas as pd
from datetime import datetime, timedelta
from src.models import Transaction, Company, User, Role
import calendar

def calculate_totals(transactions):
    total_cfo = 0  # Cash Flow from Operations
    total_cfi = 0  # Cash Flow from Investing
    total_cff = 0  # Cash Flow from Financing
    
    for transaction in transactions:
        amount = transaction.amount if transaction.type == 'inflow' else -transaction.amount
        
        if transaction.category in ['operating', 'revenue', 'expenses']:
            total_cfo += amount
        elif transaction.category in ['investing', 'assets', 'equipment']:
            total_cfi += amount
        elif transaction.category in ['financing', 'loans', 'equity']:
            total_cff += amount

    return total_cfo, total_cfi, total_cff

def get_monthly_data(user_id, company_id=None):
    query = Transaction.objects(user_id=user_id)
    if company_id:
        query = query.filter(company_id=company_id)
    
    transactions = query.all()
    monthly_data = {}
    
    for transaction in transactions:
        month_key = transaction.date.strftime('%Y-%m')
        if month_key not in monthly_data:
            monthly_data[month_key] = {'income': 0, 'expenses': 0}
        
        if transaction.type == 'inflow':
            monthly_data[month_key]['income'] += transaction.amount
        else:
            monthly_data[month_key]['expenses'] += transaction.amount
    
    return monthly_data

def get_category_breakdown(user_id, company_id=None, transaction_type='outflow'):

    query = Transaction.objects(user_id=user_id, type=transaction_type)
    if company_id:
        query = query.filter(company_id=company_id)
    
    transactions = query.all()
    categories = {}
    
    for transaction in transactions:
        category = transaction.category
        if category not in categories:
            categories[category] = 0
        categories[category] += transaction.amount
    
    return categories

def get_exchange_rate(from_currency, to_currency):
    """
    Get exchange rate between two currencies.
    
    Args:
        from_currency: Source currency code (e.g., 'USD')
        to_currency: Target currency code (e.g., 'EUR')
    
    Returns:
        float: Exchange rate, defaults to 1.0 on error
    """
    import requests
    from flask import current_app
    
    if from_currency == to_currency:
        return 1.0
    
    try:
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        rate = data['rates'].get(to_currency)
        if rate is None:
            current_app.logger.warning(f"Exchange rate not found for {to_currency}")
            return 1.0
        return float(rate)
    except requests.exceptions.Timeout:
        current_app.logger.error(f"Exchange rate API timeout for {from_currency} to {to_currency}")
        return 1.0
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Exchange rate API error: {str(e)}")
        return 1.0
    except (KeyError, ValueError) as e:
        current_app.logger.error(f"Exchange rate parsing error: {str(e)}")
        return 1.0
def verify_company_access(user_id, company_id):
    """
    Verify that a user has access to a specific company.
    
    Args:
        user_id: The user's ID
        company_id: The company's ID to check access for
    
    Returns:
        tuple: (bool, Company or error message)
    """
    from flask import current_app
    
    if not company_id:
        return False, "company_id is required"
    
    # Validate ObjectId format
    try:
        from bson.objectid import ObjectId
        from bson.errors import InvalidId
        ObjectId(company_id)
    except InvalidId:
        return False, "Invalid company_id format"
    except Exception as e:
        current_app.logger.error(f"ObjectId validation error: {str(e)}")
        return False, "Invalid company_id format"
    
    from src.models import User, Company
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        current_app.logger.warning(f"User not found: {user_id}")
        return False, "User not found"
    except Exception as e:
        current_app.logger.error(f"Error fetching user: {str(e)}")
        return False, "Error verifying access"
    
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return False, "Company not found"
    except Exception as e:
        current_app.logger.error(f"Error fetching company: {str(e)}")
        return False, "Error verifying access"
    
    # SuperAdmin has access to all companies
    if user.role_id and user.role_id.level == 1:  
        return True, company
    
    # Check company memberships
    for membership in user.company_memberships:
        if str(membership.company_id.id) == company_id:
            return True, company
    
    return False, "Access denied to this company"

def get_user_default_company(user_id):
    """
    Get the default company for a user.
    
    For SuperAdmin: Returns first available company
    For other users: Returns first company in their memberships
    
    Args:
        user_id: The user's ID
    
    Returns:
        Company or None
    """
    from src.models import User, Company
    from flask import current_app
    
    try:
        user = User.objects.get(id=user_id)
        
        # SuperAdmin gets first available company
        if user.role_id and user.role_id.level == 1:
            company = Company.objects(is_active=True).first() 
            return company
        
        # Regular users get their first membership company
        if user.company_memberships and len(user.company_memberships) > 0:
            return user.company_memberships[0].company_id
        
        return None
    except User.DoesNotExist:
        current_app.logger.warning(f"User not found when getting default company: {user_id}")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting default company: {str(e)}")
        return None

def get_user_role_level(user_id):
    """
    Get the role level for a user.
    
    Args:
        user_id: The user's ID
    
    Returns:
        int: Role level (1=SuperAdmin, 2=CompanyAdmin, 3=User)
    """
    from src.models import User
    from flask import current_app
    
    try:
        user = User.objects.get(id=user_id)
        if user.role_id:
            return user.role_id.level
        return 3  # Default to User level
    except User.DoesNotExist:
        current_app.logger.warning(f"User not found when getting role level: {user_id}")
        return 3
    except Exception as e:
        current_app.logger.error(f"Error getting user role level: {str(e)}")
        return 3

def get_user_companies(user_id):
    """
    Get all companies a user has access to.
    
    Args:
        user_id: The user's ID
    
    Returns:
        QuerySet: Companies the user can access
    """
    from src.models import User, Company
    from flask import current_app
    
    try:
        user = User.objects.get(id=user_id)
        
        # SuperAdmin sees all companies
        if user.role_id and user.role_id.level == 1:
            return Company.objects(is_active=True).all()
        
        # Regular users see only their membership companies
        company_ids = [membership.company_id.id for membership in user.company_memberships]
        return Company.objects(id__in=company_ids, is_active=True).all()
    except User.DoesNotExist:
        current_app.logger.warning(f"User not found when getting companies: {user_id}")
        return []
    except Exception as e:
        current_app.logger.error(f"Error getting user companies: {str(e)}")
        return []

def get_user_role_in_company(user_id, company_id):
    """
    Get the user's role within a specific company.
    
    Args:
        user_id: The user's ID
        company_id: The company's ID
    
    Returns:
        str or None: 'admin', 'user', or None if no access
    """
    from src.models import User
    from flask import current_app
    
    try:
        user = User.objects.get(id=user_id)
        
        # SuperAdmin is always admin
        if user.role_id and user.role_id.level == 1:
            return 'admin'
        
        # Check company memberships
        for membership in user.company_memberships:
            if str(membership.company_id.id) == company_id:
                return membership.role
        
        return None  
    except User.DoesNotExist:
        current_app.logger.warning(f"User not found when getting company role: {user_id}")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting user role in company: {str(e)}")
        return None

def can_manage_users(user_id, company_id):
    role_level = get_user_role_level(user_id)
    company_role = get_user_role_in_company(user_id, company_id)
    
    if role_level == 1:
        return True
    
    if role_level == 2 and company_role == 'admin':
        return True
    
    return False

def can_manage_companies(user_id):
    role_level = get_user_role_level(user_id)
    return role_level == 1  

def get_company_users(company_id, requesting_user_id):
    """
    Get all users in a company.
    
    Args:
        company_id: The company's ID
        requesting_user_id: The user making the request (for permission check)
    
    Returns:
        QuerySet: Users in the company
    """
    from src.models import User, Company
    from flask import current_app
    
    if not can_manage_users(requesting_user_id, company_id):
        return []
    
    try:
        users = User.objects(company_memberships__company_id=company_id, is_active=True).all()
        return users
    except Exception as e:
        current_app.logger.error(f"Error getting company users: {str(e)}")
        return []

def calculate_burn_rate(user_id, company_id=None, months=3):
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    now = datetime.utcnow()
    start_date = now - timedelta(days=months*30)
    
    query = Transaction.objects(date__gte=start_date)
    if company_id:
        query = query.filter(company_id=company_id)
    
    transactions = query.all()
    
    monthly_net = {}
    for t in transactions:
        month_key = t.date.strftime('%Y-%m')
        if month_key not in monthly_net:
            monthly_net[month_key] = 0
        if t.type == 'inflow':
            monthly_net[month_key] += t.amount
        else:
            monthly_net[month_key] -= t.amount
    
    if not monthly_net:
        return 0.0
    avg_net = sum(monthly_net.values()) / len(monthly_net)
    return abs(min(avg_net, 0))  

def calculate_runway(user_id, company_id=None, current_balance=None):

    burn_rate = calculate_burn_rate(user_id, company_id)
    if burn_rate <= 0:
        return float('inf')  
    
    if current_balance is None:
        query = Transaction.objects()
        if company_id:
            query = query.filter(company_id=company_id)
        transactions = query.all()
        current_balance = sum(t.amount if t.type == 'inflow' else -t.amount for t in transactions)
    
    return current_balance / burn_rate