# Pagination 
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100
MIN_PAGE_SIZE = 1

# File Upload 
MAX_FILE_SIZE_MB = 10
ALLOWED_FILE_EXTENSIONS = {'csv', 'xlsx', 'xls'}

# Validation 
MIN_PASSWORD_LENGTH = 8
MAX_STRING_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 1000
MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 50

# Number Validation 
MAX_AMOUNT = 1000000000  # 1 billion
MIN_AMOUNT = -1000000000  # Allow negative for overdrafts

# Currency 
SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN']
DEFAULT_CURRENCY = 'USD'

# Transaction Type 
TRANSACTION_TYPES = ['inflow', 'outflow']

# Transaction Category 
TRANSACTION_CATEGORIES = [
    'operating',
    'investing',
    'financing',
    'revenue',
    'expenses',
    'assets',
    'equipment',
    'loans',
    'equity'
]

# Working Capital Status 
WC_STATUS_PENDING = 'pending'
WC_STATUS_PAID = 'paid'
WC_STATUS_OVERDUE = 'overdue'
WC_STATUS_CANCELLED = 'cancelled'

# Role Level 
ROLE_LEVEL_SUPERADMIN = 1
ROLE_LEVEL_COMPANY_ADMIN = 2
ROLE_LEVEL_USER = 3

# Role Name 
ROLE_SUPERADMIN = 'SuperAdmin'
ROLE_COMPANY_ADMIN = 'CompanyAdmin'
ROLE_USER = 'User'

# Role Permissions (detailed access control)
PERMISSIONS = {
    'SuperAdmin': {
        'view_all_companies': True,
        'create_companies': True,
        'invite_employees': True,
        'edit_data': False,  # View-only for company data
        'manage_system': True
    },
    'CompanyAdmin': {
        'view_all_companies': False,
        'create_companies': False,
        'invite_employees': True,
        'edit_data': False,  # View-only for company tasks
        'manage_company': True
    },
    'User': {
        'view_all_companies': False,
        'create_companies': False,
        'invite_employees': False,
        'edit_data': True,  # Full CRUD access
        'manage_company': False
    }
}

# Company Role 
COMPANY_ROLE_ADMIN = 'admin'
COMPANY_ROLE_USER = 'user'

# Rate Limit 
RATE_LIMIT_DEFAULT_DAY = "200 per day"
RATE_LIMIT_DEFAULT_HOUR = "50 per hour"
RATE_LIMIT_PASSWORD_CHANGE = "5 per hour"
RATE_LIMIT_FILE_UPLOAD = "10 per hour"
RATE_LIMIT_AI_FORECAST = "20 per hour"
RATE_LIMIT_REPORT_GENERATION = "30 per hour"
RATE_LIMIT_LOGIN = "10 per hour"
RATE_LIMIT_REGISTRATION = "5 per hour"

# Date Range (for forecasting)
DEFAULT_FORECAST_MONTHS = 12
MAX_FORECAST_MONTHS = 36
MIN_FORECAST_MONTHS = 1

# Burn Rate Calculation 
DEFAULT_BURN_RATE_MONTHS = 3  # Calculate burn rate over 3 months

# Invitation 
INVITATION_EXPIRY_DAYS = 7

# Chart/Export 
CHART_WIDTH = 12
CHART_HEIGHT = 6
EXCEL_COLUMN_WIDTH_DEFAULT = 15
EXCEL_COLUMN_WIDTH_DESCRIPTION = 40

# API Response Keys
RESPONSE_KEY_ERROR = 'error'
RESPONSE_KEY_MESSAGE = 'message'
RESPONSE_KEY_DETAILS = 'details'
RESPONSE_KEY_DATA = 'data'
RESPONSE_KEY_SUCCESS = 'success'

# HTTP Status Codes (for consistency)
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_MULTI_STATUS = 207
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_RATE_LIMIT = 429
HTTP_SERVER_ERROR = 500
HTTP_SERVICE_UNAVAILABLE = 503

# Invoice Status
INVOICE_STATUS_DRAFT = 'draft'
INVOICE_STATUS_SENT = 'sent'
INVOICE_STATUS_PAID = 'paid'
INVOICE_STATUS_OVERDUE = 'overdue'
INVOICE_STATUSES = [INVOICE_STATUS_DRAFT, INVOICE_STATUS_SENT, INVOICE_STATUS_PAID, INVOICE_STATUS_OVERDUE]

# Invoice Generation Frequency
INVOICE_FREQUENCY_DAILY = 'daily'
INVOICE_FREQUENCY_WEEKLY = 'weekly'
INVOICE_FREQUENCY_MONTHLY = 'monthly'
INVOICE_FREQUENCIES = [INVOICE_FREQUENCY_DAILY, INVOICE_FREQUENCY_WEEKLY, INVOICE_FREQUENCY_MONTHLY]

# Invoice Defaults
DEFAULT_DUE_DAYS = 30
DEFAULT_TAX_RATE = 0.0

# =============================================================================
# Bank Reconciliation Module Constants
# =============================================================================

# Reconciliation Item Status
RECONCILIATION_STATUS_MATCHED = 'matched'
RECONCILIATION_STATUS_UNMATCHED = 'unmatched'
RECONCILIATION_STATUS_PENDING = 'pending'
RECONCILIATION_STATUSES = [
    RECONCILIATION_STATUS_MATCHED,
    RECONCILIATION_STATUS_UNMATCHED,
    RECONCILIATION_STATUS_PENDING
]

# Auto-matching configuration
RECONCILIATION_DATE_TOLERANCE_DAYS = 2  # Match transactions within ±2 days
RECONCILIATION_AMOUNT_TOLERANCE = 0.01  # Allow 1 cent variance for rounding

