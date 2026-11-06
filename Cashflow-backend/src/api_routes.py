from flask import Blueprint, request, jsonify, current_app, send_file, g, session
from src.auth import register_user_by_invitation, login_user, create_superadmin
from src.models import User, Transaction, InitialBalance, UserPreferences
from src.permissions import role_required
from src.transactions import create_transaction, get_transactions
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from src.forecasting import generate_forecast, ai_forecast, save_forecast
from src.models import Forecast
from src.dashboard import get_kpis
from src.working_capital import get_aging_report
from src.models import Receivable, Payable, Inventory, Budget
from src.budgeting import create_budget, get_budgets, calculate_variance
from src.company import create_company as create_company_func, get_user_companies, get_company, update_company, delete_company
from datetime import datetime, timezone, timedelta
from src.utils import calculate_totals, calculate_burn_rate, calculate_runway
from werkzeug.security import generate_password_hash, check_password_hash
import json
import pandas as pd
from io import BytesIO
import os

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    try:
        user, company = register_user_by_invitation(
            data['username'], 
            data['password'], 
            data['invitation_token']
        )
        return jsonify({
            "message": "User registered successfully",
            "user_id": str(user.id),
            "company_id": str(company.id),
            "role": user.role_id.name
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@auth_bp.route('/create-superadmin', methods=['POST'])
def create_superadmin_route():
    data = request.json
    try:
        user = create_superadmin(
            data['username'],
            data['email'], 
            data['password']
        )
        return jsonify({
            "msg": "SuperAdmin created successfully",
            "user_id": str(user.id),
            "role": "SuperAdmin"
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    try:
        token, default_company_id = login_user(data['username'], data['password'])
        return jsonify({
            "access_token": token,
            "default_company_id": default_company_id
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

@auth_bp.route('/protected', methods=['GET'])
@role_required('CEO', 'Admin')
def protected():
    return jsonify({"message": "This is a protected route"})

transactions_bp = Blueprint('transactions', __name__)

@transactions_bp.route('/transactions', methods=['POST'])
def add_transaction():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        return jsonify({"error": "company_id is required"}), 400
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        transaction = create_transaction(
            user_id=current_user_id,
            company_id=company_id,
            date=datetime.strptime(data['date'], '%Y-%m-%d'),
            description=data['description'],
            amount=data['amount'],
            transaction_type=data['type'],
            category=data['category'],
            currency=data.get('currency', 'USD')
        )
        return jsonify({
            "message": "Transaction added", 
            "transaction": {
                "id": str(transaction.id),
                "date": transaction.date.isoformat() if transaction.date else None,
                "description": transaction.description,
                "amount": transaction.amount,
                "type": transaction.type,
                "category": transaction.category,
                "currency": transaction.currency
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@transactions_bp.route('/transactions', methods=['GET'])
def list_transactions():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    
    query = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('-date')
    total = query.count()
    paginated_items = query.skip((page-1)*per_page).limit(per_page)
    pages = (total + per_page - 1) // per_page
    
    return jsonify({
        "transactions": [t.to_json() for t in paginated_items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "company_id": company_id
    })

@transactions_bp.route('/transactions/<transaction_id>', methods=['GET', 'PUT', 'PATCH'])
@transactions_bp.route('/edit/<transaction_id>', methods=['GET', 'POST'])  # Deprecated: use GET/PUT /transactions/<id>
def edit_transaction(transaction_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        from mongoengine import ValidationError
        transaction = Transaction.objects(
            id=transaction_id,
            user_id=current_user_id,
            company_id=company_id
        ).first()
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
    except ValidationError:
        return jsonify({'error': 'Invalid transaction ID format'}), 400
    
    if request.method in ['POST', 'PUT', 'PATCH']:
        data = request.json
        
        if data.get('date'):
            date_str = data.get('date')
            try:
                transaction.date = datetime.strptime(date_str, '%Y-%m-%d')
            except ValueError:
                try:
                    transaction.date = datetime.fromisoformat(date_str)
                except ValueError:
                    return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        transaction.description = data.get('description', transaction.description)
        transaction.amount = float(data.get('amount', transaction.amount))
        transaction.type = data.get('type', transaction.type)
        transaction.category = data.get('category', transaction.category)
        transaction.currency = data.get('currency', transaction.currency)
        transaction.save()
        
        return jsonify({
            'message': 'Transaction Updated Successfully',
            'transaction': {
                'id': str(transaction.id),
                'date': transaction.date.isoformat() if hasattr(transaction.date, 'isoformat') else str(transaction.date),
                'description': transaction.description,
                'amount': transaction.amount,
                'type': transaction.type,
                'category': transaction.category,
                'currency': transaction.currency
            }
        })
    
    return jsonify({
        'id': str(transaction.id),
        'date': transaction.date.isoformat() if hasattr(transaction.date, 'isoformat') else str(transaction.date),
        'description': transaction.description,
        'amount': transaction.amount,
        'type': transaction.type,
        'category': transaction.category,
        'currency': transaction.currency,
        'company_id': str(transaction.company_id.id)
    })

@transactions_bp.route('/transactions/<transaction_id>', methods=['DELETE'])
@transactions_bp.route('/delete/<transaction_id>', methods=['POST'])  # Deprecated: use DELETE /transactions/<id>
def delete_transaction(transaction_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id') or request.json.get('company_id') if request.json else None
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        from mongoengine import ValidationError
        transaction = Transaction.objects(
            id=transaction_id,
            user_id=current_user_id,
            company_id=company_id
        ).first()
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
    except ValidationError:
        return jsonify({'error': 'Invalid transaction ID format'}), 400
    
    transaction.delete()
    return jsonify({'message': 'Transaction Deleted Successfully'})

@transactions_bp.route('/save_transactions', methods=['POST'])
def save_transactions():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    
    if not isinstance(data, list):
        return jsonify({'error': 'Request body must be an array of transactions'}), 400
    
    if len(data) == 0:
        return jsonify({'error': 'Request body cannot be empty'}), 400
    
    from src.models import Company
    from src.utils import get_user_default_company, verify_company_access
    from src.validators import (
        validate_positive_number,
        validate_date,
        validate_transaction_type,
        validate_category,
        validate_currency,
        validate_string,
        ValidationError
    )
    from src.constants import HTTP_CREATED, HTTP_MULTI_STATUS
    
    results = {
        'total': len(data),
        'created': [],
        'failed': [],
        'summary': {}
    }
    
    for idx, item in enumerate(data):
        try:
            if not isinstance(item, dict):
                raise ValidationError(f"Item at index {idx} must be an object")
            
            company_id = item.get('company_id')
            if not company_id:
                company = get_user_default_company(current_user_id)
                if not company:
                    raise ValidationError('company_id is required for each transaction')
                company_id = str(company.id)
            
            valid, result = verify_company_access(current_user_id, company_id)
            if not valid:
                raise ValidationError(f'Access denied to company {company_id}')
            
            company = Company.objects.get(id=company_id)
            
            description = validate_string(item.get('description'), 'description', max_length=500)
            amount = validate_positive_number(item.get('amount'), 'amount')
            transaction_type = validate_transaction_type(item.get('type'))
            category = validate_category(item.get('category', 'operating'))
            currency = validate_currency(item.get('currency', 'USD'))
            
            if item.get('date'):
                transaction_date = validate_date(item.get('date'), allow_future=False)
            else:
                transaction_date = datetime.utcnow()
            
            new_transaction = Transaction(
                user_id=current_user_id,
                company_id=company,
                date=transaction_date,
                description=description,
                amount=amount,
                type=transaction_type,
                category=category,
                currency=currency
            ).save()
            
            results['created'].append({
                'index': idx,
                'id': str(new_transaction.id),
                'date': new_transaction.date.isoformat(),
                'description': new_transaction.description,
                'amount': new_transaction.amount,
                'type': new_transaction.type,
                'category': new_transaction.category,
                'currency': new_transaction.currency
            })
            
        except ValidationError as e:
            results['failed'].append({
                'index': idx,
                'data': item,
                'error': e.error,
                'field': e.field,
                'details': e.details
            })
        except Exception as e:
            results['failed'].append({
                'index': idx,
                'data': item,
                'error': str(e)
            })
    
    results['summary'] = {
        'total': results['total'],
        'succeeded': len(results['created']),
        'failed': len(results['failed']),
        'success_rate': f"{(len(results['created']) / results['total'] * 100):.1f}%"
    }
    
    if len(results['failed']) == 0:
        status_code = HTTP_CREATED
        message = f"All {len(results['created'])} transactions saved successfully"
    elif len(results['created']) == 0:
        status_code = 400
        message = "All transactions failed validation"
    else:
        status_code = HTTP_MULTI_STATUS
        message = f"Partial success: {len(results['created'])} succeeded, {len(results['failed'])} failed"
    
    results['message'] = message
    
    return jsonify(results), status_code

@transactions_bp.route('/upload', methods=['GET', 'POST'])
def upload_route():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        try:
            from src.validators import validate_file_upload, ValidationError
            validated_file = validate_file_upload(
                file,
                max_size_mb=10,
                allowed_extensions={'csv', 'xlsx', 'xls'}
            )
        except ValidationError as e:
            return jsonify(e.to_dict()), 400
        
        try:
            from src.upload_handler import process_upload
            company_id = request.form.get('company_id')
            result = process_upload(validated_file, user_id=current_user_id, company_id=company_id)
            if 'error' in result:
                return jsonify(result), 400
            return jsonify(result)
        except Exception as e:
            current_app.logger.error(f"Error processing upload: {str(e)}")
            return jsonify({'error': 'Error processing file', 'details': str(e)}), 500
    
    return jsonify({'message': 'Upload endpoint - POST a file to import transactions'})

@transactions_bp.route('/export/<file_type>')
def export(file_type):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    transactions = Transaction.objects(user_id=current_user_id, company_id=company_id)
    data = [{
        'Date': transaction.date,
        'Description': transaction.description,
        'Amount': transaction.amount,
        'Type': transaction.type
    } for transaction in transactions]

    df = pd.DataFrame(data)

    if file_type == 'csv':
        output = BytesIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return send_file(output, mimetype='text/csv', as_attachment=True, download_name='transactions.csv')
    elif file_type == 'excel':
        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Transactions')
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                         as_attachment=True, download_name='transactions.xlsx')
    else:
        return jsonify({'error': 'Invalid file type requested.'}), 400


@transactions_bp.route('/companies/<company_id>/transactions/export/csv', methods=['GET'])
def export_transactions_csv_v2(company_id):
    """
    Export company transactions to CSV format.
    
    Query params:
    - include_balance: Include running balance column (true/false)
    - start_date: Filter start date (YYYY-MM-DD)
    - end_date: Filter end date (YYYY-MM-DD)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from flask import Response
    from src.services.export_service import get_export_service
    
    # Parse query params
    include_balance = request.args.get('include_balance', 'false').lower() == 'true'
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # Build query
    query = Transaction.objects(user_id=current_user_id, company_id=company_id)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(date__gte=start_dt)
        except ValueError:
            return jsonify({"error": "Invalid start_date format. Use YYYY-MM-DD"}), 400
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            query = query.filter(date__lte=end_dt)
        except ValueError:
            return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD"}), 400
    
    transactions = list(query.order_by('date'))
    
    if not transactions:
        return jsonify({"error": "No transactions found"}), 404
    
    # Get initial balance if needed
    initial_balance = 0.0
    if include_balance:
        initial_balance_record = InitialBalance.objects(
            user_id=current_user_id, company_id=company_id
        ).first()
        initial_balance = initial_balance_record.balance if initial_balance_record else 0.0
    
    export_service = get_export_service()
    csv_data = export_service.export_transactions_csv(
        transactions,
        include_running_balance=include_balance,
        initial_balance=initial_balance
    )
    
    filename = f"transactions_{company_id}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@transactions_bp.route('/companies/<company_id>/transactions/export/pdf', methods=['GET'])
def export_transactions_pdf(company_id):
    """
    Export company transactions to PDF report format.
    
    Query params:
    - start_date: Filter start date (YYYY-MM-DD)
    - end_date: Filter end date (YYYY-MM-DD)
    - title: Custom report title
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from flask import Response
    from src.services.export_service import get_export_service
    from src.models import Company
    
    # Parse query params
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    title = request.args.get('title', 'Transaction Report')
    
    # Build query
    query = Transaction.objects(user_id=current_user_id, company_id=company_id)
    date_range = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(date__gte=start_dt)
        except ValueError:
            return jsonify({"error": "Invalid start_date format. Use YYYY-MM-DD"}), 400
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            query = query.filter(date__lte=end_dt)
        except ValueError:
            return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD"}), 400
    
    if start_date and end_date:
        date_range = (start_dt, end_dt)
    
    transactions = list(query.order_by('-date'))
    
    if not transactions:
        return jsonify({"error": "No transactions found"}), 404
    
    # Get company info
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        company = None
    
    export_service = get_export_service()
    pdf_data = export_service.export_transactions_pdf(
        transactions,
        title=title,
        company=company,
        date_range=date_range
    )
    
    filename = f"transactions_{company_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        pdf_data,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@transactions_bp.route('/companies/<company_id>/transactions/import/csv', methods=['POST'])
def import_transactions_csv(company_id):
    """
    Import transactions from CSV file.
    
    Expects multipart/form-data with 'file' field containing CSV.
    Optional query param 'validate_only=true' to validate without importing.
    
    Required CSV columns: Date, Description, Type, Amount
    Optional CSV columns: Category, Currency
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Check for file
    if 'file' not in request.files:
        return jsonify({"error": "No file provided. Upload a CSV file with 'file' field."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Validate file extension
    if not file.filename.lower().endswith('.csv'):
        return jsonify({"error": "File must be a CSV file"}), 400
    
    # Check validate_only flag
    validate_only = request.args.get('validate_only', 'false').lower() == 'true'
    
    from src.services.export_service import get_export_service
    
    export_service = get_export_service()
    result = export_service.import_transactions_csv(
        csv_file=file,
        company_id=company_id,
        user_id=current_user_id,
        validate_only=validate_only
    )
    
    if result['success']:
        if validate_only:
            return jsonify({
                "message": f"Validation successful. {result['validated_count']} transactions ready to import.",
                "validated_count": result['validated_count'],
                "errors": result['errors']
            }), 200
        else:
            return jsonify({
                "message": f"Successfully imported {result['imported_count']} transactions.",
                "imported_count": result['imported_count'],
                "transactions": result['transactions'],
                "errors": result['errors']
            }), 201
    else:
        return jsonify({
            "error": "Import failed",
            "errors": result['errors'],
            "validated_count": result['validated_count']
        }), 400


@transactions_bp.route('/create-transaction', methods=['POST'])
def create_transaction_deprecated():

    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    current_app.logger.warning(f"[{g.request_id if hasattr(g, 'request_id') else 'N/A'}] DEPRECATED endpoint /create-transaction called. Use /api/transactions instead.")
    
    data = request.json
    
    try:
        from src.validators import (
            validate_required_fields,
            validate_positive_number,
            validate_date,
            validate_transaction_type,
            validate_category,
            validate_currency,
            validate_string,
            ValidationError
        )
        
        validate_required_fields(data, ['description', 'amount', 'type'])
        
        description = validate_string(data.get('description'), 'description', max_length=500)
        amount = validate_positive_number(data.get('amount'), 'amount')
        transaction_type = validate_transaction_type(data.get('type'))
        category = validate_category(data.get('category', 'operating'))
        currency = validate_currency(data.get('currency', 'USD'))
        transaction_date = validate_date(data.get('date'), allow_future=False) if data.get('date') else datetime.utcnow()
        
    except ValidationError as e:
        return jsonify(e.to_dict()), 400
    
    try:
        company_id = data.get('company_id')
        if not company_id:
            from src.utils import get_user_default_company
            company = get_user_default_company(current_user_id)
            if not company:
                return jsonify({'error': 'company_id is required'}), 400
            company_id = str(company.id)
        
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({'error': result}), 403
        
        from src.models import Company
        
        company = Company.objects.get(id=company_id)
        
        new_transaction = Transaction(
            user_id=current_user_id,
            company_id=company,
            date=transaction_date,
            description=description,
            amount=amount,
            type=transaction_type,
            category=category,
            currency=currency
        ).save()
        
        response = jsonify({
            'message': 'Transaction added successfully',
            'warning': 'DEPRECATED: This endpoint will be removed. Use POST /api/transactions instead.',
            'transaction': {
                'id': str(new_transaction.id),
                'date': new_transaction.date.isoformat() if hasattr(new_transaction.date, 'isoformat') else str(new_transaction.date),
                'description': new_transaction.description,
                'amount': new_transaction.amount,
                'type': new_transaction.type,
                'category': new_transaction.category,
                'currency': new_transaction.currency
            }
        })
        response.headers['Warning'] = '299 - "DEPRECATED: Use POST /api/transactions instead"'
        response.headers['Sunset'] = 'Sat, 31 Dec 2025 23:59:59 GMT'
        return response
    except Exception as e:
        current_app.logger.error(f"[{g.request_id if hasattr(g, 'request_id') else 'N/A'}] Error adding transaction: {str(e)}")
        return jsonify({'error': 'Error adding transaction'}), 500

forecasts_bp = Blueprint('forecasts', __name__)

@forecasts_bp.route('/forecasts', methods=['POST'])
def create_forecast():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        return jsonify({"error": "company_id is required"}), 400
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    months = data.get('months', 12)
    forecast_type = data.get('type', 'manual')
    scenario_params = data.get('scenario_params', {})
    scenario_name = data.get('scenario_name', 'Default')
    
    historical = [t.to_mongo().to_dict() for t in get_transactions(current_user_id, company_id, page=1, per_page=1000)['items']]
    
    if forecast_type == 'manual':
        projections = generate_forecast(historical, months, scenario_params)
    elif forecast_type == 'ai':
        projections = ai_forecast(historical, months, scenario_params)
    else:
        return jsonify({"error": "Invalid forecast type"}), 400
    
    forecast = save_forecast(current_user_id, company_id, scenario_name, projections)
    return jsonify({
        "message": "Forecast created", 
        "forecast": {
            "id": str(forecast.id),
            "scenario_name": forecast.scenario_name,
            "projections": forecast.projections,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None
        }
    }), 201

@forecasts_bp.route('/forecasts', methods=['GET'])
def list_forecasts():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    forecasts = Forecast.objects(user_id=current_user_id, company_id=company_id)
    return jsonify({"forecasts": [f.to_json() for f in forecasts], "company_id": company_id})

@forecasts_bp.route('/forecast', methods=['GET'])
def forecast_ai():
    from flask import current_app
    
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('date')
        
        if not transactions:
            return jsonify({
                'error': 'No transactions found. Please add some transactions first.'
            }), 400
            
        transaction_data = [{
            'date': t.date.strftime('%Y-%m-%d') if isinstance(t.date, datetime) else t.date,
            'amount': t.amount,
            'type': t.type,
            'description': t.description
        } for t in transactions]
        
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({
                'error': 'API key not found. Please set the ANTHROPIC_API_KEY environment variable.'
            }), 500
            
        from src.anthropic_service import FinancialAnalytics
        analytics = FinancialAnalytics(api_key=api_key)
        
        initial_balance_record = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        initial_balance = initial_balance_record.balance if initial_balance_record else 0.0
        
        # Calculate balance correctly: inflows add, outflows subtract
        current_balance = initial_balance + sum(
            t.amount if t.type == 'inflow' else -t.amount for t in transactions
        )
        
        working_capital = {
            'current_assets': current_balance,
            'current_liabilities': 0,
            'cash': current_balance
        }
        
        analysis_results = analytics.generate_advanced_financial_analysis(
            initial_balance=initial_balance,
            current_balance=current_balance,
            transaction_history=transaction_data,
            working_capital=working_capital
        )
        
        return jsonify({
            'success': True,
            'ai_analysis': analysis_results.get('ai_analysis', 'No insights available'),
            'patterns': analysis_results.get('patterns', {'seasonal_pattern': [0] * 12}),
            'forecasts': analysis_results.get('forecasts', {'90_days': [0] * 90}),
            'risk_metrics': analysis_results.get('risk_metrics', {
                'liquidity_ratio': 0,
                'cash_flow_volatility': 0,
                'burn_rate': 0,
                'runway_months': 0
            })
        })
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


# =============================================================================
# Speech-Based Forecast Endpoints
# =============================================================================

@forecasts_bp.route('/companies/<company_id>/forecasts/speech', methods=['POST'])
def create_forecast_from_speech(company_id):
    """
    Generate forecast from speech input (transcript).
    
    Expects JSON body with:
    - transcript: The speech transcript text (required)
    - context: Optional additional context
    - scenario_name: Optional name for the forecast scenario
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    transcript = data.get('transcript')
    if not transcript:
        return jsonify({"error": "transcript is required"}), 400
    
    try:
        from src.services.speech_service import get_speech_service
        
        # Build context from company data
        context = data.get('context', {})
        
        # Enhance context with actual company metrics if not provided
        if not context.get('current_balance'):
            initial_balance_record = InitialBalance.objects(
                user_id=current_user_id, company_id=company_id
            ).first()
            initial_balance = initial_balance_record.balance if initial_balance_record else 0.0
            
            transactions = Transaction.objects(user_id=current_user_id, company_id=company_id)
            current_balance = initial_balance + sum(
                t.amount if t.type == 'inflow' else -t.amount for t in transactions
            )
            context['current_balance'] = current_balance
            
            # Calculate monthly metrics
            from datetime import timedelta
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            recent_transactions = Transaction.objects(
                user_id=current_user_id,
                company_id=company_id,
                date__gte=thirty_days_ago
            )
            context['monthly_revenue'] = sum(
                t.amount for t in recent_transactions if t.type == 'inflow'
            )
            context['monthly_expenses'] = sum(
                t.amount for t in recent_transactions if t.type == 'outflow'
            )
        
        speech_service = get_speech_service()
        forecast_data = speech_service.process_speech_to_forecast(
            transcript=transcript,
            company_id=company_id,
            context=context
        )
        
        # Save the forecast
        scenario_name = data.get('scenario_name') or forecast_data.get('scenario_name', 'Speech Forecast')
        
        forecast = Forecast(
            user_id=current_user_id,
            company_id=company_id,
            scenario_name=scenario_name,
            projections=forecast_data.get('projections', {}),
        ).save()
        
        return jsonify({
            "message": "Forecast created from speech",
            "forecast": {
                "id": str(forecast.id),
                "scenario_name": forecast.scenario_name,
                "projections": forecast.projections,
                "extracted_data": forecast_data,
                "created_at": forecast.created_at.isoformat() if forecast.created_at else None
            }
        }), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        current_app.logger.error(f"Speech-to-forecast error: {str(e)}")
        return jsonify({"error": f"Failed to process speech: {str(e)}"}), 500


@forecasts_bp.route('/companies/<company_id>/forecasts/<forecast_id>/speech', methods=['GET'])
def get_forecast_speech(company_id, forecast_id):
    """
    Get a speech-friendly summary of a forecast.
    
    Query params:
    - style: conversational (default), formal, or brief
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    forecast = Forecast.objects(id=forecast_id, company_id=company_id).first()
    if not forecast:
        return jsonify({"error": "Forecast not found"}), 404
    
    try:
        from src.services.speech_service import get_speech_service
        
        style = request.args.get('style', 'conversational')
        
        forecast_data = {
            "scenario_name": forecast.scenario_name,
            "projections": forecast.projections,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None
        }
        
        speech_service = get_speech_service()
        speech_text = speech_service.generate_report_speech(
            report_data=forecast_data,
            report_type="forecast",
            style=style
        )
        
        return jsonify({
            "speech_text": speech_text,
            "forecast_id": str(forecast.id),
            "style": style
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Forecast speech generation error: {str(e)}")
        return jsonify({"error": f"Failed to generate speech: {str(e)}"}), 500


dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard', methods=['GET'])
def dashboard():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    kpis = get_kpis(current_user_id, company_id)
    
    # Filter by both company_id and user_id for proper data isolation
    inflows_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow')
    outflows_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='outflow')
    inflows = sum(t.amount for t in inflows_query)
    outflows = sum(t.amount for t in outflows_query)
    
    return jsonify({
        "kpis": kpis,
        "inflows": inflows,
        "outflows": outflows,
        "company_id": company_id
    })


@dashboard_bp.route('/companies/<company_id>/dashboard/speech', methods=['GET'])
def get_dashboard_speech(company_id):
    """
    Get a speech-friendly summary of the dashboard.
    
    Query params:
    - style: conversational (default), formal, or brief
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        from src.services.speech_service import get_speech_service
        
        style = request.args.get('style', 'conversational')
        
        # Gather dashboard data
        kpis = get_kpis(current_user_id, company_id)
        
        inflows_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow')
        outflows_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='outflow')
        inflows = sum(t.amount for t in inflows_query)
        outflows = sum(t.amount for t in outflows_query)
        
        # Get initial balance
        initial_balance_record = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        initial_balance = initial_balance_record.balance if initial_balance_record else 0.0
        current_balance = initial_balance + inflows - outflows
        
        # Calculate burn rate and runway
        from src.utils import calculate_burn_rate, calculate_runway
        burn_rate = calculate_burn_rate(current_user_id, company_id)
        runway = calculate_runway(current_user_id, company_id, current_balance)
        
        dashboard_data = {
            "kpis": kpis,
            "current_balance": current_balance,
            "total_inflows": inflows,
            "total_outflows": outflows,
            "burn_rate": burn_rate,
            "runway_months": runway
        }
        
        speech_service = get_speech_service()
        speech_text = speech_service.generate_dashboard_speech(
            dashboard_data=dashboard_data,
            style=style
        )
        
        return jsonify({
            "speech_text": speech_text,
            "company_id": company_id,
            "style": style
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Dashboard speech generation error: {str(e)}")
        return jsonify({"error": f"Failed to generate speech: {str(e)}"}), 500


working_capital_bp = Blueprint('working_capital', __name__)

@working_capital_bp.route('/receivables', methods=['GET'])
def get_receivables():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    receivables = Receivable.objects(company_id=company_id).all()
    return jsonify({"receivables": [r.to_json() for r in receivables], "company_id": company_id})

@working_capital_bp.route('/payables', methods=['GET'])
def get_payables():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    payables = Payable.objects(company_id=company_id).all()
    return jsonify({"payables": [p.to_json() for p in payables], "company_id": company_id})

@working_capital_bp.route('/inventory', methods=['GET'])
def get_inventory():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    inventory = Inventory.objects(company_id=company_id).all()
    return jsonify({"inventory": [i.to_json() for i in inventory], "company_id": company_id})

@working_capital_bp.route('/aging', methods=['GET'])
def aging_report():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    report_type = request.args.get('type', 'receivables')
    report = get_aging_report(company_id, report_type)
    return jsonify({"report": report, "company_id": company_id, "type": report_type})

@working_capital_bp.route('/receivables', methods=['POST'])
def create_receivable():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    try:
        due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
    except (ValueError, KeyError, AttributeError) as e:
        return jsonify({"error": "Invalid due_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"}), 400
    
    if not data.get('amount') or float(data['amount']) <= 0:
        return jsonify({"error": "Amount must be a positive number"}), 400
    
    receivable = Receivable(
        company_id=company_id,
        created_by=current_user_id,
        amount=float(data['amount']),
        due_date=due_date,
        status=data.get('status', 'pending'),
        description=data.get('description')
    ).save()
    
    return jsonify({
        "message": "Receivable created", 
        "receivable": {
            "id": str(receivable.id),
            "amount": receivable.amount,
            "due_date": receivable.due_date.isoformat(),
            "status": receivable.status,
            "description": receivable.description
        }
    }), 201

@working_capital_bp.route('/receivables/<receivable_id>', methods=['PUT'])
def update_receivable(receivable_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    receivable = Receivable.objects(id=receivable_id, company_id=company_id).first()
    if not receivable:
        return jsonify({"error": "Receivable not found"}), 404
    
    if 'amount' in data:
        if float(data['amount']) <= 0:
            return jsonify({"error": "Amount must be a positive number"}), 400
        receivable.amount = float(data['amount'])
    if 'due_date' in data:
        try:
            receivable.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return jsonify({"error": "Invalid due_date format"}), 400
    if 'status' in data:
        receivable.status = data['status']
    if 'description' in data:
        receivable.description = data['description']
    receivable.save()
    
    return jsonify({
        "message": "Receivable updated", 
        "receivable": {
            "id": str(receivable.id),
            "amount": receivable.amount,
            "due_date": receivable.due_date.isoformat(),
            "status": receivable.status,
            "description": receivable.description
        }
    })

@working_capital_bp.route('/receivables/<receivable_id>', methods=['DELETE'])
def delete_receivable(receivable_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    receivable = Receivable.objects(id=receivable_id, company_id=company_id).first()
    if not receivable:
        return jsonify({"error": "Receivable not found"}), 404
    
    receivable.delete()
    return jsonify({"message": "Receivable deleted"})

@working_capital_bp.route('/payables', methods=['POST'])
def create_payable():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    try:
        due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
    except (ValueError, KeyError, AttributeError) as e:
        return jsonify({"error": "Invalid due_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"}), 400
    
    if not data.get('amount') or float(data['amount']) <= 0:
        return jsonify({"error": "Amount must be a positive number"}), 400
    
    payable = Payable(
        company_id=company_id,
        created_by=current_user_id,
        amount=float(data['amount']),
        due_date=due_date,
        status=data.get('status', 'pending'),
        description=data.get('description')
    ).save()
    
    return jsonify({
        "message": "Payable created", 
        "payable": {
            "id": str(payable.id),
            "amount": payable.amount,
            "due_date": payable.due_date.isoformat(),
            "status": payable.status,
            "description": payable.description
        }
    }), 201

@working_capital_bp.route('/payables/<payable_id>', methods=['PUT'])
def update_payable(payable_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    payable = Payable.objects(id=payable_id, company_id=company_id).first()
    if not payable:
        return jsonify({"error": "Payable not found"}), 404
    
    if 'amount' in data:
        if float(data['amount']) <= 0:
            return jsonify({"error": "Amount must be a positive number"}), 400
        payable.amount = float(data['amount'])
    if 'due_date' in data:
        try:
            payable.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return jsonify({"error": "Invalid due_date format"}), 400
    if 'status' in data:
        payable.status = data['status']
    if 'description' in data:
        payable.description = data['description']
    payable.save()
    
    return jsonify({
        "message": "Payable updated", 
        "payable": {
            "id": str(payable.id),
            "amount": payable.amount,
            "due_date": payable.due_date.isoformat(),
            "status": payable.status,
            "description": payable.description
        }
    })

@working_capital_bp.route('/payables/<payable_id>', methods=['DELETE'])
def delete_payable(payable_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    payable = Payable.objects(id=payable_id, company_id=company_id).first()
    if not payable:
        return jsonify({"error": "Payable not found"}), 404
    
    payable.delete()
    return jsonify({"message": "Payable deleted"})

@working_capital_bp.route('/inventory', methods=['POST'])
def create_inventory():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    if not data.get('item_name'):
        return jsonify({"error": "item_name is required"}), 400
    
    try:
        quantity = int(data.get('quantity', 0))
        if quantity < 0:
            return jsonify({"error": "Quantity cannot be negative"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Quantity must be an integer"}), 400
    
    try:
        value = float(data.get('value', 0))
        if value < 0:
            return jsonify({"error": "Value cannot be negative"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Value must be a number"}), 400
    
    inventory = Inventory(
        company_id=company_id,
        created_by=current_user_id,
        item_name=data['item_name'],
        quantity=quantity,
        value=value
    ).save()
    
    return jsonify({
        "message": "Inventory created", 
        "inventory": {
            "id": str(inventory.id),
            "item_name": inventory.item_name,
            "quantity": inventory.quantity,
            "value": inventory.value,
            "last_updated": inventory.last_updated.isoformat() if inventory.last_updated else None
        }
    }), 201

@working_capital_bp.route('/inventory/<inventory_id>', methods=['PUT'])
def update_inventory(inventory_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    inventory = Inventory.objects(id=inventory_id, company_id=company_id).first()
    if not inventory:
        return jsonify({"error": "Inventory not found"}), 404
    
    if 'item_name' in data:
        inventory.item_name = data['item_name']
    if 'quantity' in data:
        inventory.quantity = data['quantity']
    if 'value' in data:
        inventory.value = data['value']
    inventory.last_updated = datetime.utcnow()
    inventory.save()
    
    return jsonify({"message": "Inventory updated", "inventory": inventory.to_json()})

@working_capital_bp.route('/inventory/<inventory_id>', methods=['DELETE'])
def delete_inventory(inventory_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    inventory = Inventory.objects(id=inventory_id, company_id=company_id).first()
    if not inventory:
        return jsonify({"error": "Inventory not found"}), 404
    
    inventory.delete()
    return jsonify({"message": "Inventory deleted"})

budgets_bp = Blueprint('budgets', __name__)

@budgets_bp.route('/budgets', methods=['POST'])
def add_budget():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        return jsonify({"error": "company_id is required"}), 400
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    budget = create_budget(company_id, data['category'], data['amount'], data['period'], current_user_id)
    budget_data = {
        "id": str(budget.id),
        "company_id": str(budget.company_id.id),
        "created_by": str(budget.created_by.id),
        "category": budget.category,
        "amount": budget.amount,
        "period": budget.period
    }
    return jsonify({"message": "Budget added", "budget": budget_data}), 201

@budgets_bp.route('/budgets', methods=['GET'])
def list_budgets():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    period = request.args.get('period')
    budgets = get_budgets(company_id, period)
    budgets_data = [{
        "id": str(b.id),
        "company_id": str(b.company_id.id),
        "created_by": str(b.created_by.id),
        "category": b.category,
        "amount": b.amount,
        "period": b.period
    } for b in budgets]
    return jsonify({"budgets": budgets_data, "company_id": company_id})

@budgets_bp.route('/variances', methods=['GET'])
def get_variances():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    period = request.args.get('period')
    if not period:
        return jsonify({"error": "Period required"}), 400
    
    variance = calculate_variance(company_id, period)
    return jsonify({"variance": variance, "company_id": company_id, "period": period})

@budgets_bp.route('/budgets/<budget_id>', methods=['PUT'])
def update_budget(budget_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    company_id = data.get('company_id')
    
    if not company_id:
        return jsonify({"error": "company_id is required"}), 400
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    budget = Budget.objects(id=budget_id, company_id=company_id).first()
    if not budget:
        return jsonify({"error": "Budget not found"}), 404
    
    if 'category' in data:
        budget.category = data['category']
    if 'amount' in data:
        budget.amount = data['amount']
    if 'period' in data:
        budget.period = data['period']
    budget.save()
    
    budget_data = {
        "id": str(budget.id),
        "company_id": str(budget.company_id.id),
        "created_by": str(budget.created_by.id),
        "category": budget.category,
        "amount": budget.amount,
        "period": budget.period
    }
    return jsonify({"message": "Budget updated", "budget": budget_data})

@budgets_bp.route('/budgets/<budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        return jsonify({"error": "company_id is required"}), 400
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    budget = Budget.objects(id=budget_id, company_id=company_id).first()
    if not budget:
        return jsonify({"error": "Budget not found"}), 404
    
    budget.delete()
    return jsonify({"message": "Budget deleted"})

companies_bp = Blueprint('companies', __name__)

@companies_bp.route('/companies', methods=['POST'])
def create_company():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import can_manage_companies
    if not can_manage_companies(current_user_id):
        return jsonify({"error": "Only SuperAdmin can create companies"}), 403
    
    data = request.json
    
    try:
        from src.models import Company, User
        creator = User.objects.get(id=current_user_id)
        
        company = Company(
            name=data.get('name'),
            currency=data.get('currency', 'USD'),
            created_by=creator
        ).save()
        
        return jsonify({
            "message": "Company created successfully",
            "company": {
                "id": str(company.id),
                "name": company.name,
                "currency": company.currency,
                "created_by": creator.username
            }
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to create company: {str(e)}"}), 500

@companies_bp.route('/companies', methods=['GET'])
def list_companies():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    try:
        companies = get_user_companies(current_user_id)
        return jsonify({
            "companies": [{
                "id": str(c.id),
                "name": c.name,
                "currency": c.currency
            } for c in companies]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve companies: {str(e)}"}), 500

@companies_bp.route('/companies/<company_id>', methods=['GET'])
def get_company_detail(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        company = get_company(company_id)
        if not company:
            return jsonify({"error": "Company not found"}), 404
        
        return jsonify({
            "id": str(company.id),
            "name": company.name,
            "currency": company.currency
        })
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve company: {str(e)}"}), 500

@companies_bp.route('/companies/<company_id>', methods=['PUT'])
def update_company_route(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    
    try:
        company = update_company(
            company_id=company_id,
            user_id=current_user_id,
            name=data.get('name'),
            currency=data.get('currency')
        )
        return jsonify({
            "message": "Company updated successfully",
            "company": {
                "id": str(company.id),
                "name": company.name,
                "currency": company.currency
            }
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to update company: {str(e)}"}), 500

@companies_bp.route('/companies/<company_id>', methods=['DELETE'])
def delete_company_route(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    try:
        delete_company(company_id, current_user_id)
        return jsonify({"message": "Company deleted successfully"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete company: {str(e)}"}), 500

users_bp = Blueprint('users', __name__)

@users_bp.route('/companies/<company_id>/invite', methods=['POST'])
def invite_user(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    
    try:
        from src.auth import invite_user_to_company, send_invitation_email
        result, message = invite_user_to_company(
            email=data.get('email'),
            company_id=company_id,
            role=data.get('role', 'user'),
            invited_by_user_id=current_user_id
        )
        
        if isinstance(result, User):
            return jsonify({
                "message": message,
                "user_id": str(result.id)
            }), 200
        else:
            send_invitation_email(result)
            
            return jsonify({
                "message": message,
                "invitation_token": result.token,
                "expires_at": result.expires_at.isoformat()
            }), 201
            
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to invite user: {str(e)}"}), 500

@users_bp.route('/companies/<company_id>/users', methods=['GET'])
def list_company_users(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    try:
        from src.utils import get_company_users
        users = get_company_users(company_id, current_user_id)
        
        users_data = []
        for user in users:
            from src.utils import get_user_role_in_company
            company_role = get_user_role_in_company(str(user.id), company_id)
            
            users_data.append({
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role_id.name if user.role_id else "User",
                "company_role": company_role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat()
            })
        
        return jsonify({
            "users": users_data,
            "company_id": company_id
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to list users: {str(e)}"}), 500

@users_bp.route('/companies/<company_id>/create-admin', methods=['POST'])
def create_company_admin(company_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    
    try:
        from src.auth import create_company_admin
        user, company = create_company_admin(
            username=data.get('username'),
            email=data.get('email'),
            password=data.get('password'),
            company_id=company_id,
            created_by_user_id=current_user_id
        )
        
        return jsonify({
            "message": "CompanyAdmin created successfully",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": "CompanyAdmin"
            },
            "company": {
                "id": str(company.id),
                "name": company.name
            }
        }), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to create CompanyAdmin: {str(e)}"}), 500

@users_bp.route('/update_profile', methods=['POST'])
def update_profile():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    user = User.objects.get(id=current_user_id)
    
    data = request.json
    user.username = data.get('username', user.username)
    user.save()
    return jsonify({'message': 'Profile updated successfully'})

@users_bp.route('/change_password', methods=['POST'])
def change_password():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    user = User.objects.get(id=current_user_id)
    
    if check_password_hash(user.password_hash, request.json.get('current_password')):
        if request.json.get('new_password') == request.json.get('confirm_password'):
            user.password_hash = generate_password_hash(request.json.get('new_password'))
            user.save()
            return jsonify({'message': 'Password changed successfully'})
        else:
            return jsonify({'error': 'New passwords do not match'}), 400
    else:
        return jsonify({'error': 'Current password is incorrect'}), 400

@users_bp.route('/settings', methods=['GET'])
def settings():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    user_preferences = UserPreferences.objects(user_id=current_user_id).first()
    if user_preferences:
        prefs_data = {
            'id': str(user_preferences.id),
            'modules': user_preferences.modules,
            'email_notifications': user_preferences.email_notifications
        }
    else:
        prefs_data = {}
    return jsonify({'user_preferences': prefs_data})

@users_bp.route('/update_modules', methods=['POST'])
def update_modules():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    user_preferences = UserPreferences.objects(user_id=current_user_id).first()
    if not user_preferences:
        user_preferences = UserPreferences(user_id=current_user_id)
        user_preferences.save()
    user_preferences.modules = request.json.get('modules', [])
    user_preferences.save()
    return jsonify({'message': 'Module preferences updated successfully'})

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/users', methods=['GET'])
def list_all_users():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import can_manage_companies
    if not can_manage_companies(current_user_id):
        return jsonify({"error": "Only SuperAdmin can list all users"}), 403
    
    try:
        from src.models import User
        users = User.objects(is_active=True).all()
        
        users_data = []
        for user in users:
            companies = []
            for membership in user.company_memberships:
                companies.append({
                    "id": str(membership.company_id.id),
                    "name": membership.company_id.name,
                    "role": membership.role
                })
            
            users_data.append({
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role_id.name if user.role_id else "User",
                "companies": companies,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat()
            })
        
        return jsonify({"users": users_data})
        
    except Exception as e:
        return jsonify({"error": f"Failed to list users: {str(e)}"}), 500

@admin_bp.route('/companies', methods=['GET'])
def list_all_companies():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import can_manage_companies
    if not can_manage_companies(current_user_id):
        return jsonify({"error": "Only SuperAdmin can list all companies"}), 403
    
    try:
        from src.models import Company, User
        companies = Company.objects(is_active=True).all()
        
        companies_data = []
        for company in companies:
            user_count = User.objects(company_memberships__company_id=company.id, is_active=True).count()
            
            companies_data.append({
                "id": str(company.id),
                "name": company.name,
                "currency": company.currency,
                "created_by": company.created_by.username,
                "user_count": user_count,
                "created_at": company.created_at.isoformat()
            })
        
        return jsonify({"companies": companies_data})
        
    except Exception as e:
        return jsonify({"error": f"Failed to list companies: {str(e)}"}), 500

@admin_bp.route('/debug-language', methods=['GET'])
def debug_language():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import can_manage_companies
    if not can_manage_companies(current_user_id):
        return jsonify({"error": "Only SuperAdmin can access this debug endpoint"}), 403
    
    all_info = {
        'session_language': session.get('language', 'Not set'),
        'available_translations': os.listdir('translations') if os.path.exists('translations') else [],
        'best_match': request.accept_languages.best_match(['en', 'es', 'ja']),
    }
    return jsonify(all_info)

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/ai/categorize', methods=['POST'])
def auto_categorize():
    """Smart Transaction Categorization"""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json

    if not data.get('description'):
        return jsonify({"error": "description is required"}), 400
    if data.get('amount') is None:
        return jsonify({"error": "amount is required"}), 400
    
    try:
        from src.config import Config
        from src.anthropic_service import FinancialAnalytics
        
        analytics = FinancialAnalytics(Config.ANTHROPIC_API_KEY)
        
        result = analytics.auto_categorize_transaction(
            description=data['description'],
            amount=float(data['amount']),
            merchant=data.get('merchant')
        )
        
        return jsonify({
            "message": "Transaction categorized successfully",
            "categorization": result
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Auto-categorization failed: {str(e)}")
        return jsonify({"error": f"Categorization failed: {str(e)}"}), 500

@ai_bp.route('/ai/anomalies', methods=['GET'])
def detect_anomalies():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    try:
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('-date').limit(100)
        
        transaction_list = []
        for t in transactions:
            transaction_list.append({
                'id': str(t.id),
                '_id': str(t.id),
                'date': t.date.strftime('%Y-%m-%d') if t.date else '',
                'description': t.description,
                'amount': t.amount,
                'type': t.type
            })
        
        if not transaction_list:
            return jsonify({
                "anomalies": [],
                "message": "No transactions to analyze",
                "company_id": company_id
            }), 200
        
        from src.config import Config
        from src.anthropic_service import FinancialAnalytics
        
        analytics = FinancialAnalytics(Config.ANTHROPIC_API_KEY)
        anomalies = analytics.detect_anomalies(transaction_list, company_id)
        
        return jsonify({
            "anomalies": anomalies,
            "total_analyzed": len(transaction_list),
            "company_id": company_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Anomaly detection failed: {str(e)}")
        return jsonify({"error": f"Anomaly detection failed: {str(e)}"}), 500

@ai_bp.route('/ai/chat', methods=['POST'])
def financial_chat():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    data = request.json
    
    if not data.get('query'):
        return jsonify({"error": "query is required"}), 400
    
    company_id = data.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    try:
        from src.dashboard import get_kpis
        from datetime import timedelta
        
        kpis = get_kpis(current_user_id, company_id)
        
        # Single query to get all transactions for aggregation
        all_transactions = list(Transaction.objects(user_id=current_user_id, company_id=company_id))
        total_transactions = len(all_transactions)
        
        # Calculate totals in memory (avoids multiple DB queries)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        total_inflow = 0
        total_outflow = 0
        monthly_revenue = 0
        monthly_expenses = 0
        
        for t in all_transactions:
            if t.type == 'inflow':
                total_inflow += t.amount
                if t.date:
                    # Handle timezone-naive dates by making them UTC-aware
                    t_date = t.date if t.date.tzinfo else t.date.replace(tzinfo=timezone.utc)
                    if t_date >= thirty_days_ago:
                        monthly_revenue += t.amount
            else:
                total_outflow += t.amount
                if t.date:
                    # Handle timezone-naive dates by making them UTC-aware
                    t_date = t.date if t.date.tzinfo else t.date.replace(tzinfo=timezone.utc)
                    if t_date >= thirty_days_ago:
                        monthly_expenses += t.amount
        
        balance = total_inflow - total_outflow
        burn_rate = monthly_expenses - monthly_revenue
        runway_months = (balance / burn_rate) if burn_rate > 0 else 999
        
        financial_context = {
            'balance': balance,
            'monthly_revenue': monthly_revenue,
            'monthly_expenses': monthly_expenses,
            'burn_rate': burn_rate,
            'runway_months': runway_months,
            'total_transactions': total_transactions,
            'recent_activity': 'Normal'
        }
        
        from src.config import Config
        from src.anthropic_service import FinancialAnalytics
        
        analytics = FinancialAnalytics(Config.ANTHROPIC_API_KEY)
        response = analytics.financial_chatbot(data['query'], financial_context)
        
        return jsonify({
            "response": response,
            "company_id": company_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Financial chat failed: {str(e)}")
        return jsonify({"error": f"Chat failed: {str(e)}"}), 500

@ai_bp.route('/ai/insights', methods=['GET'])
def get_insights():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    try:
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('-date')
        
        inflows = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow')
        outflows = Transaction.objects(user_id=current_user_id, company_id=company_id, type='outflow')
        
        total_inflow = sum(t.amount for t in inflows)
        total_outflow = sum(t.amount for t in outflows)
        balance = total_inflow - total_outflow
        
        from datetime import timedelta
        # Use timezone-aware datetime for consistent comparison
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        # For MongoDB queries, use naive UTC datetime to match stored dates
        thirty_days_ago_naive = thirty_days_ago.replace(tzinfo=None)
        recent_inflows = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow', date__gte=thirty_days_ago_naive)
        recent_outflows = Transaction.objects(user_id=current_user_id, company_id=company_id, type='outflow', date__gte=thirty_days_ago_naive)
        
        monthly_inflow = sum(t.amount for t in recent_inflows)
        monthly_outflow = sum(t.amount for t in recent_outflows)
        monthly_cash_flow = monthly_inflow - monthly_outflow
        burn_rate = abs(monthly_cash_flow) if monthly_cash_flow < 0 else 0
        runway_months = (balance / burn_rate) if burn_rate > 0 else 999
        
        top_expenses_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='outflow').order_by('-amount').limit(5)
        top_expenses = [{"description": t.description, "amount": t.amount} for t in top_expenses_query]
        
        top_revenue_query = Transaction.objects(user_id=current_user_id, company_id=company_id, type='inflow').order_by('-amount').limit(5)
        revenue_sources = [{"description": t.description, "amount": t.amount} for t in top_revenue_query]
        
        financial_data = {
            'current_balance': balance,
            'monthly_cash_flow': monthly_cash_flow,
            'revenue_trend': 'stable',
            'expense_trend': 'stable',
            'burn_rate': burn_rate,
            'runway_months': runway_months,
            'liquidity_ratio': 1.0,
            'top_expenses': top_expenses,
            'revenue_sources': revenue_sources,
            'upcoming_obligations': []
        }
        
        from src.config import Config
        from src.anthropic_service import FinancialAnalytics
        
        analytics = FinancialAnalytics(Config.ANTHROPIC_API_KEY)
        insights = analytics.generate_smart_insights(financial_data)
        
        return jsonify({
            "insights": insights,
            "company_id": company_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Insight generation failed: {str(e)}")
        return jsonify({"error": f"Insight generation failed: {str(e)}"}), 500

@ai_bp.route('/transactions/<transaction_id>/enhance', methods=['POST'])
def enhance_description(transaction_id):
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    try:
        transaction = Transaction.objects.get(id=transaction_id, user_id=current_user_id)
        
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, str(transaction.company_id.id))
        if not valid:
            return jsonify({"error": result}), 403
        
        transaction_data = {
            'description': transaction.description,
            'amount': transaction.amount,
            'type': transaction.type,
            'date': transaction.date.strftime('%Y-%m-%d') if transaction.date else '',
            'category': transaction.category
        }
        
        from src.config import Config
        from src.anthropic_service import FinancialAnalytics
        
        analytics = FinancialAnalytics(Config.ANTHROPIC_API_KEY)
        enhanced_description = analytics.enhance_transaction_description(transaction_data)
        
        if request.json and request.json.get('apply', False):
            transaction.description = enhanced_description
            transaction.updated_at = datetime.utcnow()
            transaction.save()
            
            return jsonify({
                "message": "Transaction description updated",
                "original": transaction_data['description'],
                "enhanced": enhanced_description,
                "transaction": transaction.to_json()
            }), 200
        else:
            return jsonify({
                "message": "Description enhanced (not applied)",
                "original": transaction_data['description'],
                "enhanced": enhanced_description
            }), 200
        
    except Transaction.DoesNotExist:
        return jsonify({"error": "Transaction not found"}), 404
    except Exception as e:
        current_app.logger.error(f"Description enhancement failed: {str(e)}")
        return jsonify({"error": f"Enhancement failed: {str(e)}"}), 500

core_bp = Blueprint('core', __name__)

@core_bp.route('/', methods=['GET'])
@core_bp.route('/home', methods=['GET'])
def home():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    user = User.objects.get(id=current_user_id)
    company_id = request.args.get('company_id')
    
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = 8

    transactions_qs = Transaction.objects(user_id=user.id, company_id=company_id).order_by('-date')
    total = transactions_qs.count()
    paginated_transactions = transactions_qs.skip((page-1)*per_page).limit(per_page)
    paginated = {
        'items': list(paginated_transactions),
        'total': total,
        'pages': (total + per_page - 1) // per_page
    }

    all_transactions = Transaction.objects(company_id=company_id)
    
    initial_balance_records = InitialBalance.objects(company_id=company_id).all()
    initial_balance = sum(record.balance for record in initial_balance_records) if initial_balance_records else 0.0

    total_cfo, total_cfi, total_cff = calculate_totals(all_transactions)
    balance = initial_balance + total_cfo + total_cfi + total_cff

    return jsonify({
        'transactions': [json.loads(t.to_json()) for t in paginated['items']],
        'balance': balance,
        'initial_balance': initial_balance,
        'total_cfo': total_cfo,
        'total_cfi': total_cfi,
        'total_cff': total_cff,
        'user': json.loads(user.to_json()),
        'company_id': company_id,
        'status': "Logged In"
    })

@core_bp.route('/set-initial-balance', methods=['POST'])
def set_initial_balance():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    company_id = data.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        from src.validators import validate_number_range, ValidationError
        
        amount = validate_number_range(
            data.get('initial_balance'),
            'initial_balance',
            min_val=-1000000000,
            max_val=1000000000
        )
        
        from src.models import Company
        company = Company.objects.get(id=company_id)
        
        initial_balance = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        if initial_balance:
            initial_balance.balance = amount
            initial_balance.save()
        else:
            initial_balance = InitialBalance(user_id=current_user_id, company_id=company, balance=amount)
            initial_balance.save()
            
        return jsonify({'message': 'Initial balance set successfully'})
    except ValidationError as e:
        return jsonify(e.to_dict()), 400
    except Exception as e:
        current_app.logger.error(f'Error setting initial balance: {str(e)}')
        return jsonify({'error': 'Error setting initial balance'}), 500

@core_bp.route('/balance-by-date', methods=['POST'])
def balance_by_date():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    company_id = data.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    date_str = data.get('date')
    if not date_str:
        return jsonify({
            'success': False,
            'error': 'Date is required'
        }), 400
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({
            'success': False,
            'error': 'Invalid date format. Use YYYY-MM-DD'
        }), 400
    
    try:
        initial_balance = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        initial_amount = initial_balance.balance if initial_balance else 0
        
        target_datetime = datetime.combine(target_date, datetime.max.time())
        transactions = Transaction.objects(
            user_id=current_user_id,
            company_id=company_id,
            date__lte=target_datetime
        )
        
        total_cfo, total_cfi, total_cff = calculate_totals(transactions)
        balance = initial_amount + total_cfo + total_cfi + total_cff
        
        return jsonify({
            'success': True,
            'balance': balance,
            'date': date_str
        })
    except Exception as e:
        current_app.logger.error(f"Error calculating balance by date: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to calculate balance'
        }), 500

@core_bp.route('/cash-overview', methods=['GET'])
def cash_overview():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    
    # Verify company access - required for security
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    else:
        from src.utils import verify_company_access
        valid, result = verify_company_access(current_user_id, company_id)
        if not valid:
            return jsonify({"error": result}), 403
    
    initial_balance_query = InitialBalance.objects(company_id=company_id)
    initial_balance_records = initial_balance_query.all()
    initial_balance_amount = sum(record.balance for record in initial_balance_records) if initial_balance_records else 0.0
    
    transactions_query = Transaction.objects(company_id=company_id)
    transactions = transactions_query.all()
    
    total_cfo, total_cfi, total_cff = calculate_totals(transactions)
    balance = initial_balance_amount + total_cfo + total_cfi + total_cff
    
    burn_rate = calculate_burn_rate(current_user_id, company_id)
    runway_months = calculate_runway(current_user_id, company_id, balance)

    return jsonify({ 
        'initial_balance': initial_balance_amount,
        'total_cfo': total_cfo, 
        'total_cfi': total_cfi, 
        'total_cff': total_cff, 
        'balance': balance,
        'burn_rate': burn_rate,
        'runway_months': runway_months,
        'company_id': company_id
    })

@core_bp.route('/cash-activities', methods=['GET'])
def cash_activities():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    company_id = request.args.get('company_id')
    
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    
    query = Transaction.objects(user_id=current_user_id)
    if company_id:
        query = query.filter(company_id=company_id)
    
    total = query.count()
    skip = (page - 1) * per_page
    
    transactions = query.order_by('-date').skip(skip).limit(per_page)
    
    transactions_data = []
    for t in transactions:
        transactions_data.append({
            'id': str(t.id),
            'date': t.date.isoformat() if t.date else None,
            'description': t.description,
            'amount': t.amount,
            'type': t.type,
            'category': t.category,
            'currency': t.currency if hasattr(t, 'currency') else 'USD'
        })
    
    return jsonify({
        'transactions': transactions_data,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/monthly-balances', methods=['GET'])
def monthly_balances():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        current_app.logger.info("Starting to generate monthly balance data")
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('date')
        initial_balance_record = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        initial_balance = initial_balance_record.balance if initial_balance_record else 0.0

        monthly_data = {}
        current_balance = initial_balance

        for transaction in transactions:
            month = transaction.date.strftime('%Y-%m') if isinstance(transaction.date, datetime) else datetime.strptime(transaction.date, '%Y-%m-%d').strftime('%Y-%m')
            
            if month not in monthly_data:
                monthly_data[month] = current_balance
            
            current_balance += transaction.amount
            monthly_data[month] = current_balance

        current_app.logger.info(f"Monthly balance data generated: {monthly_data}")
        return jsonify({
            'success': True,
            'data': {
                'labels': list(monthly_data.keys()),
                'balances': list(monthly_data.values())
            }
        })
    except Exception as e:
        current_app.logger.error(f"Error generating monthly balance data: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/monthly-income-expense', methods=['GET'])
def monthly_income_expense():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('date')
        monthly_data = {}

        for transaction in transactions:
            month = transaction.date.strftime('%Y-%m') if isinstance(transaction.date, datetime) else datetime.strptime(transaction.date, '%Y-%m-%d').strftime('%Y-%m')
            
            if month not in monthly_data:
                monthly_data[month] = {'income': 0, 'expense': 0}
            
            # Use transaction type field, not amount sign
            if transaction.type == 'inflow':
                monthly_data[month]['income'] += transaction.amount
            else:  # outflow
                monthly_data[month]['expense'] += transaction.amount

        return jsonify({
            'success': True,
            'data': {
                'labels': list(monthly_data.keys()),
                'income': [data['income'] for data in monthly_data.values()],
                'expense': [data['expense'] for data in monthly_data.values()]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/cashout-categories', methods=['GET'])
def cashout_categories():
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        # Query outflows by type field, not by amount
        transactions = Transaction.objects(
            user_id=current_user_id,
            company_id=company_id,
            type='outflow'
        ).all()

        categories_data = {}
        for transaction in transactions:
            # Group by category, not by type
            category = transaction.category
            if category not in categories_data:
                categories_data[category] = 0
            categories_data[category] += transaction.amount

        return jsonify({
            'success': True,
            'data': {
                'labels': list(categories_data.keys()),
                'amounts': list(categories_data.values())
            }
        })
    except Exception as e:
        current_app.logger.error(f"Error fetching cashout categories: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@analytics_bp.route('/generate_cashflow_statement', methods=['GET'])
def generate_cashflow_statement_route():
    from flask import current_app
    import traceback
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    company_id = request.args.get('company_id')
    if not company_id:
        from src.utils import get_user_default_company
        company = get_user_default_company(current_user_id)
        if not company:
            return jsonify({"error": "No company found for user"}), 400
        company_id = str(company.id)
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        transactions = Transaction.objects(user_id=current_user_id, company_id=company_id).order_by('date')
        if not transactions:
            current_app.logger.warning("No transactions found when generating cash flow statement")
            return jsonify({'error': 'No transactions found'}), 400

        initial_balance_record = InitialBalance.objects(user_id=current_user_id, company_id=company_id).first()
        initial_balance = initial_balance_record.balance if initial_balance_record else 0.0

        start_date = transactions[0].date
        end_date = transactions[-1].date

        transaction_data = "\n".join([f"Date: {t.date}, Description: {t.description}, Amount: {t.amount}, Type: {t.type}" for t in transactions])

        current_app.logger.info(f"Generating cash flow statement for period {start_date} to {end_date}")
        
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            current_app.logger.error("ANTHROPIC_API_KEY not found in environment variables")
            return jsonify({'error': 'API key not found'}), 500
            
        from src.anthropic_service import FinancialAnalytics
        analytics = FinancialAnalytics(api_key=api_key)
        
        statement_data, ending_balance = analytics.generate_cashflow_statement(
            initial_balance=initial_balance,
            start_date=start_date,
            end_date=end_date,
            transaction_data=transaction_data
        )
        
        if not statement_data:
            current_app.logger.error("generate_cashflow_statement returned None")
            return jsonify({'error': 'Failed to generate statement: No data returned'}), 500

        current_app.logger.info("Cash flow statement generated successfully")
        current_app.logger.debug(f"Statement data: {statement_data}")

        wb = Workbook()
        ws = wb.active
        ws.title = "Cash Flow Statement"

        # Set column widths
        ws.column_dimensions['A'].width = 40
        ws.column_dimensions['B'].width = 15

        ws['A1'] = f"Cash Flow Statement - {start_date} to {end_date}"
        ws['A1'].font = Font(bold=True, size=14)
        ws.merge_cells('A1:B1')

        headers = ['Category', 'Amount']
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=3, column=col, value=header)
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")

        def add_row(row, category, amount, is_total=False, indent=0):
            ws.cell(row=row, column=1, value=category).alignment = Alignment(indent=indent)
            ws.cell(row=row, column=2, value=amount)
            if is_total:
                for col in range(1, 3):
                    ws.cell(row=row, column=col).font = Font(bold=True)

        row = 4
        add_row(row, "Beginning Cash Balance", initial_balance, True)
        row += 2

        categories = ['CFO', 'CFI', 'CFF']
        for category in categories:
            ws.cell(row=row, column=1, value=f"Cash Flow from {'Operating' if category == 'CFO' else 'Investing' if category == 'CFI' else 'Financing'} Activities ({category})")
            ws.cell(row=row, column=1).font = Font(bold=True)
            ws.cell(row=row, column=1).fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")
            row += 1

            category_total = 0
            for item in statement_data:
                if item['Category'] == category:
                    add_row(row, item['Subcategory'], item['Amount'], indent=1)
                    category_total += item['Amount']
                    row += 1

            add_row(row, f"Net Cash from {'Operating' if category == 'CFO' else 'Investing' if category == 'CFI' else 'Financing'}", category_total, True)
            row += 2

        # Add Total Net Cash Flow
        total_net_cash_flow = sum(item['Amount'] for item in statement_data)
        add_row(row, "Total Net Cash Flow", total_net_cash_flow, True)
        row += 2

        ending_balance = initial_balance + total_net_cash_flow
        add_row(row, "Ending Cash Balance", ending_balance, True)

        for row in ws['B4:B' + str(ws.max_row)]:
            for cell in row:
                cell.number_format = '#,##0.00'

        for row in ws['B1:B' + str(ws.max_row)]:
            for cell in row:
                cell.alignment = Alignment(horizontal='right')

        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=2):
            for cell in row:
                cell.border = thin_border

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        current_app.logger.info("Excel file created successfully")
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='cash_flow_statement.xlsx'
        )
    except Exception as e:
        current_app.logger.error(f"Failed to generate cash flow statement: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to generate cash flow statement: {str(e)}'}), 500


# =============================================================================
# Invoice Blueprint - Automated Invoice Generation
# =============================================================================

invoices_bp = Blueprint('invoices', __name__)


@invoices_bp.route('/companies/<company_id>/invoice-templates', methods=['GET'])
def list_invoice_templates(company_id):
    """List all invoice templates for a company."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import InvoiceTemplate
    templates = InvoiceTemplate.objects(company_id=company_id, is_active=True)
    
    templates_data = [{
        "id": str(t.id),
        "template_name": t.template_name,
        "default_due_days": t.default_due_days,
        "default_tax_rate": t.default_tax_rate,
        "line_items_template": t.line_items_template,
        "auto_generate": t.auto_generate,
        "generation_frequency": t.generation_frequency,
        "next_generation_date": t.next_generation_date.isoformat() if t.next_generation_date else None,
        "created_at": t.created_at.isoformat() if t.created_at else None
    } for t in templates]
    
    return jsonify({
        "templates": templates_data,
        "company_id": company_id
    })


@invoices_bp.route('/companies/<company_id>/invoice-templates', methods=['POST'])
def create_invoice_template(company_id):
    """Create a new invoice template for automated generation."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    if not data.get('template_name'):
        return jsonify({"error": "template_name is required"}), 400
    
    from src.models import InvoiceTemplate, Company, User
    from src.services.invoice_automation import calculate_next_generation_date
    
    try:
        company = Company.objects.get(id=company_id)
        user = User.objects.get(id=current_user_id)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch company or user: {str(e)}"}), 400
    
    # Calculate next generation date if auto_generate is enabled
    next_gen_date = None
    if data.get('auto_generate') and data.get('generation_frequency'):
        next_gen_date = calculate_next_generation_date(data['generation_frequency'])
    
    template = InvoiceTemplate(
        company_id=company,
        template_name=data['template_name'],
        default_due_days=data.get('default_due_days', 30),
        default_tax_rate=data.get('default_tax_rate', 0.0),
        line_items_template=data.get('line_items_template', []),
        auto_generate=data.get('auto_generate', False),
        generation_frequency=data.get('generation_frequency'),
        next_generation_date=next_gen_date,
        created_by=user
    ).save()
    
    return jsonify({
        "message": "Invoice template created successfully",
        "template": {
            "id": str(template.id),
            "template_name": template.template_name,
            "default_due_days": template.default_due_days,
            "default_tax_rate": template.default_tax_rate,
            "auto_generate": template.auto_generate,
            "generation_frequency": template.generation_frequency
        }
    }), 201


@invoices_bp.route('/companies/<company_id>/invoice-templates/<template_id>', methods=['PUT'])
def update_invoice_template(company_id, template_id):
    """Update an invoice template."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    from src.models import InvoiceTemplate
    from src.services.invoice_automation import calculate_next_generation_date
    
    template = InvoiceTemplate.objects(id=template_id, company_id=company_id).first()
    if not template:
        return jsonify({"error": "Template not found"}), 404
    
    # Update fields
    if 'template_name' in data:
        template.template_name = data['template_name']
    if 'default_due_days' in data:
        template.default_due_days = data['default_due_days']
    if 'default_tax_rate' in data:
        template.default_tax_rate = data['default_tax_rate']
    if 'line_items_template' in data:
        template.line_items_template = data['line_items_template']
    if 'auto_generate' in data:
        template.auto_generate = data['auto_generate']
    if 'generation_frequency' in data:
        template.generation_frequency = data['generation_frequency']
        # Recalculate next generation date
        if template.auto_generate and template.generation_frequency:
            template.next_generation_date = calculate_next_generation_date(
                template.generation_frequency
            )
    
    template.save()
    
    return jsonify({
        "message": "Invoice template updated successfully",
        "template": {
            "id": str(template.id),
            "template_name": template.template_name,
            "auto_generate": template.auto_generate
        }
    })


@invoices_bp.route('/companies/<company_id>/invoice-templates/<template_id>', methods=['DELETE'])
def delete_invoice_template(company_id, template_id):
    """Soft delete an invoice template."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import InvoiceTemplate
    
    template = InvoiceTemplate.objects(id=template_id, company_id=company_id).first()
    if not template:
        return jsonify({"error": "Template not found"}), 404
    
    template.is_active = False
    template.auto_generate = False
    template.save()
    
    return jsonify({"message": "Invoice template deleted successfully"})


@invoices_bp.route('/companies/<company_id>/invoices', methods=['GET'])
def list_invoices(company_id):
    """List all invoices for a company with optional status filter."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import Invoice
    
    status_filter = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    query = Invoice.objects(company_id=company_id)
    if status_filter:
        query = query.filter(status=status_filter)
    
    total = query.count()
    invoices = query.order_by('-issue_date').skip((page - 1) * per_page).limit(per_page)
    
    invoices_data = [{
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "customer_name": inv.customer_name,
        "customer_email": inv.customer_email,
        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "subtotal": inv.subtotal,
        "tax_amount": inv.tax_amount,
        "total_amount": inv.total_amount,
        "currency": inv.currency,
        "status": inv.status
    } for inv in invoices]
    
    return jsonify({
        "invoices": invoices_data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "company_id": company_id
    })


@invoices_bp.route('/companies/<company_id>/invoices', methods=['POST'])
def create_invoice(company_id):
    """Generate a new invoice, optionally from a template."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    if not data.get('customer_name'):
        return jsonify({"error": "customer_name is required"}), 400
    
    # Check if generating from template
    template_id = data.get('template_id')
    
    if template_id:
        # Generate from template
        from src.services.invoice_automation import generate_invoice_from_template
        
        try:
            invoice = generate_invoice_from_template(
                template_id=template_id,
                customer_data={
                    'customer_name': data['customer_name'],
                    'customer_email': data.get('customer_email')
                },
                created_by_user_id=current_user_id,
                line_items_override=data.get('line_items')
            )
        except Exception as e:
            return jsonify({"error": f"Failed to generate invoice: {str(e)}"}), 400
    else:
        # Create invoice manually
        from src.models import Invoice, Company, User
        from src.services.invoice_automation import generate_invoice_number
        
        if not data.get('line_items'):
            return jsonify({"error": "line_items required when not using template"}), 400
        if not data.get('due_date'):
            return jsonify({"error": "due_date required when not using template"}), 400
        
        try:
            company = Company.objects.get(id=company_id)
            user = User.objects.get(id=current_user_id)
            
            line_items = data['line_items']
            subtotal = sum(float(item.get('amount', 0)) for item in line_items)
            tax_rate = data.get('tax_rate', 0.0)
            tax_amount = subtotal * tax_rate
            total_amount = subtotal + tax_amount
            
            due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            
            invoice = Invoice(
                company_id=company,
                invoice_number=generate_invoice_number(company_id),
                customer_name=data['customer_name'],
                customer_email=data.get('customer_email'),
                due_date=due_date,
                line_items=line_items,
                subtotal=subtotal,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                total_amount=total_amount,
                currency=data.get('currency', company.currency or 'USD'),
                status=data.get('status', 'draft'),
                notes=data.get('notes'),
                created_by=user
            ).save()
        except Exception as e:
            return jsonify({"error": f"Failed to create invoice: {str(e)}"}), 400
    
    return jsonify({
        "message": "Invoice created successfully",
        "invoice": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name,
            "due_date": invoice.due_date.isoformat(),
            "total_amount": invoice.total_amount,
            "status": invoice.status
        }
    }), 201


@invoices_bp.route('/companies/<company_id>/invoices/<invoice_id>', methods=['GET'])
def get_invoice(company_id, invoice_id):
    """Get invoice details."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import Invoice
    
    invoice = Invoice.objects(id=invoice_id, company_id=company_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    
    return jsonify({
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "customer_name": invoice.customer_name,
        "customer_email": invoice.customer_email,
        "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None,
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "line_items": invoice.line_items,
        "subtotal": invoice.subtotal,
        "tax_rate": invoice.tax_rate,
        "tax_amount": invoice.tax_amount,
        "total_amount": invoice.total_amount,
        "currency": invoice.currency,
        "status": invoice.status,
        "notes": invoice.notes,
        "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
        "payment_method": invoice.payment_method,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None
    })


@invoices_bp.route('/companies/<company_id>/invoices/<invoice_id>', methods=['PUT', 'PATCH'])
def update_invoice(company_id, invoice_id):
    """Update an invoice."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import Invoice, utc_now
    
    invoice = Invoice.objects(id=invoice_id, company_id=company_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    
    data = request.json
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    # Update allowed fields
    if 'customer_name' in data:
        invoice.customer_name = data['customer_name']
    if 'customer_email' in data:
        invoice.customer_email = data['customer_email']
    if 'due_date' in data:
        invoice.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
    if 'line_items' in data:
        invoice.line_items = data['line_items']
        invoice.subtotal = sum(float(item.get('amount', 0)) for item in data['line_items'])
        invoice.tax_amount = invoice.subtotal * invoice.tax_rate
        invoice.total_amount = invoice.subtotal + invoice.tax_amount
    if 'tax_rate' in data:
        invoice.tax_rate = data['tax_rate']
        invoice.tax_amount = invoice.subtotal * invoice.tax_rate
        invoice.total_amount = invoice.subtotal + invoice.tax_amount
    if 'status' in data:
        invoice.status = data['status']
        if data['status'] == 'paid' and not invoice.paid_at:
            invoice.paid_at = utc_now()
    if 'notes' in data:
        invoice.notes = data['notes']
    if 'payment_method' in data:
        invoice.payment_method = data['payment_method']
    
    invoice.save()
    
    return jsonify({
        "message": "Invoice updated successfully",
        "invoice": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
            "total_amount": invoice.total_amount
        }
    })


@invoices_bp.route('/companies/<company_id>/invoices/<invoice_id>', methods=['DELETE'])
def delete_invoice(company_id, invoice_id):
    """Delete an invoice (only if in draft status)."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import Invoice
    
    invoice = Invoice.objects(id=invoice_id, company_id=company_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    
    if invoice.status != 'draft':
        return jsonify({"error": "Only draft invoices can be deleted"}), 400
    
    invoice.delete()
    
    return jsonify({"message": "Invoice deleted successfully"})


@invoices_bp.route('/companies/<company_id>/invoices/summary', methods=['GET'])
def get_invoice_summary_route(company_id):
    """Get invoice summary statistics for a company."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.services.invoice_automation import get_invoice_summary
    
    summary = get_invoice_summary(company_id)
    summary['company_id'] = company_id
    
    return jsonify(summary)


@invoices_bp.route('/companies/<company_id>/invoices/<invoice_id>/speech', methods=['GET'])
def get_invoice_speech(company_id, invoice_id):
    """
    Get a speech-friendly summary of an invoice.
    
    Query params:
    - style: conversational (default), formal, or brief
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from src.models import Invoice
    
    invoice = Invoice.objects(id=invoice_id, company_id=company_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    
    try:
        from src.services.speech_service import get_speech_service
        
        style = request.args.get('style', 'conversational')
        
        invoice_data = {
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name,
            "customer_email": invoice.customer_email,
            "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "line_items": invoice.line_items,
            "subtotal": invoice.subtotal,
            "tax_rate": invoice.tax_rate,
            "tax_amount": invoice.tax_amount,
            "total_amount": invoice.total_amount,
            "currency": invoice.currency,
            "status": invoice.status,
            "notes": invoice.notes
        }
        
        speech_service = get_speech_service()
        speech_text = speech_service.generate_invoice_speech(
            invoice_data=invoice_data,
            style=style
        )
        
        return jsonify({
            "speech_text": speech_text,
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "style": style
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Invoice speech generation error: {str(e)}")
        return jsonify({"error": f"Failed to generate speech: {str(e)}"}), 500


@invoices_bp.route('/companies/<company_id>/invoices/<invoice_id>/export/pdf', methods=['GET'])
def export_invoice_pdf(company_id, invoice_id):
    """
    Export an invoice to PDF format.
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from flask import Response
    from src.models import Invoice, Company
    from src.services.export_service import get_export_service
    
    invoice = Invoice.objects(id=invoice_id, company_id=company_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    
    # Get company info for header
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        company = None
    
    export_service = get_export_service()
    pdf_data = export_service.export_invoice_pdf(invoice, company=company)
    
    filename = f"invoice_{invoice.invoice_number}.pdf"
    
    return Response(
        pdf_data,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@invoices_bp.route('/companies/<company_id>/invoices/export/csv', methods=['GET'])
def export_invoices_csv(company_id):
    """
    Export all company invoices to CSV format.
    
    Query params:
    - status: Filter by invoice status (draft, sent, paid, overdue)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    from src.utils import verify_company_access
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    from flask import Response
    from src.models import Invoice
    from src.services.export_service import get_export_service
    
    # Parse query params
    status_filter = request.args.get('status')
    
    query = Invoice.objects(company_id=company_id)
    if status_filter:
        query = query.filter(status=status_filter)
    
    invoices = list(query.order_by('-issue_date'))
    
    if not invoices:
        return jsonify({"error": "No invoices found"}), 404
    
    export_service = get_export_service()
    csv_data = export_service.export_invoices_csv(invoices)
    
    filename = f"invoices_{company_id}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )
