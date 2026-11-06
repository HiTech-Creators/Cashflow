import mongoengine as me
from datetime import datetime, timezone


def utc_now():
    """Return current UTC time. Compatible with Python 3.12+."""
    return datetime.now(timezone.utc)

class Role(me.Document):
    name = me.StringField(required=True)
    level = me.IntField(required=True)  
    permissions = me.ListField(me.StringField()) 
    
    meta = {
        'indexes': [
            'name',
            'level',
            ('name', 'level')  
        ]
    }

class CompanyMembership(me.EmbeddedDocument):
    company_id = me.ReferenceField('Company', required=True)
    role = me.StringField(required=True, choices=['admin', 'user'])  # Company-level role
    joined_at = me.DateTimeField(default=utc_now)
    invited_by = me.ReferenceField('User')

class User(me.Document):
    username = me.StringField(unique=True, required=True)
    email = me.EmailField(unique=True, required=True)
    password_hash = me.StringField(required=True)
    role_id = me.ReferenceField(Role, required=True)
    is_active = me.BooleanField(default=True)
    created_by = me.ReferenceField('User')
    created_at = me.DateTimeField(default=utc_now)
    
    company_memberships = me.ListField(me.EmbeddedDocumentField(CompanyMembership))
    
    forecasts = me.ListField(me.ReferenceField('Forecast'))
    
    meta = {
        'indexes': [
            'username', 
            'email', 
            'role_id',
            'is_active',
            ('email', 'is_active'), 
            'company_memberships.company_id' 
        ]
    }

class Company(me.Document):
    name = me.StringField(required=True)
    currency = me.StringField(default='USD')
    created_by = me.ReferenceField(User, required=True) 
    created_at = me.DateTimeField(default=utc_now)
    is_active = me.BooleanField(default=True)
    
    settings = me.DictField()
    
    transactions = me.ListField(me.ReferenceField('Transaction'))
    forecasts = me.ListField(me.ReferenceField('Forecast'))
    receivables = me.ListField(me.ReferenceField('Receivable'))
    payables = me.ListField(me.ReferenceField('Payable'))
    inventory = me.ListField(me.ReferenceField('Inventory'))
    budgets = me.ListField(me.ReferenceField('Budget'))
    
    meta = {
        'indexes': [
            'name',
            'is_active',
            'created_by',
            ('is_active', 'created_at') 
        ]
    }

class Transaction(me.Document):
    user_id = me.ReferenceField(User, required=True) 
    company_id = me.ReferenceField(Company, required=True)
    date = me.DateTimeField(required=True)
    description = me.StringField(required=True)
    amount = me.FloatField(required=True)
    type = me.StringField(required=True, choices=['inflow', 'outflow'])
    category = me.StringField(required=True)
    currency = me.StringField(default='USD', required=True)
    created_at = me.DateTimeField(default=utc_now)
    updated_at = me.DateTimeField(default=utc_now)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    meta = {
        'indexes': [
            'user_id',
            'company_id',
            ('user_id', 'company_id'),  
            '-date', 
            ('company_id', '-date'),
            ('user_id', 'company_id', '-date'), 
            'type',
            'category',
            ('company_id', 'type'),  
            ('company_id', 'category'),
            ('user_id', 'company_id', 'date'),
        ]
    }

class InitialBalance(me.Document):
    user_id = me.ReferenceField(User, required=True)
    company_id = me.ReferenceField(Company, required=True) 
    balance = me.FloatField(required=True)
    
    meta = {
        'indexes': [
            'user_id',
            'company_id',
            ('user_id', 'company_id') 
        ]
    }

class UserPreferences(me.Document):
    user_id = me.ReferenceField(User, required=True)
    modules = me.ListField(me.StringField())
    email_notifications = me.BooleanField(default=True)
    
    meta = {
        'indexes': ['user_id']
    }

class Forecast(me.Document):
    user_id = me.ReferenceField(User, required=True)
    company_id = me.ReferenceField(Company, required=True)
    scenario_name = me.StringField(required=True)
    projections = me.DictField(required=True)
    created_at = me.DateTimeField(default=utc_now)
    
    meta = {
        'indexes': [
            'user_id',
            'company_id',
            ('user_id', 'company_id'),
            ('company_id', '-created_at') 
        ]
    }


class Receivable(me.Document):
    company_id = me.ReferenceField(Company, required=True)
    created_by = me.ReferenceField(User, required=True)
    amount = me.FloatField(required=True)
    due_date = me.DateTimeField(required=True)
    status = me.StringField(default='pending')
    description = me.StringField()
    
    meta = {
        'indexes': [
            'company_id',
            'status',
            'due_date',
            ('company_id', 'status'),
            ('company_id', 'due_date'), 
            ('company_id', 'status', 'due_date') 
        ]
    }

class Payable(me.Document):
    company_id = me.ReferenceField(Company, required=True)
    created_by = me.ReferenceField(User, required=True)
    amount = me.FloatField(required=True)
    due_date = me.DateTimeField(required=True)
    status = me.StringField(default='pending')
    description = me.StringField()
    
    meta = {
        'indexes': [
            'company_id',
            'status',
            'due_date',
            ('company_id', 'status'),
            ('company_id', 'due_date'), 
            ('company_id', 'status', 'due_date') 
        ]
    }

class Inventory(me.Document):
    company_id = me.ReferenceField(Company, required=True)
    created_by = me.ReferenceField(User, required=True)
    item_name = me.StringField(required=True)
    quantity = me.IntField(required=True)
    value = me.FloatField(required=True)
    last_updated = me.DateTimeField(default=utc_now)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update last_updated field."""
        self.last_updated = utc_now()
        return super().save(*args, **kwargs)
    
    meta = {
        'indexes': [
            'company_id',
            'item_name',
            ('company_id', 'item_name'),
            ('company_id', '-last_updated') 
        ]
    }

class Budget(me.Document):
    company_id = me.ReferenceField(Company, required=True)
    created_by = me.ReferenceField(User, required=True)
    category = me.StringField(required=True)
    amount = me.FloatField(required=True)
    period = me.StringField(required=True)  # 'YYYY-MM'
    
    meta = {
        'indexes': [
            'company_id',
            'category',
            'period',
            ('company_id', 'category'),
            ('company_id', 'period'),
            ('company_id', 'category', 'period') 
        ]
    }

class UserInvitation(me.Document):
    email = me.EmailField(required=True)
    company_id = me.ReferenceField(Company, required=True)
    invited_by = me.ReferenceField(User, required=True) 
    role = me.StringField(required=True, choices=['admin', 'user'])
    token = me.StringField(required=True, unique=True)
    expires_at = me.DateTimeField(required=True)
    is_used = me.BooleanField(default=False)
    created_at = me.DateTimeField(default=utc_now)
    
    meta = {
        'indexes': [
            'token', 
            'email',
            'is_used',
            'expires_at',
            ('token', 'is_used', 'expires_at'), 
            ('email', 'is_used')
        ]
    }


class InvoiceTemplate(me.Document):
    """Template for automated invoice generation with minimal required inputs."""
    company_id = me.ReferenceField(Company, required=True)
    template_name = me.StringField(required=True, max_length=100)
    
    # Default values for invoice generation
    default_due_days = me.IntField(default=30)
    default_tax_rate = me.FloatField(default=0.0)
    line_items_template = me.ListField(me.DictField())  # Predefined line items
    
    # Automation settings
    auto_generate = me.BooleanField(default=False)
    generation_frequency = me.StringField(choices=['daily', 'weekly', 'monthly'])
    next_generation_date = me.DateTimeField()
    
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    updated_at = me.DateTimeField(default=utc_now)
    is_active = me.BooleanField(default=True)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    meta = {
        'indexes': [
            'company_id',
            'auto_generate',
            'is_active',
            ('company_id', 'is_active'),
            ('auto_generate', 'next_generation_date')
        ]
    }


class Invoice(me.Document):
    """Invoice document for tracking billing and payments."""
    company_id = me.ReferenceField(Company, required=True)
    invoice_number = me.StringField(required=True, unique=True)
    customer_name = me.StringField(required=True, max_length=200)
    customer_email = me.EmailField()
    
    issue_date = me.DateTimeField(default=utc_now)
    due_date = me.DateTimeField(required=True)
    
    # Line items: [{description, quantity, rate, amount}]
    line_items = me.ListField(me.DictField())
    subtotal = me.FloatField(required=True)
    tax_rate = me.FloatField(default=0.0)
    tax_amount = me.FloatField(default=0.0)
    total_amount = me.FloatField(required=True)
    
    currency = me.StringField(default='USD')
    status = me.StringField(choices=['draft', 'sent', 'paid', 'overdue'], default='draft')
    notes = me.StringField(max_length=1000)
    
    # References
    template_id = me.ReferenceField(InvoiceTemplate)
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    updated_at = me.DateTimeField(default=utc_now)
    
    # Payment tracking
    paid_at = me.DateTimeField()
    payment_method = me.StringField()
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    meta = {
        'indexes': [
            'company_id',
            'status',
            'invoice_number',
            'due_date',
            ('company_id', 'status'),
            ('company_id', '-issue_date'),
            ('company_id', 'due_date'),
            ('status', 'due_date')  # For overdue detection
        ]
    }


# =============================================================================
# Bank Reconciliation Module
# =============================================================================

class BankStatement(me.Document):
    """Bank statement for reconciliation with system transactions."""
    company_id = me.ReferenceField(Company, required=True)
    bank_name = me.StringField(required=True, max_length=100)
    account_number = me.StringField(required=True, max_length=50)
    statement_date = me.DateTimeField(required=True)
    
    opening_balance = me.FloatField(required=True)
    closing_balance = me.FloatField(required=True)
    
    uploaded_file_path = me.StringField()
    uploaded_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    
    meta = {
        'indexes': [
            'company_id',
            'statement_date',
            ('company_id', 'statement_date'),
            ('company_id', 'bank_name'),
            ('company_id', '-created_at')
        ]
    }


class ReconciliationItem(me.Document):
    """Individual bank transaction item for reconciliation."""
    company_id = me.ReferenceField(Company, required=True)
    bank_statement = me.ReferenceField(BankStatement, required=True)
    transaction = me.ReferenceField(Transaction)  # Matched system transaction
    
    bank_date = me.DateTimeField(required=True)
    bank_description = me.StringField(required=True, max_length=500)
    bank_amount = me.FloatField(required=True)
    bank_reference = me.StringField(max_length=100)  # Bank's reference number
    
    status = me.StringField(
        choices=['matched', 'unmatched', 'pending'],
        default='pending'
    )
    
    reconciled_by = me.ReferenceField(User)
    reconciled_at = me.DateTimeField()
    
    notes = me.StringField(max_length=500)
    
    meta = {
        'indexes': [
            'company_id',
            'status',
            'bank_statement',
            ('company_id', 'status'),
            ('bank_statement', 'status'),
            ('company_id', 'bank_statement'),
            ('company_id', 'bank_date')
        ]
    }


# =============================================================================
# Drawings Module (Owner Withdrawals)
# =============================================================================

class Drawing(me.Document):
    """Owner drawings/withdrawals from the business."""
    company_id = me.ReferenceField(Company, required=True)
    owner = me.ReferenceField(User, required=True)  # Business owner making withdrawal
    
    date = me.DateTimeField(required=True)
    description = me.StringField(required=True, max_length=500)
    amount = me.FloatField(required=True)  # Always positive
    
    category = me.StringField(
        choices=['personal', 'equity', 'loan'],
        default='personal'
    )
    
    # Link to transaction if recorded in cashflow
    transaction = me.ReferenceField(Transaction)
    
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    
    meta = {
        'indexes': [
            'company_id',
            'owner',
            'date',
            ('company_id', 'owner'),
            ('company_id', 'date'),
            ('company_id', 'owner', 'date'),
            ('company_id', 'category')
        ]
    }


class EquityAccount(me.Document):
    """Track owner's equity/capital account balance."""
    company_id = me.ReferenceField(Company, required=True)
    owner = me.ReferenceField(User, required=True)
    
    opening_balance = me.FloatField(default=0.0)
    current_balance = me.FloatField(default=0.0)
    
    total_drawings = me.FloatField(default=0.0)
    total_contributions = me.FloatField(default=0.0)
    
    updated_at = me.DateTimeField(default=utc_now)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    meta = {
        'indexes': [
            'company_id',
            'owner',
            ('company_id', 'owner')  # Unique constraint effectively
        ]
    }