# =============================================================================
# Drawings Module Constants
# =============================================================================

# Drawing Categories
DRAWING_CATEGORY_PERSONAL = 'personal'
DRAWING_CATEGORY_EQUITY = 'equity'
DRAWING_CATEGORY_LOAN = 'loan'
DRAWING_CATEGORIES = [
    DRAWING_CATEGORY_PERSONAL,
    DRAWING_CATEGORY_EQUITY,
    DRAWING_CATEGORY_LOAN
]

# =============================================================================
# Expense/Salary Module Constants
# =============================================================================

# Employee Status
EMPLOYEE_STATUS_ACTIVE = 'active'
EMPLOYEE_STATUS_INACTIVE = 'inactive'
EMPLOYEE_STATUSES = [EMPLOYEE_STATUS_ACTIVE, EMPLOYEE_STATUS_INACTIVE]

# Salary Frequency
SALARY_FREQUENCY_HOURLY = 'hourly'
SALARY_FREQUENCY_WEEKLY = 'weekly'
SALARY_FREQUENCY_BIWEEKLY = 'biweekly'
SALARY_FREQUENCY_MONTHLY = 'monthly'
SALARY_FREQUENCY_ANNUAL = 'annual'
SALARY_FREQUENCIES = [
    SALARY_FREQUENCY_HOURLY,
    SALARY_FREQUENCY_WEEKLY,
    SALARY_FREQUENCY_BIWEEKLY,
    SALARY_FREQUENCY_MONTHLY,
    SALARY_FREQUENCY_ANNUAL
]

# Salary Payment Status
SALARY_STATUS_PENDING = 'pending'
SALARY_STATUS_PAID = 'paid'
SALARY_STATUS_CANCELLED = 'cancelled'
SALARY_STATUSES = [SALARY_STATUS_PENDING, SALARY_STATUS_PAID, SALARY_STATUS_CANCELLED]

# Expense Account Types
EXPENSE_TYPE_SALARY = 'salary'
EXPENSE_TYPE_RENT = 'rent'
EXPENSE_TYPE_UTILITIES = 'utilities'
EXPENSE_TYPE_SUPPLIES = 'supplies'
EXPENSE_TYPE_TRAVEL = 'travel'
EXPENSE_TYPE_MARKETING = 'marketing'
EXPENSE_TYPE_INSURANCE = 'insurance'
EXPENSE_TYPE_OTHER = 'other'
EXPENSE_ACCOUNT_TYPES = [
    EXPENSE_TYPE_SALARY,
    EXPENSE_TYPE_RENT,
    EXPENSE_TYPE_UTILITIES,
    EXPENSE_TYPE_SUPPLIES,
    EXPENSE_TYPE_TRAVEL,
    EXPENSE_TYPE_MARKETING,
    EXPENSE_TYPE_INSURANCE,
    EXPENSE_TYPE_OTHER
]

# =============================================================================
# Bug Report Module Constants (Phase 5)
# =============================================================================

# Bug Report Severity
BUG_SEVERITY_LOW = 'low'
BUG_SEVERITY_MEDIUM = 'medium'
BUG_SEVERITY_HIGH = 'high'
BUG_SEVERITY_CRITICAL = 'critical'
BUG_SEVERITIES = [
    BUG_SEVERITY_LOW,
    BUG_SEVERITY_MEDIUM,
    BUG_SEVERITY_HIGH,
    BUG_SEVERITY_CRITICAL
]

# Bug Report Category
BUG_CATEGORY_UI = 'ui'
BUG_CATEGORY_API = 'api'
BUG_CATEGORY_PERFORMANCE = 'performance'
BUG_CATEGORY_DATA = 'data'
BUG_CATEGORY_SECURITY = 'security'
BUG_CATEGORY_FEATURE_REQUEST = 'feature_request'
BUG_CATEGORY_OTHER = 'other'
BUG_CATEGORIES = [
    BUG_CATEGORY_UI,
    BUG_CATEGORY_API,
    BUG_CATEGORY_PERFORMANCE,
    BUG_CATEGORY_DATA,
    BUG_CATEGORY_SECURITY,
    BUG_CATEGORY_FEATURE_REQUEST,
    BUG_CATEGORY_OTHER
]

# Bug Report Status
BUG_STATUS_OPEN = 'open'
BUG_STATUS_IN_PROGRESS = 'in_progress'
BUG_STATUS_RESOLVED = 'resolved'
BUG_STATUS_CLOSED = 'closed'
BUG_STATUS_WONT_FIX = 'wont_fix'
BUG_STATUSES = [
    BUG_STATUS_OPEN,
    BUG_STATUS_IN_PROGRESS,
    BUG_STATUS_RESOLVED,
    BUG_STATUS_CLOSED,
    BUG_STATUS_WONT_FIX
]

# Bug Report Priorities (1=highest, 5=lowest)
BUG_PRIORITY_HIGHEST = 1
BUG_PRIORITY_HIGH = 2
BUG_PRIORITY_MEDIUM = 3
BUG_PRIORITY_LOW = 4
BUG_PRIORITY_LOWEST = 5

# Bug Report File Upload
BUG_ATTACHMENT_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'log', 'json', 'csv'}
BUG_ATTACHMENT_MAX_SIZE_MB = 10
BUG_ATTACHMENT_MAX_FILES = 5
BUG_ATTACHMENT_UPLOAD_FOLDER = 'uploads/bug_reports'

# Bug Report Limits
BUG_TITLE_MAX_LENGTH = 200
BUG_DESCRIPTION_MAX_LENGTH = 10000
BUG_RESOLUTION_NOTES_MAX_LENGTH = 2000
BUG_COMMENT_MAX_LENGTH = 2000
