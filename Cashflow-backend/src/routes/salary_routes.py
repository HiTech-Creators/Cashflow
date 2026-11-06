"""
Salary/Expense Routes for Flowback Cashflow API.

This module provides API endpoints for:
- Employee management
- Salary payments processing
- Expense accounts (chart of accounts)
"""

from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from src.models import (
    Employee, SalaryPayment, ExpenseAccount, Transaction, 
    Company, User, utc_now
)
from src.utils import verify_company_access


salary_bp = Blueprint('salary', __name__)


# =============================================================================
# Employee Endpoints
# =============================================================================

@salary_bp.route('/companies/<company_id>/employees', methods=['GET'])
def list_employees(company_id):
    """List all employees for a company."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Parse query params
    status = request.args.get('status', 'active')
    department = request.args.get('department')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    query = Employee.objects(company_id=company_id)
    
    if status:
        query = query.filter(status=status)
    if department:
        query = query.filter(department=department)
    
    query = query.order_by('last_name', 'first_name')
    total = query.count()
    employees = query.skip((page - 1) * per_page).limit(per_page)
    
    employees_data = [{
        "id": str(e.id),
        "employee_id": e.employee_id,
        "first_name": e.first_name,
        "last_name": e.last_name,
        "full_name": e.full_name,
        "email": e.email,
        "position": e.position,
        "department": e.department,
        "salary_amount": e.salary_amount,
        "salary_frequency": e.salary_frequency,
        "status": e.status,
        "hire_date": e.hire_date.isoformat() if e.hire_date else None
    } for e in employees]
    
    return jsonify({
        "employees": employees_data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "company_id": company_id
    })


@salary_bp.route('/companies/<company_id>/employees', methods=['POST'])
def create_employee(company_id):
    """
    Create a new employee record.
    
    Expected JSON body:
    {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "employee_id": "EMP001",
        "position": "Software Engineer",
        "department": "Engineering",
        "salary_amount": 75000.00,
        "salary_frequency": "annual",
        "hire_date": "2026-01-15"
    }
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    # Validate required fields
    required = ['first_name', 'last_name', 'email', 'salary_amount']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    
    # Validate salary_frequency
    frequency = data.get('salary_frequency', 'monthly')
    if frequency not in ['hourly', 'weekly', 'biweekly', 'monthly', 'annual']:
        return jsonify({"error": "Invalid salary_frequency"}), 400
    
    try:
        company = Company.objects.get(id=company_id)
        creator = User.objects.get(id=current_user_id)
        
        # Check for duplicate email within company
        if Employee.objects(company_id=company_id, email=data['email']).first():
            return jsonify({"error": "Employee with this email already exists"}), 400
        
        # Check for duplicate employee_id within company
        if data.get('employee_id'):
            if Employee.objects(company_id=company_id, employee_id=data['employee_id']).first():
                return jsonify({"error": "Employee ID already exists"}), 400
        
        employee = Employee(
            company_id=company,
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            employee_id=data.get('employee_id'),
            position=data.get('position'),
            department=data.get('department'),
            salary_amount=float(data['salary_amount']),
            salary_frequency=frequency,
            bank_account_name=data.get('bank_account_name'),
            bank_account_number=data.get('bank_account_number'),
            tax_id=data.get('tax_id'),
            status='active',
            created_by=creator
        )
        
        if data.get('hire_date'):
            employee.hire_date = datetime.fromisoformat(
                data['hire_date'].replace('Z', '+00:00')
            )
        
        employee.save()
        
        return jsonify({
            "message": "Employee created successfully",
            "employee": {
                "id": str(employee.id),
                "employee_id": employee.employee_id,
                "full_name": employee.full_name,
                "email": employee.email,
                "position": employee.position,
                "department": employee.department,
                "salary_amount": employee.salary_amount,
                "salary_frequency": employee.salary_frequency
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Error creating employee: {str(e)}")
        return jsonify({"error": f"Failed to create employee: {str(e)}"}), 400


@salary_bp.route('/companies/<company_id>/employees/<employee_id>', methods=['GET'])
def get_employee(company_id, employee_id):
    """Get employee details."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        employee = Employee.objects.get(id=employee_id, company_id=company_id)
    except Employee.DoesNotExist:
        return jsonify({"error": "Employee not found"}), 404
    
    # Get recent salary payments
    recent_payments = SalaryPayment.objects(
        company_id=company_id,
        employee=employee_id
    ).order_by('-payment_date').limit(5)
    
    payments_data = [{
        "id": str(p.id),
        "pay_period": f"{p.pay_period_start.strftime('%Y-%m-%d')} to {p.pay_period_end.strftime('%Y-%m-%d')}",
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "gross_amount": p.gross_amount,
        "net_amount": p.net_amount,
        "status": p.status
    } for p in recent_payments]
    
    return jsonify({
        "id": str(employee.id),
        "employee_id": employee.employee_id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "full_name": employee.full_name,
        "email": employee.email,
        "position": employee.position,
        "department": employee.department,
        "salary_amount": employee.salary_amount,
        "salary_frequency": employee.salary_frequency,
        "bank_account_name": employee.bank_account_name,
        "bank_account_number": employee.bank_account_number[-4:] + '****' if employee.bank_account_number else None,
        "tax_id": employee.tax_id[-4:] + '****' if employee.tax_id else None,
        "status": employee.status,
        "hire_date": employee.hire_date.isoformat() if employee.hire_date else None,
        "termination_date": employee.termination_date.isoformat() if employee.termination_date else None,
        "recent_payments": payments_data,
        "created_at": employee.created_at.isoformat() if employee.created_at else None
    })


@salary_bp.route('/companies/<company_id>/employees/<employee_id>', methods=['PUT'])
def update_employee(company_id, employee_id):
    """Update employee record."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    try:
        employee = Employee.objects.get(id=employee_id, company_id=company_id)
    except Employee.DoesNotExist:
        return jsonify({"error": "Employee not found"}), 404
    
    # Update fields
    if 'first_name' in data:
        employee.first_name = data['first_name']
    if 'last_name' in data:
        employee.last_name = data['last_name']
    if 'email' in data:
        # Check for duplicate
        existing = Employee.objects(
            company_id=company_id, 
            email=data['email'],
            id__ne=employee_id
        ).first()
        if existing:
            return jsonify({"error": "Email already in use"}), 400
        employee.email = data['email']
    if 'employee_id' in data:
        employee.employee_id = data['employee_id']
    if 'position' in data:
        employee.position = data['position']
    if 'department' in data:
        employee.department = data['department']
    if 'salary_amount' in data:
        employee.salary_amount = float(data['salary_amount'])
    if 'salary_frequency' in data:
        if data['salary_frequency'] not in ['hourly', 'weekly', 'biweekly', 'monthly', 'annual']:
            return jsonify({"error": "Invalid salary_frequency"}), 400
        employee.salary_frequency = data['salary_frequency']
    if 'bank_account_name' in data:
        employee.bank_account_name = data['bank_account_name']
    if 'bank_account_number' in data:
        employee.bank_account_number = data['bank_account_number']
    if 'tax_id' in data:
        employee.tax_id = data['tax_id']
    if 'status' in data:
        if data['status'] not in ['active', 'inactive']:
            return jsonify({"error": "Invalid status"}), 400
        employee.status = data['status']
        if data['status'] == 'inactive' and not employee.termination_date:
            employee.termination_date = utc_now()
    if 'hire_date' in data:
        employee.hire_date = datetime.fromisoformat(data['hire_date'].replace('Z', '+00:00'))
    if 'termination_date' in data:
        employee.termination_date = datetime.fromisoformat(data['termination_date'].replace('Z', '+00:00'))
    
    employee.save()
    
    return jsonify({
        "message": "Employee updated successfully",
        "employee": {
            "id": str(employee.id),
            "full_name": employee.full_name,
            "email": employee.email,
            "status": employee.status
        }
    })


@salary_bp.route('/companies/<company_id>/employees/<employee_id>', methods=['DELETE'])
def delete_employee(company_id, employee_id):
    """Delete (deactivate) an employee."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        employee = Employee.objects.get(id=employee_id, company_id=company_id)
    except Employee.DoesNotExist:
        return jsonify({"error": "Employee not found"}), 404
    
    # Soft delete - set to inactive
    employee.status = 'inactive'
    employee.termination_date = utc_now()
    employee.save()
    
    return jsonify({"message": "Employee deactivated successfully"})


# =============================================================================
# Salary Payment Endpoints
# =============================================================================

@salary_bp.route('/companies/<company_id>/salary-payments', methods=['GET'])
def list_salary_payments(company_id):
    """List salary payments with filters."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Parse query params
    employee_id = request.args.get('employee_id')
    status = request.args.get('status')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    query = SalaryPayment.objects(company_id=company_id)
    
    if employee_id:
        query = query.filter(employee=employee_id)
    if status:
        query = query.filter(status=status)
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(payment_date__gte=start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(payment_date__lte=end_dt)
        except ValueError:
            pass
    
    query = query.order_by('-payment_date')
    total = query.count()
    payments = query.skip((page - 1) * per_page).limit(per_page)
    
    payments_data = [{
        "id": str(p.id),
        "employee": {
            "id": str(p.employee.id),
            "full_name": p.employee.full_name
        },
        "pay_period_start": p.pay_period_start.isoformat() if p.pay_period_start else None,
        "pay_period_end": p.pay_period_end.isoformat() if p.pay_period_end else None,
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "gross_amount": p.gross_amount,
        "tax_amount": p.tax_amount,
        "other_deductions": p.other_deductions,
        "net_amount": p.net_amount,
        "status": p.status
    } for p in payments]
    
    # Calculate totals
    total_gross = sum(p.gross_amount for p in SalaryPayment.objects(company_id=company_id, status='paid'))
    total_net = sum(p.net_amount for p in SalaryPayment.objects(company_id=company_id, status='paid'))
    
    return jsonify({
        "payments": payments_data,
        "total": total,
        "summary": {
            "total_gross_paid": total_gross,
            "total_net_paid": total_net
        },
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "company_id": company_id
    })


@salary_bp.route('/companies/<company_id>/salary-payments', methods=['POST'])
def create_salary_payment(company_id):
    """
    Create a salary payment record.
    
    Expected JSON body:
    {
        "employee_id": "<employee_id>",
        "pay_period_start": "2026-01-01",
        "pay_period_end": "2026-01-15",
        "payment_date": "2026-01-20",
        "gross_amount": 3000.00,
        "tax_amount": 600.00,
        "other_deductions": 150.00,
        "deduction_details": [
            {"name": "Health Insurance", "amount": 100.00},
            {"name": "401k", "amount": 50.00}
        ],
        "notes": "Regular bi-weekly payment",
        "create_transaction": true
    }
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    # Validate required fields
    required = ['employee_id', 'pay_period_start', 'pay_period_end', 'payment_date', 'gross_amount']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    
    try:
        company = Company.objects.get(id=company_id)
        employee = Employee.objects.get(id=data['employee_id'], company_id=company_id)
        creator = User.objects.get(id=current_user_id)
        
        # Verify employee is active
        if employee.status != 'active':
            return jsonify({"error": "Cannot create payment for inactive employee"}), 400
        
        # Parse dates
        pay_period_start = datetime.fromisoformat(data['pay_period_start'].replace('Z', '+00:00'))
        pay_period_end = datetime.fromisoformat(data['pay_period_end'].replace('Z', '+00:00'))
        payment_date = datetime.fromisoformat(data['payment_date'].replace('Z', '+00:00'))
        
        # Calculate amounts
        gross_amount = float(data['gross_amount'])
        tax_amount = float(data.get('tax_amount', 0))
        other_deductions = float(data.get('other_deductions', 0))
        
        # Calculate net amount if not provided
        net_amount = data.get('net_amount')
        if net_amount is None:
            net_amount = gross_amount - tax_amount - other_deductions
        else:
            net_amount = float(net_amount)
        
        payment = SalaryPayment(
            company_id=company,
            employee=employee,
            pay_period_start=pay_period_start,
            pay_period_end=pay_period_end,
            payment_date=payment_date,
            gross_amount=gross_amount,
            tax_amount=tax_amount,
            other_deductions=other_deductions,
            net_amount=net_amount,
            deduction_details=data.get('deduction_details', []),
            status='pending',
            notes=data.get('notes'),
            created_by=creator
        )
        
        # Optionally create transaction and mark as paid
        if data.get('create_transaction', False):
            transaction = Transaction(
                user_id=creator,
                company_id=company,
                date=payment_date,
                description=f"Salary: {employee.full_name} ({pay_period_start.strftime('%m/%d')}-{pay_period_end.strftime('%m/%d/%Y')})",
                amount=net_amount,
                type='outflow',
                category='expenses',
                currency=company.currency or 'USD'
            ).save()
            payment.transaction = transaction
            payment.status = 'paid'
            payment.paid_at = utc_now()
        
        payment.save()
        
        return jsonify({
            "message": "Salary payment created successfully",
            "payment": {
                "id": str(payment.id),
                "employee": employee.full_name,
                "pay_period": f"{pay_period_start.strftime('%Y-%m-%d')} to {pay_period_end.strftime('%Y-%m-%d')}",
                "gross_amount": payment.gross_amount,
                "net_amount": payment.net_amount,
                "status": payment.status,
                "transaction_id": str(payment.transaction.id) if payment.transaction else None
            }
        }), 201
        
    except Employee.DoesNotExist:
        return jsonify({"error": "Employee not found"}), 404
    except Exception as e:
        current_app.logger.error(f"Error creating salary payment: {str(e)}")
        return jsonify({"error": f"Failed to create salary payment: {str(e)}"}), 400


@salary_bp.route('/companies/<company_id>/salary-payments/<payment_id>', methods=['GET'])
def get_salary_payment(company_id, payment_id):
    """Get salary payment details."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        payment = SalaryPayment.objects.get(id=payment_id, company_id=company_id)
    except SalaryPayment.DoesNotExist:
        return jsonify({"error": "Salary payment not found"}), 404
    
    return jsonify({
        "id": str(payment.id),
        "employee": {
            "id": str(payment.employee.id),
            "full_name": payment.employee.full_name,
            "email": payment.employee.email
        },
        "pay_period_start": payment.pay_period_start.isoformat(),
        "pay_period_end": payment.pay_period_end.isoformat(),
        "payment_date": payment.payment_date.isoformat(),
        "gross_amount": payment.gross_amount,
        "tax_amount": payment.tax_amount,
        "other_deductions": payment.other_deductions,
        "net_amount": payment.net_amount,
        "deduction_details": payment.deduction_details,
        "status": payment.status,
        "transaction_id": str(payment.transaction.id) if payment.transaction else None,
        "notes": payment.notes,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        "created_at": payment.created_at.isoformat() if payment.created_at else None
    })


@salary_bp.route('/companies/<company_id>/salary-payments/<payment_id>/process', methods=['POST'])
def process_salary_payment(company_id, payment_id):
    """
    Process a pending salary payment (mark as paid and create transaction).
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        payment = SalaryPayment.objects.get(id=payment_id, company_id=company_id)
        company = Company.objects.get(id=company_id)
        creator = User.objects.get(id=current_user_id)
    except SalaryPayment.DoesNotExist:
        return jsonify({"error": "Salary payment not found"}), 404
    
    if payment.status == 'paid':
        return jsonify({"error": "Payment already processed"}), 400
    
    if payment.status == 'cancelled':
        return jsonify({"error": "Cannot process cancelled payment"}), 400
    
    # Create transaction
    transaction = Transaction(
        user_id=creator,
        company_id=company,
        date=payment.payment_date,
        description=f"Salary: {payment.employee.full_name} ({payment.pay_period_start.strftime('%m/%d')}-{payment.pay_period_end.strftime('%m/%d/%Y')})",
        amount=payment.net_amount,
        type='outflow',
        category='expenses',
        currency=company.currency or 'USD'
    ).save()
    
    payment.transaction = transaction
    payment.status = 'paid'
    payment.paid_at = utc_now()
    payment.save()
    
    return jsonify({
        "message": "Payment processed successfully",
        "payment": {
            "id": str(payment.id),
            "status": payment.status,
            "transaction_id": str(transaction.id)
        }
    })


@salary_bp.route('/companies/<company_id>/salary-payments/<payment_id>/cancel', methods=['POST'])
def cancel_salary_payment(company_id, payment_id):
    """Cancel a pending salary payment."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        payment = SalaryPayment.objects.get(id=payment_id, company_id=company_id)
    except SalaryPayment.DoesNotExist:
        return jsonify({"error": "Salary payment not found"}), 404
    
    if payment.status == 'paid':
        return jsonify({"error": "Cannot cancel paid payment"}), 400
    
    payment.status = 'cancelled'
    payment.save()
    
    return jsonify({
        "message": "Payment cancelled successfully",
        "payment_id": str(payment.id)
    })


# =============================================================================
# Expense Account Endpoints
# =============================================================================

@salary_bp.route('/companies/<company_id>/expense-accounts', methods=['GET'])
def list_expense_accounts(company_id):
    """List all expense accounts (chart of accounts)."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Parse query params
    account_type = request.args.get('type')
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    query = ExpenseAccount.objects(company_id=company_id)
    
    if active_only:
        query = query.filter(is_active=True)
    if account_type:
        query = query.filter(account_type=account_type)
    
    accounts = query.order_by('account_code')
    
    accounts_data = [{
        "id": str(acc.id),
        "account_code": acc.account_code,
        "account_name": acc.account_name,
        "description": acc.description,
        "account_type": acc.account_type,
        "parent_account_id": str(acc.parent_account.id) if acc.parent_account else None,
        "is_active": acc.is_active
    } for acc in accounts]
    
    return jsonify({
        "expense_accounts": accounts_data,
        "total": len(accounts_data),
        "company_id": company_id
    })


@salary_bp.route('/companies/<company_id>/expense-accounts', methods=['POST'])
def create_expense_account(company_id):
    """
    Create a new expense account.
    
    Expected JSON body:
    {
        "account_code": "5100",
        "account_name": "Salaries Expense",
        "description": "Employee salary payments",
        "account_type": "salary",
        "parent_account_id": "<optional_parent_id>"
    }
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    # Validate required fields
    if not data.get('account_code'):
        return jsonify({"error": "account_code is required"}), 400
    if not data.get('account_name'):
        return jsonify({"error": "account_name is required"}), 400
    
    # Validate account_type
    account_type = data.get('account_type', 'other')
    valid_types = ['salary', 'rent', 'utilities', 'supplies', 'travel', 'marketing', 'insurance', 'other']
    if account_type not in valid_types:
        return jsonify({"error": f"Invalid account_type. Must be one of: {', '.join(valid_types)}"}), 400
    
    try:
        company = Company.objects.get(id=company_id)
        creator = User.objects.get(id=current_user_id)
        
        # Check for duplicate account_code
        if ExpenseAccount.objects(company_id=company_id, account_code=data['account_code']).first():
            return jsonify({"error": "Account code already exists"}), 400
        
        account = ExpenseAccount(
            company_id=company,
            account_code=data['account_code'],
            account_name=data['account_name'],
            description=data.get('description'),
            account_type=account_type,
            is_active=True,
            created_by=creator
        )
        
        # Set parent account if provided
        if data.get('parent_account_id'):
            parent = ExpenseAccount.objects.get(
                id=data['parent_account_id'], 
                company_id=company_id
            )
            account.parent_account = parent
        
        account.save()
        
        return jsonify({
            "message": "Expense account created successfully",
            "account": {
                "id": str(account.id),
                "account_code": account.account_code,
                "account_name": account.account_name,
                "account_type": account.account_type
            }
        }), 201
        
    except ExpenseAccount.DoesNotExist:
        return jsonify({"error": "Parent account not found"}), 404
    except Exception as e:
        current_app.logger.error(f"Error creating expense account: {str(e)}")
        return jsonify({"error": f"Failed to create expense account: {str(e)}"}), 400


@salary_bp.route('/companies/<company_id>/expense-accounts/<account_id>', methods=['PUT'])
def update_expense_account(company_id, account_id):
    """Update an expense account."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    try:
        account = ExpenseAccount.objects.get(id=account_id, company_id=company_id)
    except ExpenseAccount.DoesNotExist:
        return jsonify({"error": "Expense account not found"}), 404
    
    # Update fields
    if 'account_code' in data:
        # Check for duplicate
        existing = ExpenseAccount.objects(
            company_id=company_id,
            account_code=data['account_code'],
            id__ne=account_id
        ).first()
        if existing:
            return jsonify({"error": "Account code already exists"}), 400
        account.account_code = data['account_code']
    if 'account_name' in data:
        account.account_name = data['account_name']
    if 'description' in data:
        account.description = data['description']
    if 'account_type' in data:
        valid_types = ['salary', 'rent', 'utilities', 'supplies', 'travel', 'marketing', 'insurance', 'other']
        if data['account_type'] not in valid_types:
            return jsonify({"error": f"Invalid account_type"}), 400
        account.account_type = data['account_type']
    if 'is_active' in data:
        account.is_active = data['is_active']
    if 'parent_account_id' in data:
        if data['parent_account_id']:
            try:
                parent = ExpenseAccount.objects.get(
                    id=data['parent_account_id'],
                    company_id=company_id
                )
                account.parent_account = parent
            except ExpenseAccount.DoesNotExist:
                return jsonify({"error": "Parent account not found"}), 404
        else:
            account.parent_account = None
    
    account.save()
    
    return jsonify({
        "message": "Expense account updated successfully",
        "account": {
            "id": str(account.id),
            "account_code": account.account_code,
            "account_name": account.account_name,
            "is_active": account.is_active
        }
    })


@salary_bp.route('/companies/<company_id>/expense-accounts/<account_id>', methods=['DELETE'])
def delete_expense_account(company_id, account_id):
    """Delete (deactivate) an expense account."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        account = ExpenseAccount.objects.get(id=account_id, company_id=company_id)
    except ExpenseAccount.DoesNotExist:
        return jsonify({"error": "Expense account not found"}), 404
    
    # Check for child accounts
    child_accounts = ExpenseAccount.objects(parent_account=account_id).count()
    if child_accounts > 0:
        return jsonify({"error": "Cannot delete account with child accounts"}), 400
    
    # Soft delete
    account.is_active = False
    account.save()
    
    return jsonify({"message": "Expense account deactivated successfully"})
