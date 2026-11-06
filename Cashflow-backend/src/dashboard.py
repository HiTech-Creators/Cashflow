from src.models import Transaction, InitialBalance
from src.utils import calculate_totals, calculate_burn_rate, calculate_runway

def get_kpis(user_id, company_id=None):
    query = Transaction.objects()
    if company_id:
        query = query.filter(company_id=company_id)
    transactions = query.all()
    
    initial_balance_query = InitialBalance.objects()
    if company_id:
        initial_balance_query = initial_balance_query.filter(company_id=company_id)
    # Assuming one initial balance per company; if multiple, sum them
    initial_balance_records = initial_balance_query.all()
    initial_balance = sum(record.balance for record in initial_balance_records) if initial_balance_records else 0.0
    
    total_cfo, total_cfi, total_cff = calculate_totals(transactions)
    net_cash = total_cfo + total_cfi + total_cff
    current_balance = initial_balance + net_cash
    
    current_assets = current_balance
    current_liabilities = 0
    current_ratio = current_assets / current_liabilities if current_liabilities > 0 else 'Infinite'
    
    burn_rate = calculate_burn_rate(user_id, company_id)
    runway = calculate_runway(user_id, company_id, current_balance)
    
    return {
        "net_cash": net_cash,
        "current_balance": current_balance,
        "current_ratio": current_ratio,
        "burn_rate": burn_rate,
        "runway": runway
    }
