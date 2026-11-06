from anthropic import Anthropic
from flask import current_app
import json
import ast
from datetime import datetime, timedelta
import numpy as np
import warnings
from typing import Dict, List, Any, Optional, Tuple

# Try to import statsmodels for seasonal decomposition
try:
    from statsmodels.tsa.seasonal import seasonal_decompose
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False
    # Warning will be logged when analyze_patterns is called


def safe_polyfit(x, y, degree=1):
    """
    Perform polynomial fit with robust error handling.
    Returns coefficients or fallback values if fitting fails.
    """
    if len(x) < 2 or len(y) < 2:
        return [0, y[0] if y else 0]
    
    # Check for constant data
    y_array = np.array(y, dtype=np.float64)
    if np.std(y_array) < 1e-10:
        return [0, float(y_array[0])]
    
    # Normalize data to avoid numerical issues
    x_array = np.array(x, dtype=np.float64)
    x_mean = np.mean(x_array)
    x_std = np.std(x_array) or 1.0
    y_mean = np.mean(y_array)
    y_std = np.std(y_array) or 1.0
    
    x_norm = (x_array - x_mean) / x_std
    y_norm = (y_array - y_mean) / y_std
    
    try:
        # Suppress warnings during polyfit
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            coeffs_norm = np.polyfit(x_norm, y_norm, degree, rcond=None)
        
        # Denormalize coefficients
        if degree == 1:
            slope_norm, intercept_norm = coeffs_norm
            slope = slope_norm * y_std / x_std
            intercept = y_mean - slope * x_mean + intercept_norm * y_std
            
            if np.isfinite(slope) and np.isfinite(intercept):
                return [float(slope), float(intercept)]
    except Exception:
        pass
    
    # Fallback: simple linear regression using least squares formula
    try:
        n = len(y_array)
        sum_x = np.sum(x_array)
        sum_y = np.sum(y_array)
        sum_xy = np.sum(x_array * y_array)
        sum_xx = np.sum(x_array * x_array)
        
        denom = n * sum_xx - sum_x * sum_x
        if abs(denom) > 1e-10:
            slope = (n * sum_xy - sum_x * sum_y) / denom
            intercept = (sum_y - slope * sum_x) / n
            if np.isfinite(slope) and np.isfinite(intercept):
                return [float(slope), float(intercept)]
    except Exception:
        pass
    
    # Ultimate fallback
    return [0, float(y[0]) if y else 0]

