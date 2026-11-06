"""
Drawings (Owner Withdrawals) Routes for Flowback Cashflow API.

This module provides API endpoints for:
- Recording owner drawings/withdrawals
- Managing equity accounts
- Tracking capital contributions
"""

from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from src.models import (
    Drawing, EquityAccount, Transaction, Company, User, utc_now
)
from src.utils import verify_company_access


drawings_bp = Blueprint('drawings', __name__)


# =============================================================================
# Drawing Endpoints
# =============================================================================

@drawings_bp.route('/companies/<company_id>/drawings', methods=['GET'])
def list_drawings(company_id):
    """List all drawings for a company with optional owner filter."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    # Parse query params
    owner_id = request.args.get('owner_id')
    category = request.args.get('category')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    query = Drawing.objects(company_id=company_id)
    
    if owner_id:
        query = query.filter(owner=owner_id)
    if category:
        query = query.filter(category=category)
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(date__gte=start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(date__lte=end_dt)
        except ValueError:
            pass
    
    query = query.order_by('-date')
    total = query.count()
    drawings = query.skip((page - 1) * per_page).limit(per_page)
    
    drawings_data = [{
        "id": str(d.id),
        "owner": {
            "id": str(d.owner.id),
            "username": d.owner.username
        },
        "date": d.date.isoformat() if d.date else None,
        "description": d.description,
        "amount": d.amount,
        "category": d.category,
        "transaction_id": str(d.transaction.id) if d.transaction else None,
        "created_at": d.created_at.isoformat() if d.created_at else None
    } for d in drawings]
    
    # Calculate totals
    total_amount = sum(d.amount for d in Drawing.objects(company_id=company_id))
    
    return jsonify({
        "drawings": drawings_data,
        "total": total,
        "total_amount": total_amount,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "company_id": company_id
    })


@drawings_bp.route('/companies/<company_id>/drawings', methods=['POST'])
def create_drawing(company_id):
    """
    Record a new owner drawing.
    
    Expected JSON body:
    {
        "owner_id": "<user_id>",
        "date": "2026-01-15",
        "description": "Personal expense",
        "amount": 5000.00,
        "category": "personal",
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
    required = ['owner_id', 'date', 'description', 'amount']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    
    # Validate amount is positive
    try:
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400
    
    # Validate category
    category = data.get('category', 'personal')
    if category not in ['personal', 'equity', 'loan']:
        return jsonify({"error": "Invalid category. Must be: personal, equity, or loan"}), 400
    
    try:
        company = Company.objects.get(id=company_id)
        owner = User.objects.get(id=data['owner_id'])
        creator = User.objects.get(id=current_user_id)
        
        # Parse date
        drawing_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
        
        # Create the drawing
        drawing = Drawing(
            company_id=company,
            owner=owner,
            date=drawing_date,
            description=data['description'],
            amount=amount,
            category=category,
            created_by=creator
        )
        
        # Optionally create linked transaction
        if data.get('create_transaction', False):
            transaction = Transaction(
                user_id=creator,
                company_id=company,
                date=drawing_date,
                description=f"Owner Drawing: {data['description']}",
                amount=amount,
                type='outflow',
                category='financing',
                currency=company.currency or 'USD'
            ).save()
            drawing.transaction = transaction
        
        drawing.save()
        
        # Update equity account
        _update_equity_account(company_id, str(owner.id), drawing_amount=amount)
        
        return jsonify({
            "message": "Drawing recorded successfully",
            "drawing": {
                "id": str(drawing.id),
                "owner": owner.username,
                "date": drawing.date.isoformat(),
                "description": drawing.description,
                "amount": drawing.amount,
                "category": drawing.category,
                "transaction_id": str(drawing.transaction.id) if drawing.transaction else None
            }
        }), 201
        
    except User.DoesNotExist:
        return jsonify({"error": "Owner not found"}), 404
    except Company.DoesNotExist:
        return jsonify({"error": "Company not found"}), 404
    except Exception as e:
        current_app.logger.error(f"Error creating drawing: {str(e)}")
        return jsonify({"error": f"Failed to create drawing: {str(e)}"}), 400


@drawings_bp.route('/companies/<company_id>/drawings/<drawing_id>', methods=['GET'])
def get_drawing(company_id, drawing_id):
    """Get drawing details."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        drawing = Drawing.objects.get(id=drawing_id, company_id=company_id)
    except Drawing.DoesNotExist:
        return jsonify({"error": "Drawing not found"}), 404
    
    return jsonify({
        "id": str(drawing.id),
        "owner": {
            "id": str(drawing.owner.id),
            "username": drawing.owner.username
        },
        "date": drawing.date.isoformat() if drawing.date else None,
        "description": drawing.description,
        "amount": drawing.amount,
        "category": drawing.category,
        "transaction": {
            "id": str(drawing.transaction.id),
            "description": drawing.transaction.description,
            "amount": drawing.transaction.amount
        } if drawing.transaction else None,
        "created_by": drawing.created_by.username if drawing.created_by else None,
        "created_at": drawing.created_at.isoformat() if drawing.created_at else None
    })


@drawings_bp.route('/companies/<company_id>/drawings/<drawing_id>', methods=['PUT'])
def update_drawing(company_id, drawing_id):
    """Update a drawing."""
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
        drawing = Drawing.objects.get(id=drawing_id, company_id=company_id)
    except Drawing.DoesNotExist:
        return jsonify({"error": "Drawing not found"}), 404
    
    old_amount = drawing.amount
    
    # Update fields
    if 'date' in data:
        drawing.date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
    if 'description' in data:
        drawing.description = data['description']
    if 'amount' in data:
        new_amount = float(data['amount'])
        if new_amount <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
        drawing.amount = new_amount
    if 'category' in data:
        if data['category'] not in ['personal', 'equity', 'loan']:
            return jsonify({"error": "Invalid category"}), 400
        drawing.category = data['category']
    
    drawing.save()
    
    # Update linked transaction if exists
    if drawing.transaction and 'amount' in data:
        drawing.transaction.amount = drawing.amount
        drawing.transaction.save()
    
    # Update equity account if amount changed
    if 'amount' in data:
        _update_equity_account(
            company_id, 
            str(drawing.owner.id), 
            drawing_amount_change=drawing.amount - old_amount
        )
    
    return jsonify({
        "message": "Drawing updated successfully",
        "drawing": {
            "id": str(drawing.id),
            "date": drawing.date.isoformat(),
            "description": drawing.description,
            "amount": drawing.amount,
            "category": drawing.category
        }
    })


@drawings_bp.route('/companies/<company_id>/drawings/<drawing_id>', methods=['DELETE'])
def delete_drawing(company_id, drawing_id):
    """Delete a drawing."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        drawing = Drawing.objects.get(id=drawing_id, company_id=company_id)
    except Drawing.DoesNotExist:
        return jsonify({"error": "Drawing not found"}), 404
    
    owner_id = str(drawing.owner.id)
    amount = drawing.amount
    
    # Delete linked transaction if exists
    if drawing.transaction:
        drawing.transaction.delete()
    
    drawing.delete()
    
    # Update equity account
    _update_equity_account(company_id, owner_id, drawing_amount_change=-amount)
    
    return jsonify({"message": "Drawing deleted successfully"})


# =============================================================================
# Equity Account Endpoints
# =============================================================================

@drawings_bp.route('/companies/<company_id>/equity', methods=['GET'])
def list_equity_accounts(company_id):
    """List all equity accounts for a company."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    accounts = EquityAccount.objects(company_id=company_id)
    
    accounts_data = [{
        "id": str(acc.id),
        "owner": {
            "id": str(acc.owner.id),
            "username": acc.owner.username
        },
        "opening_balance": acc.opening_balance,
        "current_balance": acc.current_balance,
        "total_drawings": acc.total_drawings,
        "total_contributions": acc.total_contributions,
        "updated_at": acc.updated_at.isoformat() if acc.updated_at else None
    } for acc in accounts]
    
    return jsonify({
        "equity_accounts": accounts_data,
        "company_id": company_id
    })


@drawings_bp.route('/companies/<company_id>/equity/<owner_id>', methods=['GET'])
def get_equity_summary(company_id, owner_id):
    """Get equity account summary for a specific owner."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    valid, result = verify_company_access(current_user_id, company_id)
    if not valid:
        return jsonify({"error": result}), 403
    
    try:
        owner = User.objects.get(id=owner_id)
    except User.DoesNotExist:
        return jsonify({"error": "Owner not found"}), 404
    
    # Get or create equity account
    account = EquityAccount.objects(company_id=company_id, owner=owner_id).first()
    
    if not account:
        # Create new equity account
        company = Company.objects.get(id=company_id)
        account = EquityAccount(
            company_id=company,
            owner=owner
        ).save()
    
    # Get drawings breakdown
    drawings = Drawing.objects(company_id=company_id, owner=owner_id)
    
    by_category = {
        'personal': 0.0,
        'equity': 0.0,
        'loan': 0.0
    }
    
    for d in drawings:
        by_category[d.category] += d.amount
    
    # Get recent drawings
    recent_drawings = Drawing.objects(
        company_id=company_id, 
        owner=owner_id
    ).order_by('-date').limit(5)
    
    recent_data = [{
        "id": str(d.id),
        "date": d.date.isoformat() if d.date else None,
        "description": d.description,
        "amount": d.amount,
        "category": d.category
    } for d in recent_drawings]
    
    return jsonify({
        "owner": {
            "id": str(owner.id),
            "username": owner.username
        },
        "equity_account": {
            "opening_balance": account.opening_balance,
            "current_balance": account.current_balance,
            "total_drawings": account.total_drawings,
            "total_contributions": account.total_contributions
        },
        "drawings_by_category": by_category,
        "recent_drawings": recent_data,
        "company_id": company_id
    })


@drawings_bp.route('/companies/<company_id>/equity/<owner_id>', methods=['PUT'])
def update_equity_account(company_id, owner_id):
    """
    Update equity account (set opening balance or record contribution).
    
    Expected JSON body:
    {
        "opening_balance": 100000.00,
        "contribution": 25000.00
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
    
    try:
        owner = User.objects.get(id=owner_id)
        company = Company.objects.get(id=company_id)
    except User.DoesNotExist:
        return jsonify({"error": "Owner not found"}), 404
    except Company.DoesNotExist:
        return jsonify({"error": "Company not found"}), 404
    
    # Get or create equity account
    account = EquityAccount.objects(company_id=company_id, owner=owner_id).first()
    
    if not account:
        account = EquityAccount(
            company_id=company,
            owner=owner
        )
    
    # Update opening balance
    if 'opening_balance' in data:
        old_opening = account.opening_balance
        account.opening_balance = float(data['opening_balance'])
        # Adjust current balance
        account.current_balance += (account.opening_balance - old_opening)
    
    # Record contribution
    if 'contribution' in data:
        contribution = float(data['contribution'])
        if contribution <= 0:
            return jsonify({"error": "Contribution must be positive"}), 400
        account.total_contributions += contribution
        account.current_balance += contribution
    
    account.save()
    
    return jsonify({
        "message": "Equity account updated successfully",
        "equity_account": {
            "owner": owner.username,
            "opening_balance": account.opening_balance,
            "current_balance": account.current_balance,
            "total_drawings": account.total_drawings,
            "total_contributions": account.total_contributions
        }
    })


# =============================================================================
# Helper Functions
# =============================================================================

def _update_equity_account(
    company_id: str,
    owner_id: str,
    drawing_amount: float = 0.0,
    drawing_amount_change: float = 0.0
):
    """
    Update equity account after drawing changes.
    
    Args:
        company_id: Company ObjectId
        owner_id: Owner User ObjectId
        drawing_amount: New drawing amount (for new drawings)
        drawing_amount_change: Change in drawing amount (for updates/deletes)
    """
    try:
        account = EquityAccount.objects(company_id=company_id, owner=owner_id).first()
        
        if not account:
            company = Company.objects.get(id=company_id)
            owner = User.objects.get(id=owner_id)
            account = EquityAccount(
                company_id=company,
                owner=owner
            )
        
        if drawing_amount > 0:
            account.total_drawings += drawing_amount
            account.current_balance -= drawing_amount
        
        if drawing_amount_change != 0:
            account.total_drawings += drawing_amount_change
            account.current_balance -= drawing_amount_change
        
        account.save()
        
    except Exception as e:
        current_app.logger.error(f"Error updating equity account: {str(e)}")
