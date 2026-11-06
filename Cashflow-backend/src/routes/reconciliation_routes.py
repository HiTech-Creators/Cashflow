"""
Bank Reconciliation Routes for Flowback Cashflow API.

This module provides API endpoints for:
- Bank statement upload and management
- Transaction reconciliation
- Reconciliation reporting
"""

from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from src.models import (
    BankStatement, ReconciliationItem, Transaction, Company, User, utc_now
)
from src.utils import verify_company_access
from src.services.reconciliation_service import get_reconciliation_service


reconciliation_bp = Blueprint('reconciliation', __name__)


# =============================================================================
# Bank Statement Endpoints
# =============================================================================

@reconciliation_bp.route('/companies/<company_id>/bank-statements', methods=['GET'])
def list_bank_statements(company_id):
    """List all bank statements for a company."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    query = BankStatement.objects(company_id=company_id).order_by('-statement_date')
    total = query.count()
    statements = query.skip((page - 1) * per_page).limit(per_page)
    
    statements_data = [{
        "id": str(s.id),
        "bank_name": s.bank_name,
        "account_number": s.account_number[-4:] + '****',  # Mask for security
        "statement_date": s.statement_date.isoformat() if s.statement_date else None,
        "opening_balance": s.opening_balance,
        "closing_balance": s.closing_balance,
        "created_at": s.created_at.isoformat() if s.created_at else None
    } for s in statements]
    
    return jsonify({
        "statements": statements_data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "company_id": company_id
    })


@reconciliation_bp.route('/companies/<company_id>/bank-statements', methods=['POST'])
def create_bank_statement(company_id):
    """
    Create a new bank statement and optionally upload reconciliation items.
    
    Expected JSON body:
    {
        "bank_name": "Bank Name",
        "account_number": "1234567890",
        "statement_date": "2026-01-01",
        "opening_balance": 10000.00,
        "closing_balance": 12500.00,
        "items": [
            {"date": "2026-01-05", "description": "Deposit", "amount": 5000.00},
            {"date": "2026-01-10", "description": "Payment", "amount": -2500.00}
        ]
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
    required = ['bank_name', 'account_number', 'statement_date', 'opening_balance', 'closing_balance']
    missing = [f for f in required if not data.get(f) and data.get(f) != 0]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    
    try:
        company = Company.objects.get(id=company_id)
        user = User.objects.get(id=current_user_id)
        
        # Parse statement date
        statement_date = datetime.fromisoformat(data['statement_date'].replace('Z', '+00:00'))
        
        # Create bank statement
        statement = BankStatement(
            company_id=company,
            bank_name=data['bank_name'],
            account_number=data['account_number'],
            statement_date=statement_date,
            opening_balance=float(data['opening_balance']),
            closing_balance=float(data['closing_balance']),
            uploaded_by=user
        ).save()
        
        # Create reconciliation items if provided
        items_result = None
        if data.get('items'):
            recon_service = get_reconciliation_service()
            
            # Parse dates in items
            parsed_items = []
            for item in data['items']:
                parsed_item = dict(item)
                if item.get('date'):
                    parsed_item['date'] = datetime.fromisoformat(
                        item['date'].replace('Z', '+00:00')
                    )
                parsed_items.append(parsed_item)
            
            items_result = recon_service.create_reconciliation_items_from_data(
                bank_statement_id=str(statement.id),
                company_id=company_id,
                items_data=parsed_items
            )
        
        response = {
            "message": "Bank statement created successfully",
            "statement": {
                "id": str(statement.id),
                "bank_name": statement.bank_name,
                "statement_date": statement.statement_date.isoformat(),
                "opening_balance": statement.opening_balance,
                "closing_balance": statement.closing_balance
            }
        }
        
        if items_result:
            response["items_created"] = items_result['created_count']
            if items_result['errors']:
                response["item_errors"] = items_result['errors']
        
        return jsonify(response), 201
        
    except Exception as e:
        current_app.logger.error(f"Error creating bank statement: {str(e)}")
        return jsonify({"error": f"Failed to create bank statement: {str(e)}"}), 400


@reconciliation_bp.route('/companies/<company_id>/bank-statements/<statement_id>', methods=['GET'])
def get_bank_statement(company_id, statement_id):
    """Get bank statement details with reconciliation items."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        statement = BankStatement.objects.get(id=statement_id, company_id=company_id)
    except BankStatement.DoesNotExist:
        return jsonify({"error": "Bank statement not found"}), 404
    
    # Get reconciliation items
    items = ReconciliationItem.objects(bank_statement=statement_id).order_by('bank_date')
    
    items_data = [{
        "id": str(item.id),
        "date": item.bank_date.isoformat() if item.bank_date else None,
        "description": item.bank_description,
        "amount": item.bank_amount,
        "reference": item.bank_reference,
        "status": item.status,
        "matched_transaction": {
            "id": str(item.transaction.id),
            "description": item.transaction.description,
            "amount": item.transaction.amount
        } if item.transaction else None,
        "reconciled_at": item.reconciled_at.isoformat() if item.reconciled_at else None
    } for item in items]
    
    return jsonify({
        "id": str(statement.id),
        "bank_name": statement.bank_name,
        "account_number": statement.account_number[-4:] + '****',
        "statement_date": statement.statement_date.isoformat(),
        "opening_balance": statement.opening_balance,
        "closing_balance": statement.closing_balance,
        "created_at": statement.created_at.isoformat() if statement.created_at else None,
        "items": items_data,
        "items_count": len(items_data)
    })


@reconciliation_bp.route('/companies/<company_id>/bank-statements/<statement_id>', methods=['DELETE'])
def delete_bank_statement(company_id, statement_id):
    """Delete a bank statement and its reconciliation items."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        statement = BankStatement.objects.get(id=statement_id, company_id=company_id)
    except BankStatement.DoesNotExist:
        return jsonify({"error": "Bank statement not found"}), 404
    
    # Delete associated reconciliation items first
    ReconciliationItem.objects(bank_statement=statement_id).delete()
    
    statement.delete()
    
    return jsonify({"message": "Bank statement deleted successfully"})


# =============================================================================
# Reconciliation Endpoints
# =============================================================================

@reconciliation_bp.route('/companies/<company_id>/reconciliation/<statement_id>/auto-match', methods=['POST'])
def auto_match_reconciliation(company_id, statement_id):
    """
    Automatically match bank transactions with system transactions.
    
    Optional query params:
    - date_tolerance: Days tolerance for matching (default: 2)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Verify statement belongs to company
    try:
        BankStatement.objects.get(id=statement_id, company_id=company_id)
    except BankStatement.DoesNotExist:
        return jsonify({"error": "Bank statement not found"}), 404
    
    date_tolerance = request.args.get('date_tolerance', 2, type=int)
    
    recon_service = get_reconciliation_service()
    result = recon_service.auto_match_transactions(
        bank_statement_id=statement_id,
        date_tolerance_days=date_tolerance
    )
    
    return jsonify({
        "message": f"Auto-matching complete: {result['matched_count']} matched, {result['unmatched_count']} unmatched",
        "matched_count": result['matched_count'],
        "unmatched_count": result['unmatched_count'],
        "matches": result['matches'],
        "errors": result['errors']
    }), 200


@reconciliation_bp.route('/companies/<company_id>/reconciliation/<statement_id>', methods=['GET'])
def get_reconciliation_status(company_id, statement_id):
    """Get reconciliation report for a bank statement."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    recon_service = get_reconciliation_service()
    report = recon_service.get_reconciliation_report(company_id, statement_id)
    
    if 'error' in report:
        return jsonify({"error": report['error']}), 404
    
    return jsonify(report), 200


@reconciliation_bp.route('/companies/<company_id>/reconciliation/items/<item_id>/match', methods=['POST'])
def manual_match_item(company_id, item_id):
    """
    Manually match a reconciliation item to a transaction.
    
    Expected JSON body:
    {
        "transaction_id": "<transaction_id>",
        "notes": "Optional notes"
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
    if not data or not data.get('transaction_id'):
        return jsonify({"error": "transaction_id is required"}), 400
    
    # Verify item belongs to company
    try:
        item = ReconciliationItem.objects.get(id=item_id, company_id=company_id)
    except ReconciliationItem.DoesNotExist:
        return jsonify({"error": "Reconciliation item not found"}), 404
    
    recon_service = get_reconciliation_service()
    result = recon_service.manual_match(
        reconciliation_item_id=item_id,
        transaction_id=data['transaction_id'],
        user_id=current_user_id,
        notes=data.get('notes')
    )
    
    if not result['success']:
        return jsonify({"error": result['error']}), 400
    
    return jsonify({
        "message": "Item matched successfully",
        "item": result['item']
    }), 200


@reconciliation_bp.route('/companies/<company_id>/reconciliation/items/<item_id>/unmatch', methods=['POST'])
def unmatch_item(company_id, item_id):
    """Unmatch a reconciliation item."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Verify item belongs to company
    try:
        ReconciliationItem.objects.get(id=item_id, company_id=company_id)
    except ReconciliationItem.DoesNotExist:
        return jsonify({"error": "Reconciliation item not found"}), 404
    
    recon_service = get_reconciliation_service()
    result = recon_service.unmatch(item_id, current_user_id)
    
    if not result['success']:
        return jsonify({"error": result['error']}), 400
    
    return jsonify(result), 200


@reconciliation_bp.route('/companies/<company_id>/reconciliation/items/<item_id>/potential-matches', methods=['GET'])
def get_potential_matches(company_id, item_id):
    """Get potential transaction matches for manual reconciliation."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Verify item belongs to company
    try:
        item = ReconciliationItem.objects.get(id=item_id, company_id=company_id)
    except ReconciliationItem.DoesNotExist:
        return jsonify({"error": "Reconciliation item not found"}), 404
    
    date_tolerance = request.args.get('date_tolerance', 5, type=int)
    
    recon_service = get_reconciliation_service()
    matches = recon_service.get_potential_matches(item_id, date_tolerance)
    
    return jsonify({
        "item": {
            "id": str(item.id),
            "date": item.bank_date.isoformat() if item.bank_date else None,
            "description": item.bank_description,
            "amount": item.bank_amount
        },
        "potential_matches": matches,
        "count": len(matches)
    }), 200