class FinancialAnalytics:
    def __init__(self, api_key):
        self.anthropic = Anthropic(api_key=api_key)
        self.seasonal_periods = 12 # Monthly seasonality
        self.model = "claude-sonnet-4-5-20250929"

    def analyze_patterns(self, transaction_history):
        """Analyze transaction patterns and seasonality"""
        if not transaction_history:
            return {
                'seasonal_pattern': [],
                'trend': [0, 0],
                'volatility': 0
            }
        
        amounts = [t['amount'] for t in transaction_history]
        
        # Clean data: remove NaN, Inf values
        clean_amounts = []
        for a in amounts:
            try:
                val = float(a)
                if np.isfinite(val):
                    clean_amounts.append(val)
            except (ValueError, TypeError):
                continue
        
        if not clean_amounts:
            return {
                'seasonal_pattern': [],
                'trend': [0, 0],
                'volatility': 0
            }
        
        amounts = clean_amounts
        
        # Detect seasonality using statsmodels if available
        seasonal_pattern = []
        if HAS_STATSMODELS and len(amounts) >= self.seasonal_periods * 2:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    decomposition = seasonal_decompose(
                        amounts, 
                        period=self.seasonal_periods,
                        model='additive',
                        extrapolate_trend='freq'
                    )
                    seasonal_pattern = [x for x in decomposition.seasonal.tolist() if np.isfinite(x)]
            except Exception as e:
                current_app.logger.warning(f"Seasonal decomposition failed: {str(e)}")
                seasonal_pattern = []
        
        # Calculate trend using safe polyfit
        trend = safe_polyfit(range(len(amounts)), amounts, degree=1)
        
        # Calculate volatility safely
        try:
            volatility = float(np.std(amounts)) if len(amounts) > 1 else 0
            if not np.isfinite(volatility):
                volatility = 0
        except Exception:
            volatility = 0

        return {
            'seasonal_pattern': seasonal_pattern,
            'trend': trend,
            'volatility': volatility
        }
    
    def calculate_risk_metrics(self, cash_flows, working_capital):
        """Calculate various risk metrics"""
        # Clean cash flows - remove NaN/Inf
        clean_flows = []
        for cf in cash_flows:
            try:
                val = float(cf)
                if np.isfinite(val):
                    clean_flows.append(val)
            except (ValueError, TypeError):
                continue
        
        cash_flows = clean_flows if clean_flows else [0]
        
        # Avoid division by zero for liquidity ratio
        current_liabilities = working_capital.get('current_liabilities', 0)
        current_assets = working_capital.get('current_assets', 0)
        liquidity_ratio = (current_assets / current_liabilities 
                          if current_liabilities > 0 else 9999.99)
        
        # Calculate burn rate (average of negative cash flows)
        negative_flows = [cf for cf in cash_flows if cf < 0]
        burn_rate = float(abs(sum(negative_flows)) / len(cash_flows)) if negative_flows and len(cash_flows) > 0 else 0
        
        # Avoid division by zero for runway months
        min_cash_flow = min(cash_flows) if cash_flows else 0
        cash_amount = working_capital.get('cash', 0)
        runway_months = (cash_amount / abs(min_cash_flow) 
                        if min_cash_flow < 0 else 999.99)
        
        # Calculate volatility safely
        try:
            volatility = float(np.std(cash_flows)) if len(cash_flows) > 1 else 0
            if not np.isfinite(volatility):
                volatility = 0
        except Exception:
            volatility = 0
        
        return {
            'liquidity_ratio': float(liquidity_ratio) if np.isfinite(liquidity_ratio) else 9999.99,
            'cash_flow_volatility': volatility,
            'burn_rate': float(burn_rate) if np.isfinite(burn_rate) else 0,
            'runway_months': float(runway_months) if np.isfinite(runway_months) else 999.99
        }

    def generate_advanced_financial_analysis(self, initial_balance, current_balance, transaction_history, working_capital):
        patterns = self.analyze_patterns(transaction_history)
        risk_metrics = self.calculate_risk_metrics(
            [t['amount'] for t in transaction_history],
            working_capital
        )

        prompt = f"""As a financial analyst, provide a concise analysis of the following financial data:

        Financial Metrics:
        - Initial Balance: ${initial_balance}
        - Current Balance: ${current_balance}
        - Liquidity Ratio: {risk_metrics['liquidity_ratio']:.2f}
        - Cash Runway: {risk_metrics['runway_months']:.2f} months

        Pattern Analysis:
        - Seasonal Pattern: {patterns['seasonal_pattern']}
        - Trend: {patterns['trend']}
        - Volatility: {patterns['volatility']:.2f}

        Please provide a brief, bullet-point analysis covering:
        1. Pattern Recognition Analysis (identify recurring patterns and anomalies)
        2. Risk Assessment (evaluate liquidity and cash flow risks)
        3. Seasonal Trends (analyze monthly/quarterly patterns)
        4. Working Capital Optimization (suggest improvements)
        5. 90-day Forecast (based on historical patterns)

        Format the response with clear sections and actionable insights."""

        try:
            message = self.anthropic.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2000,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            analysis_result = {
                'ai_analysis': message.content[0].text,
                'patterns': patterns,
                'risk_metrics': risk_metrics,
                'forecasts': self.generate_forecasts(transaction_history, patterns)
            }
            return analysis_result
        except Exception as e:
            current_app.logger.error(f"Analysis failed: {str(e)}")
            import traceback
            current_app.logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def generate_forecasts(self, transaction_history, patterns):
        """Generate detailed forecasts using pattern analysis"""
        if not transaction_history:
            return {
                '30_days': [0] * 30,
                '60_days': [0] * 60,
                '90_days': [0] * 90
            }
        
        recent_transactions = transaction_history[-90:]  # Last 90 days
        trend = patterns.get('trend', [0, 0])
        seasonal_pattern = patterns.get('seasonal_pattern', [])
        
        forecasts = {
            '30_days': [],
            '60_days': [],
            '90_days': []
        }
        
        # Calculate base trend safely
        if isinstance(trend, (list, tuple)) and len(trend) >= 2:
            slope = float(trend[0]) if np.isfinite(float(trend[0])) else 0
            intercept = float(trend[1]) if np.isfinite(float(trend[1])) else 0
        else:
            slope = 0
            intercept = 0
        
        # Generate daily forecasts for next 90 days
        for day in range(90):
            # Calculate trend component
            trend_value = slope * (len(recent_transactions) + day) + intercept
            
            # Add seasonal component if available
            seasonal_value = 0
            if seasonal_pattern:
                seasonal_idx = day % len(seasonal_pattern)
                seasonal_value = seasonal_pattern[seasonal_idx]
            
            # Combine trend and seasonality
            forecast_value = trend_value + seasonal_value
            
            # Add to appropriate forecast period
            if day < 30:
                forecasts['30_days'].append(forecast_value)
            if day < 60:
                forecasts['60_days'].append(forecast_value)
            forecasts['90_days'].append(forecast_value)
        
        return forecasts

    def generate_cashflow_statement(self, initial_balance, start_date, end_date, transaction_data):
        """Generate a cash flow statement with strict categorization and proper financial reporting structure."""
        # Parse transaction data into a structured format
        transactions = []
        for line in transaction_data.split('\n'):
            if line.strip():
                parts = line.split(', ')
                transaction = {}
                for part in parts:
                    key, value = part.split(': ', 1)
                    transaction[key.lower()] = value
                transactions.append(transaction)

        # Define the categorization structure exactly matching utils.py
        categories = {
            'CFO': {
                'types': ["Cash-customer", "Salary-suppliers", "Income-tax", "Other-cfo"],
                'items': []
            },
            'CFI': {
                'types': ["Buy-property-equipments", "Sell-property-equipments", "Buy-investment", "Sell-investment", "Other-cfi"],
                'items': []
            },
            'CFF': {
                'types': ["Issue-shares", "borrowings", "Repay-borrowings", "Pay-dividends", "Interest-paid", "Other-cff"],
                'items': []
            }
        }

        # Categorize transactions strictly by type
        for t in transactions:
            t_type = t['type']
            t_amount = float(t['amount'])
            t_date = t['date']
            t_desc = t['description']

            for category, info in categories.items():
                if t_type in info['types']:
                    info['items'].append({
                        'type': t_type,
                        'amount': t_amount,
                        'date': t_date,
                        'description': t_desc
                    })

        # Calculate totals
        statement_data = []
        category_totals = {'CFO': 0, 'CFI': 0, 'CFF': 0}

        # Process each category
        for category, info in categories.items():
            # Group transactions by type within each category
            type_totals = {}
            for item in info['items']:
                t_type = item['type']
                if t_type not in type_totals:
                    type_totals[t_type] = 0
                type_totals[t_type] += item['amount']

            # Add each type's total to the statement
            for t_type, total in type_totals.items():
                statement_data.append({
                    'Category': category,
                    'Subcategory': t_type,
                    'Amount': total
                })
                category_totals[category] += total

        # Calculate final totals
        total_net_cash_flow = sum(category_totals.values())
        ending_balance = initial_balance + total_net_cash_flow

        return statement_data, ending_balance

    # ====== NEW AI FEATURES ======
    
    def auto_categorize_transaction(self, description: str, amount: float, merchant: Optional[str] = None) -> Dict[str, Any]:
        """
        Smart Transaction Categorization using AI.
        
        Automatically categorize transactions based on description and amount patterns.
        Returns category, type, suggested tags, and confidence score.
        """
        prompt = f"""Analyze this financial transaction and categorize it:

Transaction Details:
- Description: {description}
- Amount: ${amount}
- Merchant: {merchant or 'Unknown'}

Categorize this transaction strictly using these categories:
- Type: "inflow" or "outflow"
- Category: Choose from: ["Cash-customer", "Salary-suppliers", "Income-tax", "Other-cfo", 
  "Buy-property-equipments", "Sell-property-equipments", "Buy-investment", "Sell-investment", "Other-cfi",
  "Issue-shares", "borrowings", "Repay-borrowings", "Pay-dividends", "Interest-paid", "Other-cff"]
- Suggested Tags: Array of 2-4 relevant tags for filtering (e.g., ["payroll", "monthly", "recurring"])
- Confidence: A score between 0 and 1 (0.0 to 1.0)

Return ONLY a valid JSON object with this exact structure:
{{
  "type": "inflow or outflow",
  "category": "one of the categories above",
  "suggested_tags": ["tag1", "tag2"],
  "confidence": 0.95,
  "reasoning": "Brief explanation of categorization"
}}"""

        try:
            message = self.anthropic.messages.create(
                model=self.model,
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Parse JSON response
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(response_text)
            
            # Validate response
            if not all(key in result for key in ['type', 'category', 'suggested_tags', 'confidence']):
                raise ValueError("Missing required fields in AI response")
            
            return result
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse AI categorization response: {str(e)}")
            # Return fallback categorization
            return {
                "type": "outflow" if amount < 0 else "inflow",
                "category": "Other-cfo",
                "suggested_tags": ["uncategorized"],
                "confidence": 0.3,
                "reasoning": "AI categorization failed, using fallback"
            }
        except Exception as e:
            current_app.logger.error(f"Auto-categorization failed: {str(e)}")
            raise

    def detect_anomalies(self, transactions: List[Dict[str, Any]], company_id: str) -> List[Dict[str, Any]]:
        """
        Anomaly Detection using AI.
        
        Detects unusual transactions that may indicate fraud, errors, or unusual business activity.
        Returns array of detected anomalies with severity and recommendations.
        """
        if not transactions:
            return []
        
        # Prepare transaction summary
        transaction_summary = []
        for t in transactions[:100]:  # Limit to 100 most recent
            transaction_summary.append({
                "id": str(t.get('id', t.get('_id', 'unknown'))),
                "date": t.get('date'),
                "description": t.get('description', ''),
                "amount": t.get('amount', 0),
                "type": t.get('type', '')
            })
        
        # Calculate statistics
        amounts = [abs(t.get('amount', 0)) for t in transactions]
        mean_amount = np.mean(amounts) if amounts else 0
        std_amount = np.std(amounts) if amounts else 0
        
        prompt = f"""Analyze these transactions for anomalies and unusual patterns:

Transaction Statistics:
- Total Transactions: {len(transactions)}
- Average Amount: ${mean_amount:.2f}
- Standard Deviation: ${std_amount:.2f}

Recent Transactions (last 100):
{json.dumps(transaction_summary, indent=2)}

Identify and return a JSON array of anomalies. Look for:
1. Duplicate or near-duplicate entries (same amount, description, close dates)
2. Amounts significantly outside normal range (> 3 standard deviations)
3. Suspicious patterns (round numbers, repeated amounts, suspicious descriptions)
4. Potential data entry errors (unusual amounts, missing info)
5. Unusual frequency or timing

For each anomaly found, return:
{{
  "transaction_id": "id",
  "type": "duplicate|outlier|suspicious_pattern|data_error|unusual_frequency",
  "severity": "low|medium|high",
  "description": "What makes this anomalous",
  "recommended_action": "What user should do"
}}

Return ONLY a valid JSON array. If no anomalies found, return empty array []."""

        try:
            message = self.anthropic.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Clean JSON markdown if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            anomalies = json.loads(response_text)
            
            # Ensure it's an array
            if not isinstance(anomalies, list):
                anomalies = [anomalies]
            
            return anomalies
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse anomaly detection response: {str(e)}")
            return []
        except Exception as e:
            current_app.logger.error(f"Anomaly detection failed: {str(e)}")
            raise

    def financial_chatbot(self, user_query: str, financial_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Conversational Finance Assistant.
        
        Natural language interface for financial queries and actions.
        Returns natural language response with optional structured data and actions.
        """
        prompt = f"""You are a financial assistant for a cash flow management system.

Company Financial Context:
- Current Balance: ${financial_context.get('balance', 0):.2f}
- Monthly Revenue (avg): ${financial_context.get('monthly_revenue', 0):.2f}
- Monthly Expenses (avg): ${financial_context.get('monthly_expenses', 0):.2f}
- Burn Rate: ${financial_context.get('burn_rate', 0):.2f}/month
- Cash Runway: {financial_context.get('runway_months', 0):.1f} months
- Total Transactions: {financial_context.get('total_transactions', 0)}
- Recent Activity: {financial_context.get('recent_activity', 'Normal')}

User Query: "{user_query}"

Provide a helpful, conversational response. If the user wants to:
- Query data: Provide the answer with relevant numbers
- Create/modify data: Return a structured action
- Get insights: Provide analysis and recommendations

Return a JSON object with this structure:
{{
  "answer": "Natural language response to the user",
  "data": {{...}},  // Relevant financial data if applicable
  "action": {{...}},  // If user wants to create/modify data
  "insights": ["insight1", "insight2"],  // Optional financial insights
  "follow_up_questions": ["question1", "question2"]  // Suggested follow-up questions
}}"""

        try:
            message = self.anthropic.messages.create(
                model=self.model,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Clean JSON markdown if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(response_text)
            
            return result
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse chatbot response: {str(e)}")
            return {
                "answer": "I'm having trouble processing your request right now. Please try rephrasing your question.",
                "data": {},
                "action": None,
                "insights": [],
                "follow_up_questions": []
            }
        except Exception as e:
            current_app.logger.error(f"Chatbot query failed: {str(e)}")
            raise

    def generate_smart_insights(self, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Smart Insights & Alerts.
        
        Generates proactive financial insights and alerts about financial health.
        Returns categorized insights with severity levels.
        """
        prompt = f"""Analyze this company's financial data and provide actionable insights:

Financial Overview:
- Current Balance: ${financial_data.get('current_balance', 0):.2f}
- Monthly Cash Flow: ${financial_data.get('monthly_cash_flow', 0):.2f}
- Revenue Trend: {financial_data.get('revenue_trend', 'stable')}
- Expense Trend: {financial_data.get('expense_trend', 'stable')}
- Burn Rate: ${financial_data.get('burn_rate', 0):.2f}/month
- Cash Runway: {financial_data.get('runway_months', 0):.1f} months
- Liquidity Ratio: {financial_data.get('liquidity_ratio', 1.0):.2f}

Recent Patterns:
- Largest Expenses: {json.dumps(financial_data.get('top_expenses', []))}
- Revenue Sources: {json.dumps(financial_data.get('revenue_sources', []))}
- Upcoming Obligations: {json.dumps(financial_data.get('upcoming_obligations', []))}

Provide insights in these categories:

1. ALERTS: Immediate concerns (cash flow issues, upcoming shortfalls)
2. OPPORTUNITIES: Ways to optimize cash flow
3. TRENDS: Important patterns to note
4. RECOMMENDATIONS: Specific action items

Return as JSON:
{{
  "alerts": [
    {{
      "title": "Alert title",
      "message": "Detailed message",
      "severity": "low|medium|high|critical",
      "action_required": true/false,
      "suggested_action": "What to do"
    }}
  ],
  "opportunities": [...],
  "trends": [...],
  "recommendations": [...]
}}"""

        try:
            message = self.anthropic.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Clean JSON markdown if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            insights = json.loads(response_text)
            
            # Add timestamp
            insights['generated_at'] = datetime.utcnow().isoformat()
            
            return insights
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse insights response: {str(e)}")
            return {
                "alerts": [],
                "opportunities": [],
                "trends": [],
                "recommendations": [],
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            current_app.logger.error(f"Insight generation failed: {str(e)}")
            raise

    def enhance_transaction_description(self, transaction: Dict[str, Any]) -> str:
        """
        Smart Transaction Description Enhancement.
        
        Improves transaction descriptions for better searchability and clarity.
        Returns enhanced description string.
        """
        prompt = f"""Enhance this transaction description to make it more clear and searchable:

Original Description: "{transaction.get('description', '')}"
Amount: ${transaction.get('amount', 0):.2f}
Type: {transaction.get('type', '')}
Date: {transaction.get('date', '')}
Category: {transaction.get('category', '')}

Create an enhanced description that:
- Clarifies what was purchased/received
- Adds relevant context
- Maintains brevity (max 100 characters)
- Improves searchability
- Is professional and clear

Return ONLY the enhanced description text, nothing else."""

        try:
            message = self.anthropic.messages.create(
                model=self.model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )
            
            enhanced = message.content[0].text.strip()
            
            # Remove quotes if present
            enhanced = enhanced.strip('"').strip("'")
            
            # Limit length
            if len(enhanced) > 100:
                enhanced = enhanced[:97] + "..."
            
            return enhanced
            
        except Exception as e:
            current_app.logger.error(f"Description enhancement failed: {str(e)}")
            # Return original description as fallback
            return transaction.get('description', 'Unknown transaction')

def parse_response(response):
    lines = response.strip().split('\n')
    statement_data = []
    totals = {}

    for line in lines:
        try:
            if ':' not in line:
                continue
            
            if line.count(':') == 2:  # This is a transaction line
                category, subcategory_and_amount = line.split(':', 1)
                subcategory, amount_str = subcategory_and_amount.rsplit(':', 1)
                
                category = category.strip()
                subcategory = subcategory.strip()
                amount = parse_amount(amount_str)
                
                statement_data.append({
                    'Category': category,
                    'Subcategory': subcategory,
                    'Amount': amount
                })
            elif line.count(':') == 1:  # This is a total line
                key, value_str = line.split(':')
                key = key.strip()
                value = parse_amount(value_str)
                totals[key] = value
        except Exception as e:
            current_app.logger.warning(f"Error parsing line '{line}': {str(e)}")

    if not statement_data:
        current_app.logger.error("No valid statement data found in response")
    if not totals:
        current_app.logger.error("No valid totals found in response")

    return statement_data, totals

def parse_amount(amount_str):
    try:
        return float(amount_str.replace('$', '').replace(',', '').strip())
    except ValueError:
        current_app.logger.warning(f"Could not parse amount: {amount_str}")
        return 0.0