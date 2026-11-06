import pandas as pd
from flask import current_app,jsonify,request
import os
from werkzeug.utils import secure_filename
import csv
from src.transactions import create_transaction
import io

ALLOWED_TYPES = {
    "Cash-customer": ["cash", "customer", "receipt"],
    "Salary-suppliers": ["salary", "supplier", "employee", "payment"],
    "Interest-paid": ["interest", "paid"],
    "Income-tax": ["income", "tax"],
    "Other-cfo": ["operating", "cfo"],
    "Buy-property-equipments": ["buy", "purchase", "property", "equipment"],
    "Sell-property-equipments": ["sell", "sale", "property", "equipment"],
    "Buy-investment": ["buy", "purchase", "investment"],
    "Sell-investment": ["sell", "sale", "investment"],
    "Other-cfi": ["investing", "cfi"],
    "Issue-shares": ["issue", "share"],
    "borrowings": ["borrow", "loan"],
    "Repay-borrowings": ["repay", "repayment"],
    "Pay-dividends": ["pay", "dividend"],
    "Other-cff": ["financing", "cff"]
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'csv', 'xlsx', 'xls'}

def clean_data(df):
    try:
        df.columns = df.columns.str.lower()

        required_columns = ['date', 'amount']
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"'{col}' column not found in the uploaded file")

        if 'type' not in df.columns:
            current_app.logger.warning("'type' column not found. Adding it with default value 'Other-cfo'")
            df['type'] = 'Other-cfo'

        df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.strftime('%Y-%m-%d')

        df['amount'] = pd.to_numeric(df['amount'], errors='coerce')

        current_app.logger.info(f"Original types: {df['type'].unique().tolist()}")

        def map_type(type_value):
            type_value = str(type_value).lower()
            for allowed_type, keywords in ALLOWED_TYPES.items():
                if any(keyword in type_value for keyword in keywords):
                    return allowed_type
            return "Other-cfo"  
        df['type'] = df['type'].apply(map_type)

        current_app.logger.info(f"Unique types after mapping: {df['type'].unique().tolist()}")

        df_cleaned = df.dropna()
        current_app.logger.info(f"Data cleaning complete. Rows before: {len(df)}, Rows after: {len(df_cleaned)}")

        return df_cleaned

    except Exception as e:
        current_app.logger.error(f"Error in clean_data: {str(e)}")
        raise

def process_upload(file, user_id=None, company_id=None):
    """
    Process uploaded file and import transactions.
    
    Args:
        file: The uploaded file object
        user_id: The user ID for the transactions (optional, can be in file)
        company_id: The company ID for the transactions (optional, can be in file)
    
    Returns:
        dict: Result with message or error
    """
    from flask_jwt_extended import get_jwt_identity
    from flask import current_app
    
    # Get user_id from JWT if not provided
    if user_id is None:
        try:
            user_id = get_jwt_identity()
        except Exception:
            return {"error": "User ID required for import"}
    
    results = {
        'imported': 0,
        'failed': 0,
        'errors': []
    }
    
    try:
        if file.filename.endswith('.csv'):
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            
            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
                try:
                    # Use provided company_id or get from row
                    row_company_id = company_id or row.get('company_id')
                    if not row_company_id:
                        results['failed'] += 1
                        results['errors'].append(f"Row {row_num}: Missing company_id")
                        continue
                    
                    create_transaction(
                        user_id=user_id,
                        company_id=row_company_id,
                        date=row.get('date'),
                        description=row.get('description', ''),
                        amount=float(row.get('amount', 0)),
                        transaction_type=row.get('type', 'outflow'),
                        category=row.get('category', 'operating'),
                        currency=row.get('currency', 'USD')
                    )
                    results['imported'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Row {row_num}: {str(e)}")
            
            return {
                "message": f"Import completed: {results['imported']} imported, {results['failed']} failed",
                "details": results
            }
        
        elif file.filename.endswith(('.xlsx', '.xls')):
            # Handle Excel files
            df = pd.read_excel(file)
            df = clean_data(df)
            
            for idx, row in df.iterrows():
                try:
                    row_company_id = company_id or row.get('company_id')
                    if not row_company_id:
                        results['failed'] += 1
                        results['errors'].append(f"Row {idx + 2}: Missing company_id")
                        continue
                    
                    create_transaction(
                        user_id=user_id,
                        company_id=row_company_id,
                        date=row['date'],
                        description=row.get('description', ''),
                        amount=float(row['amount']),
                        transaction_type=row.get('type', 'outflow'),
                        category=row.get('category', 'operating'),
                        currency=row.get('currency', 'USD')
                    )
                    results['imported'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Row {idx + 2}: {str(e)}")
            
            return {
                "message": f"Import completed: {results['imported']} imported, {results['failed']} failed",
                "details": results
            }
        
        return {"error": "Unsupported file type. Use CSV or Excel files."}
    
    except Exception as e:
        current_app.logger.error(f"Error processing upload: {str(e)}")
        return {"error": f"Failed to process file: {str(e)}"}