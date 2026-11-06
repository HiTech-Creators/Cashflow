"""
Bank Reconciliation Service for Flowback Cashflow API.

This module provides bank reconciliation functionality including:
- Automatic transaction matching
- Manual reconciliation support
- Reconciliation reporting
- Bank statement processing
"""

from datetime import timedelta
from typing import Dict, Any, List, Optional
from flask import current_app

from src.models import (
    BankStatement, ReconciliationItem, Transaction, Company, User, utc_now
)


class ReconciliationService:
    """
    Service for bank reconciliation operations.
    
    Matches bank transactions with system transactions and generates reports.
    """
    
    @staticmethod
    def auto_match_transactions(
        bank_statement_id: str,
        date_tolerance_days: int = 2,
        amount_tolerance: float = 0.01
    ) -> Dict[str, Any]:
        """
        Automatically match bank transactions with system transactions.
        
        Uses fuzzy matching on date and exact matching on amount.
        
        Args:
            bank_statement_id: The BankStatement ObjectId
            date_tolerance_days: Days variance allowed for date matching
            amount_tolerance: Amount variance allowed (for rounding differences)
        
        Returns:
            Dict with 'matched_count', 'unmatched_count', and 'matches' list
        """
        result = {
            'matched_count': 0,
            'unmatched_count': 0,
            'matches': [],
            'errors': []
        }
        
        try:
            bank_statement = BankStatement.objects.get(id=bank_statement_id)
        except BankStatement.DoesNotExist:
            result['errors'].append(f"Bank statement not found: {bank_statement_id}")
            return result
        
        # Get all pending items for this statement
        pending_items = ReconciliationItem.objects(
            bank_statement=bank_statement_id,
            status='pending'
        )
        
        for item in pending_items:
            try:
                # Calculate date range for matching
                date_start = item.bank_date - timedelta(days=date_tolerance_days)
                date_end = item.bank_date + timedelta(days=date_tolerance_days)
                
                # Determine transaction type based on bank amount
                abs_amount = abs(item.bank_amount)
                
                # Search for potential matches
                potential_matches = Transaction.objects(
                    company_id=item.company_id,
                    date__gte=date_start,
                    date__lte=date_end,
                    amount__gte=abs_amount - amount_tolerance,
                    amount__lte=abs_amount + amount_tolerance
                )
                
                # Filter by type (inflow for positive, outflow for negative)
                if item.bank_amount > 0:
                    potential_matches = potential_matches.filter(type='inflow')
                else:
                    potential_matches = potential_matches.filter(type='outflow')
                
                # Check if already matched to another reconciliation item
                matched_txn_ids = set(
                    str(ri.transaction.id) for ri in ReconciliationItem.objects(
                        company_id=item.company_id,
                        status='matched',
                        transaction__ne=None
                    )
                )
                
                available_matches = [
                    m for m in potential_matches 
                    if str(m.id) not in matched_txn_ids
                ]
                
                if len(available_matches) == 1:
                    # Single match - auto-reconcile
                    item.transaction = available_matches[0]
                    item.status = 'matched'
                    item.reconciled_at = utc_now()
                    item.save()
                    
                    result['matched_count'] += 1
                    result['matches'].append({
                        'reconciliation_item_id': str(item.id),
                        'transaction_id': str(available_matches[0].id),
                        'bank_description': item.bank_description,
                        'transaction_description': available_matches[0].description,
                        'amount': abs_amount
                    })
                elif len(available_matches) == 0:
                    # No matches found
                    item.status = 'unmatched'
                    item.save()
                    result['unmatched_count'] += 1
                else:
                    # Multiple potential matches - leave as pending for manual review
                    result['unmatched_count'] += 1
                    
            except Exception as e:
                result['errors'].append(f"Error matching item {item.id}: {str(e)}")
                current_app.logger.error(f"Auto-match error: {str(e)}")
        
        current_app.logger.info(
            f"Auto-matched {result['matched_count']} transactions for statement {bank_statement_id}"
        )
        
        return result
    
    @staticmethod
    def manual_match(
        reconciliation_item_id: str,
        transaction_id: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Manually match a reconciliation item to a transaction.
        
        Args:
            reconciliation_item_id: The ReconciliationItem ObjectId
            transaction_id: The Transaction ObjectId to match
            user_id: The user performing the reconciliation
            notes: Optional notes about the match
        
        Returns:
            Dict with success status and item details
        """
        try:
            item = ReconciliationItem.objects.get(id=reconciliation_item_id)
            transaction = Transaction.objects.get(id=transaction_id)
            user = User.objects.get(id=user_id)
        except ReconciliationItem.DoesNotExist:
            return {'success': False, 'error': 'Reconciliation item not found'}
        except Transaction.DoesNotExist:
            return {'success': False, 'error': 'Transaction not found'}
        except User.DoesNotExist:
            return {'success': False, 'error': 'User not found'}
        
        # Verify same company
        if str(item.company_id.id) != str(transaction.company_id.id):
            return {'success': False, 'error': 'Transaction does not belong to same company'}
        
        # Check if transaction is already matched
        existing_match = ReconciliationItem.objects(
            transaction=transaction_id,
            status='matched'
        ).first()
        
        if existing_match and str(existing_match.id) != reconciliation_item_id:
            return {
                'success': False, 
                'error': 'Transaction is already matched to another item'
            }
        
        # Perform the match
        item.transaction = transaction
        item.status = 'matched'
        item.reconciled_by = user
        item.reconciled_at = utc_now()
        if notes:
            item.notes = notes
        item.save()
        
        return {
            'success': True,
            'item': {
                'id': str(item.id),
                'bank_description': item.bank_description,
                'bank_amount': item.bank_amount,
                'transaction_id': str(transaction.id),
                'transaction_description': transaction.description,
                'status': item.status
            }
        }
    
    @staticmethod
    def unmatch(reconciliation_item_id: str, user_id: str) -> Dict[str, Any]:
        """
        Unmatch a reconciliation item.
        
        Args:
            reconciliation_item_id: The ReconciliationItem ObjectId
            user_id: The user performing the action
        
        Returns:
            Dict with success status
        """
        try:
            item = ReconciliationItem.objects.get(id=reconciliation_item_id)
        except ReconciliationItem.DoesNotExist:
            return {'success': False, 'error': 'Reconciliation item not found'}
        
        if item.status != 'matched':
            return {'success': False, 'error': 'Item is not currently matched'}
        
        item.transaction = None
        item.status = 'pending'
        item.reconciled_by = None
        item.reconciled_at = None
        item.save()
        
        return {'success': True, 'message': 'Item unmatched successfully'}
    
    @staticmethod
    def get_reconciliation_report(
        company_id: str,
        statement_id: str
    ) -> Dict[str, Any]:
        """
        Generate reconciliation report for a bank statement.
        
        Args:
            company_id: The Company ObjectId
            statement_id: The BankStatement ObjectId
        
        Returns:
            Dict with reconciliation summary and discrepancies
        """
        try:
            bank_statement = BankStatement.objects.get(id=statement_id)
        except BankStatement.DoesNotExist:
            return {'error': 'Bank statement not found'}
        
        items = ReconciliationItem.objects(
            company_id=company_id,
            bank_statement=statement_id
        )
        
        # Calculate totals
        total_bank_inflows = sum(
            i.bank_amount for i in items if i.bank_amount > 0
        )
        total_bank_outflows = sum(
            abs(i.bank_amount) for i in items if i.bank_amount < 0
        )
        
        matched_items = items.filter(status='matched')
        matched_amount = sum(abs(i.bank_amount) for i in matched_items)
        
        unmatched_items = items.filter(status='unmatched')
        pending_items = items.filter(status='pending')
        
        # Build discrepancies list
        discrepancies = []
        for item in unmatched_items:
            discrepancies.append({
                'id': str(item.id),
                'date': item.bank_date.isoformat() if item.bank_date else None,
                'description': item.bank_description,
                'amount': item.bank_amount,
                'reference': item.bank_reference
            })
        
        return {
            'statement': {
                'id': str(bank_statement.id),
                'bank_name': bank_statement.bank_name,
                'account_number': bank_statement.account_number[-4:] + '****',  # Mask
                'statement_date': bank_statement.statement_date.isoformat(),
                'opening_balance': bank_statement.opening_balance,
                'closing_balance': bank_statement.closing_balance
            },
            'summary': {
                'total_items': items.count(),
                'matched': matched_items.count(),
                'unmatched': unmatched_items.count(),
                'pending': pending_items.count(),
                'match_rate': round(
                    (matched_items.count() / items.count() * 100) if items.count() > 0 else 0,
                    2
                )
            },
            'totals': {
                'bank_inflows': total_bank_inflows,
                'bank_outflows': total_bank_outflows,
                'bank_net': total_bank_inflows - total_bank_outflows,
                'matched_amount': matched_amount,
                'expected_balance_change': bank_statement.closing_balance - bank_statement.opening_balance
            },
            'discrepancies': discrepancies
        }
    
    @staticmethod
    def create_reconciliation_items_from_data(
        bank_statement_id: str,
        company_id: str,
        items_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create reconciliation items from parsed bank statement data.
        
        Args:
            bank_statement_id: The BankStatement ObjectId
            company_id: The Company ObjectId
            items_data: List of dicts with date, description, amount, reference
        
        Returns:
            Dict with created items count and any errors
        """
        result = {
            'created_count': 0,
            'items': [],
            'errors': []
        }
        
        try:
            bank_statement = BankStatement.objects.get(id=bank_statement_id)
            company = Company.objects.get(id=company_id)
        except BankStatement.DoesNotExist:
            result['errors'].append('Bank statement not found')
            return result
        except Company.DoesNotExist:
            result['errors'].append('Company not found')
            return result
        
        for idx, data in enumerate(items_data):
            try:
                # Validate required fields
                if not data.get('date'):
                    result['errors'].append(f"Item {idx}: date is required")
                    continue
                if not data.get('description'):
                    result['errors'].append(f"Item {idx}: description is required")
                    continue
                if data.get('amount') is None:
                    result['errors'].append(f"Item {idx}: amount is required")
                    continue
                
                item = ReconciliationItem(
                    company_id=company,
                    bank_statement=bank_statement,
                    bank_date=data['date'],
                    bank_description=data['description'],
                    bank_amount=float(data['amount']),
                    bank_reference=data.get('reference'),
                    status='pending'
                ).save()
                
                result['created_count'] += 1
                result['items'].append({
                    'id': str(item.id),
                    'description': item.bank_description,
                    'amount': item.bank_amount
                })
                
            except Exception as e:
                result['errors'].append(f"Item {idx}: {str(e)}")
        
        return result
    
    @staticmethod
    def get_potential_matches(
        reconciliation_item_id: str,
        date_tolerance_days: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get list of potential transaction matches for manual review.
        
        Args:
            reconciliation_item_id: The ReconciliationItem ObjectId
            date_tolerance_days: Days variance to search
        
        Returns:
            List of potential transaction matches
        """
        try:
            item = ReconciliationItem.objects.get(id=reconciliation_item_id)
        except ReconciliationItem.DoesNotExist:
            return []
        
        date_start = item.bank_date - timedelta(days=date_tolerance_days)
        date_end = item.bank_date + timedelta(days=date_tolerance_days)
        abs_amount = abs(item.bank_amount)
        
        # Search with wider tolerance for manual matching
        potential_matches = Transaction.objects(
            company_id=item.company_id,
            date__gte=date_start,
            date__lte=date_end,
            amount__gte=abs_amount * 0.9,  # 10% tolerance
            amount__lte=abs_amount * 1.1
        )
        
        # Get already matched transaction IDs
        matched_txn_ids = set(
            str(ri.transaction.id) for ri in ReconciliationItem.objects(
                company_id=item.company_id,
                status='matched',
                transaction__ne=None
            )
        )
        
        matches = []
        for txn in potential_matches:
            if str(txn.id) in matched_txn_ids:
                continue
                
            # Calculate match score
            date_diff = abs((txn.date - item.bank_date).days)
            amount_diff = abs(txn.amount - abs_amount)
            
            score = 100
            score -= date_diff * 10  # -10 per day difference
            score -= (amount_diff / abs_amount) * 50 if abs_amount > 0 else 0
            
            matches.append({
                'transaction_id': str(txn.id),
                'date': txn.date.isoformat() if txn.date else None,
                'description': txn.description,
                'amount': txn.amount,
                'type': txn.type,
                'category': txn.category,
                'match_score': max(0, round(score, 2)),
                'is_already_matched': str(txn.id) in matched_txn_ids
            })
        
        # Sort by match score descending
        matches.sort(key=lambda x: x['match_score'], reverse=True)
        
        return matches


def get_reconciliation_service() -> ReconciliationService:
    """
    Factory function to get a ReconciliationService instance.
    
    Returns:
        ReconciliationService: Reconciliation service instance
    """
    return ReconciliationService()
