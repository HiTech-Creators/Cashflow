from datetime import datetime, timedelta
from src.models import Forecast
from src.anthropic_service import FinancialAnalytics
from src.config import Config

def generate_forecast(transactions, months=12, scenario_params=None):
    if not transactions:
        return {}
    
    monthly_net = {}
    for t in transactions:
        date_value = t.get('date')
        amount_value = t.get('amount', 0)
        if not date_value:
            continue

        if isinstance(date_value, str):
            month = datetime.strptime(date_value, '%Y-%m-%d').strftime('%Y-%m')
        else:
            month = date_value.strftime('%Y-%m')

        monthly_net[month] = monthly_net.get(month, 0) + amount_value

    # Handle empty monthly_net after processing
    if not monthly_net:
        return {}
    
    if len(monthly_net) < 2:
        avg_change = 0
    else:
        changes = [monthly_net[m] for m in sorted(monthly_net.keys())]
        avg_change = sum(changes) / len(changes)
    
    adjustment = 1.0
    if scenario_params and 'sales_drop' in scenario_params:
        adjustment = 1 - (scenario_params['sales_drop'] / 100)
    
    last_month = max(datetime.strptime(m, '%Y-%m') for m in monthly_net)
    projected = {}
    current_balance = sum(monthly_net.values())
    for i in range(1, months + 1):
        next_month = last_month + timedelta(days=30 * i)
        month_key = next_month.strftime('%Y-%m')
        projected_change = avg_change * adjustment
        current_balance += projected_change
        projected[month_key] = current_balance
    
    return projected

def ai_forecast(historical_data, months=12, scenario_params=None):
    if not historical_data:
        return {}
    
    api_key = Config.ANTHROPIC_API_KEY
    analytics = FinancialAnalytics(api_key)
    
    initial_balance = 0 
    current_balance = sum(d['amount'] for d in historical_data)
    working_capital = {'current_assets': current_balance, 'current_liabilities': 0, 'cash': current_balance}
    
    analysis = analytics.generate_advanced_financial_analysis(
        initial_balance, current_balance, historical_data, working_capital
    )
    
    projections = analysis['forecasts']['90_days'][:months]  # Take first months
    if scenario_params and 'sales_drop' in scenario_params:
        adjustment = 1 - (scenario_params['sales_drop'] / 100)
        projections = [p * adjustment for p in projections]
    
    # Get the first item to check date type, then find max date
    first_item = historical_data[0]
    if isinstance(first_item['date'], datetime):
        last_date = max(d['date'] for d in historical_data)
    else:
        last_date = max(datetime.strptime(d['date'], '%Y-%m-%d') for d in historical_data)

    formatted = {}
    for i, proj in enumerate(projections, 1):
        next_month = last_date + timedelta(days=30 * i)
        formatted[next_month.strftime('%Y-%m')] = proj
    
    return formatted

def save_forecast(user_id, company_id, scenario_name, projections):
    forecast = Forecast(
        user_id=user_id,
        company_id=company_id,
        scenario_name=scenario_name,
        projections=projections
    ).save()
    return forecast