# =============================================================================
# Expense (Salary) Module
# =============================================================================

class Employee(me.Document):
    """Employee record for payroll management."""
    company_id = me.ReferenceField(Company, required=True)
    
    first_name = me.StringField(required=True, max_length=100)
    last_name = me.StringField(required=True, max_length=100)
    email = me.EmailField(required=True)
    employee_id = me.StringField(max_length=50)  # Internal employee ID
    
    position = me.StringField(max_length=100)
    department = me.StringField(max_length=100)
    
    salary_amount = me.FloatField(required=True)
    salary_frequency = me.StringField(
        choices=['hourly', 'weekly', 'biweekly', 'monthly', 'annual'],
        default='monthly'
    )
    
    bank_account_name = me.StringField(max_length=200)
    bank_account_number = me.StringField(max_length=50)
    tax_id = me.StringField(max_length=50)
    
    status = me.StringField(choices=['active', 'inactive'], default='active')
    hire_date = me.DateTimeField()
    termination_date = me.DateTimeField()
    
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    updated_at = me.DateTimeField(default=utc_now)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    @property
    def full_name(self):
        """Return employee's full name."""
        return f"{self.first_name} {self.last_name}"
    
    meta = {
        'indexes': [
            'company_id',
            'status',
            'employee_id',
            'email',
            ('company_id', 'status'),
            ('company_id', 'employee_id'),
            ('company_id', 'department'),
            ('company_id', '-created_at')
        ]
    }


