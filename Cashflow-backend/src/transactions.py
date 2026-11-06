from src.models import Transaction

def create_transaction(user_id, company_id, date, description, amount, transaction_type, category, currency='USD'):
    new_transaction = Transaction(
        user_id=user_id,
        company_id=company_id,
        date=date,
        description=description,
        amount=amount,
        type=transaction_type,
        category=category,
        currency=currency
    ).save()
    return new_transaction

def get_transactions(user_id, company_id=None, page=1, per_page=10):
    query = Transaction.objects(user_id=user_id).order_by('-date')
    if company_id:
        query = query.filter(company_id=company_id)
    total = query.count()
    items = query.skip((page-1)*per_page).limit(per_page)
    pages = (total + per_page - 1) // per_page
    return {'items': list(items), 'total': total, 'pages': pages}

def update_transaction(transaction_id, user_id, **kwargs):
    transaction = Transaction.objects(id=transaction_id, user_id=user_id).first_or_404()
    for key, value in kwargs.items():
        setattr(transaction, key, value)
    transaction.save()
    return transaction

def delete_transaction(transaction_id, user_id):
    transaction = Transaction.objects(id=transaction_id, user_id=user_id).first_or_404()
    transaction.delete()
