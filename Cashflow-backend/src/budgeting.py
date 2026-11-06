from src.models import Budget, Transaction
from datetime import datetime, timedelta

def create_budget(company_id, category, amount, period, created_by):
    budget = Budget(company_id=company_id, created_by=created_by, category=category, amount=amount, period=period).save()
    return budget

def get_budgets(company_id, period=None):
    query = Budget.objects(company_id=company_id)
    if period:
        query = query.filter(period=period)
    return query.all()

def calculate_variance(company_id, period):
    budgets = {b.category: b.amount for b in get_budgets(company_id, period)}
    start_date = datetime.strptime(period + '-01', '%Y-%m-%d').date()
    end_date = (start_date + timedelta(days=31)).replace(day=1) - timedelta(days=1)
    
    actuals = {}
    transactions = Transaction.objects(company_id=company_id, date__gte=start_date, date__lte=end_date)
    for t in transactions:
        if t.category not in actuals:
            actuals[t.category] = 0
        actuals[t.category] += t.amount
    
    variance = {cat: budgets.get(cat, 0) - actuals.get(cat, 0) for cat in set(budgets) | set(actuals)}
    return variance