class SalaryPayment(me.Document):
    """Salary payment record for an employee."""
    company_id = me.ReferenceField(Company, required=True)
    employee = me.ReferenceField(Employee, required=True)
    
    pay_period_start = me.DateTimeField(required=True)
    pay_period_end = me.DateTimeField(required=True)
    payment_date = me.DateTimeField(required=True)
    
    gross_amount = me.FloatField(required=True)
    tax_amount = me.FloatField(default=0.0)
    other_deductions = me.FloatField(default=0.0)
    net_amount = me.FloatField(required=True)
    
    deduction_details = me.ListField(me.DictField())  # [{name, amount}]
    
    status = me.StringField(
        choices=['pending', 'paid', 'cancelled'],
        default='pending'
    )
    
    # Link to expense transaction when paid
    transaction = me.ReferenceField(Transaction)
    
    notes = me.StringField(max_length=500)
    
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    paid_at = me.DateTimeField()
    
    meta = {
        'indexes': [
            'company_id',
            'employee',
            'payment_date',
            'status',
            ('company_id', 'status'),
            ('company_id', 'employee'),
            ('company_id', 'payment_date'),
            ('employee', 'status'),
            ('company_id', '-payment_date')
        ]
    }


class ExpenseAccount(me.Document):
    """Chart of accounts for expense categories."""
    company_id = me.ReferenceField(Company, required=True)
    
    account_code = me.StringField(required=True, max_length=20)  # e.g., "5000", "5100"
    account_name = me.StringField(required=True, max_length=100)  # e.g., "Salaries", "Rent"
    description = me.StringField(max_length=500)
    
    account_type = me.StringField(
        choices=['salary', 'rent', 'utilities', 'supplies', 'travel', 'marketing', 'insurance', 'other'],
        default='other'
    )
    
    parent_account = me.ReferenceField('ExpenseAccount')  # For sub-accounts
    
    is_active = me.BooleanField(default=True)
    created_by = me.ReferenceField(User, required=True)
    created_at = me.DateTimeField(default=utc_now)
    
    meta = {
        'indexes': [
            'company_id',
            'account_code',
            'is_active',
            ('company_id', 'account_code'),
            ('company_id', 'is_active'),
            ('company_id', 'account_type'),
            'parent_account'
        ]
    }


# =============================================================================
# Bug Report Forum Module
# =============================================================================

class BugReport(me.Document):
    """Bug report submitted by users for issue tracking."""
    title = me.StringField(required=True, max_length=200)
    description = me.StringField(required=True)
    
    # Reporter information
    reported_by = me.ReferenceField(User, required=True)
    company_id = me.ReferenceField(Company)  # Optional - bug may not be company-specific
    
    # Bug details
    severity = me.StringField(
        choices=['low', 'medium', 'high', 'critical'],
        default='medium'
    )
    category = me.StringField(
        choices=['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other'],
        default='other'
    )
    
    # Tracking
    status = me.StringField(
        choices=['open', 'in_progress', 'resolved', 'closed', 'wont_fix'],
        default='open'
    )
    priority = me.IntField(default=3)  # 1=highest, 5=lowest
    
    # Additional context
    browser = me.StringField(max_length=100)
    device = me.StringField(max_length=100)
    url_path = me.StringField(max_length=500)
    
    # Attachments (store file paths or URLs)
    attachments = me.ListField(me.StringField())
    
    # Comments/Updates - [{user_id, username, comment, timestamp}]
    comments = me.ListField(me.DictField())
    
    # Resolution
    resolved_by = me.ReferenceField(User)
    resolved_at = me.DateTimeField()
    resolution_notes = me.StringField(max_length=2000)
    
    created_at = me.DateTimeField(default=utc_now)
    updated_at = me.DateTimeField(default=utc_now)
    
    def save(self, *args, **kwargs):
        """Override save to auto-update updated_at field."""
        self.updated_at = utc_now()
        return super().save(*args, **kwargs)
    
    def to_dict(self):
        """Convert bug report to dictionary for JSON serialization."""
        return {
            'id': str(self.id),
            'title': self.title,
            'description': self.description,
            'reported_by': {
                'id': str(self.reported_by.id),
                'username': self.reported_by.username
            } if self.reported_by else None,
            'company_id': str(self.company_id.id) if self.company_id else None,
            'severity': self.severity,
            'category': self.category,
            'status': self.status,
            'priority': self.priority,
            'browser': self.browser,
            'device': self.device,
            'url_path': self.url_path,
            'attachments': self.attachments,
            'comments': self.comments,
            'resolved_by': {
                'id': str(self.resolved_by.id),
                'username': self.resolved_by.username
            } if self.resolved_by else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolution_notes': self.resolution_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    meta = {
        'indexes': [
            'reported_by',
            'company_id',
            'status',
            'severity',
            'category',
            'priority',
            '-created_at',
            ('status', 'severity'),
            ('status', 'priority'),
            ('reported_by', '-created_at'),
            ('company_id', 'status')
        ]
    }