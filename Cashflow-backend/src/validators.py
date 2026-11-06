from datetime import datetime
from bson.objectid import ObjectId
from bson.errors import InvalidId
import re
from src.constants import (
    MAX_STRING_LENGTH,
    MAX_FILE_SIZE_MB,
    ALLOWED_FILE_EXTENSIONS,
    SUPPORTED_CURRENCIES,
    DEFAULT_CURRENCY,
    TRANSACTION_TYPES,
    TRANSACTION_CATEGORIES,
    MIN_PASSWORD_LENGTH,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
    # Bug Report constants
    BUG_SEVERITIES,
    BUG_CATEGORIES,
    BUG_STATUSES,
    BUG_TITLE_MAX_LENGTH,
    BUG_DESCRIPTION_MAX_LENGTH,
    BUG_RESOLUTION_NOTES_MAX_LENGTH,
    BUG_COMMENT_MAX_LENGTH,
    BUG_ATTACHMENT_ALLOWED_EXTENSIONS,
    BUG_ATTACHMENT_MAX_SIZE_MB,
    BUG_ATTACHMENT_MAX_FILES
)


class ValidationError(Exception):
    def __init__(self, error, field=None, details=None):
        self.error = error
        self.field = field
        self.details = details
        super().__init__(self.error)
    
    def to_dict(self):
        result = {"error": self.error}
        if self.field:
            result["field"] = self.field
        if self.details:
            result["details"] = self.details
        return result


def validate_required_fields(data, required_fields):
    if not data:
        raise ValidationError("Request body required")
    
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        raise ValidationError(
            "Missing required fields",
            details=f"Required: {', '.join(missing)}",
        )


def validate_positive_number(value, field_name):

    if value is None:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    try:
        num = float(value)
    except (ValueError, TypeError):
        raise ValidationError(
            f"{field_name} must be a valid number",
            field=field_name
        )
    
    if num <= 0:
        raise ValidationError(
            f"{field_name} must be positive",
            field=field_name
        )
    
    return num


def validate_number_range(value, field_name, min_val=None, max_val=None):

    if value is None:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    try:
        num = float(value)
    except (ValueError, TypeError):
        raise ValidationError(
            f"{field_name} must be a valid number",
            field=field_name
        )
    
    if min_val is not None and num < min_val:
        raise ValidationError(
            f"{field_name} must be at least {min_val}",
            field=field_name
        )
    
    if max_val is not None and num > max_val:
        raise ValidationError(
            f"{field_name} must not exceed {max_val}",
            field=field_name
        )
    
    return num


def validate_date(date_str, field_name="date", allow_future=True):

    if not date_str:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    try:
        parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        try:
            parsed_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            raise ValidationError(
                f"Invalid {field_name} format",
                field=field_name,
                details="Use YYYY-MM-DD or ISO format (e.g., 2024-01-15 or 2024-01-15T10:30:00)"
            )
    
    if not allow_future and parsed_date > datetime.utcnow():
        raise ValidationError(
            f"{field_name} cannot be in the future",
            field=field_name
        )
    
    return parsed_date


def validate_choice(value, field_name, allowed_values):

    if not value:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if value not in allowed_values:
        raise ValidationError(
            f"{field_name} must be one of: {', '.join(allowed_values)}",
            field=field_name,
            details={"allowed_values": allowed_values}
        )
    
    return value


def validate_string(value, field_name, min_length=None, max_length=None, allow_empty=False):

    if value is None:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not isinstance(value, str):
        raise ValidationError(
            f"{field_name} must be a string",
            field=field_name
        )
    
    if not allow_empty and not value.strip():
        raise ValidationError(
            f"{field_name} cannot be empty",
            field=field_name
        )
    
    if min_length is not None and len(value) < min_length:
        raise ValidationError(
            f"{field_name} must be at least {min_length} characters",
            field=field_name
        )
    
    if max_length is not None and len(value) > max_length:
        raise ValidationError(
            f"{field_name} must not exceed {max_length} characters",
            field=field_name
        )
    
    return value


def validate_email(email, field_name="email"):

    if not email:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValidationError(
            "Invalid email format",
            field=field_name
        )
    
    return email.lower()


def validate_object_id(id_str, field_name="id"):
    if not id_str:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    try:
        ObjectId(id_str)
    except InvalidId:
        raise ValidationError(
            f"Invalid {field_name} format",
            field=field_name
        )
    
    return id_str


def validate_pagination(page, per_page, max_per_page=None):

    if max_per_page is None:
        max_per_page = MAX_PAGE_SIZE
    
    try:
        page = int(page) if page else 1
    except (ValueError, TypeError):
        page = 1
    
    page = max(MIN_PAGE_SIZE, page) 
    
    try:
        per_page = int(per_page) if per_page else DEFAULT_PAGE_SIZE
    except (ValueError, TypeError):
        per_page = DEFAULT_PAGE_SIZE
    
    per_page = max(MIN_PAGE_SIZE, min(per_page, max_per_page))  # Between min and max
    
    return page, per_page


def validate_currency(currency, field_name="currency"):

    if currency and currency not in SUPPORTED_CURRENCIES:
        raise ValidationError(
            f"Unsupported currency",
            field=field_name,
            details=f"Allowed: {', '.join(SUPPORTED_CURRENCIES)}"
        )
    
    return currency or DEFAULT_CURRENCY


def validate_file_upload(file, max_size_mb=None, allowed_extensions=None):

    if not file or file.filename == '':
        raise ValidationError("No file selected")
    
    if max_size_mb is None:
        max_size_mb = MAX_FILE_SIZE_MB
    if allowed_extensions is None:
        allowed_extensions = ALLOWED_FILE_EXTENSIONS
    
    file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if file_ext not in allowed_extensions:
        raise ValidationError(
            f"Invalid file type",
            details=f"Allowed types: {', '.join(allowed_extensions)}"
        )
    
    import os
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  
    
    max_size_bytes = max_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise ValidationError(
            f"File too large",
            details=f"Maximum size: {max_size_mb}MB"
        )
    
    return file


def validate_transaction_type(transaction_type):

    return validate_choice(transaction_type, "type", TRANSACTION_TYPES)


def validate_category(category):

    return validate_choice(category, "category", TRANSACTION_CATEGORIES)


def validate_password(password, field_name="password", min_length=None, require_uppercase=True, require_digit=True):

    if min_length is None:
        min_length = MIN_PASSWORD_LENGTH
    
    if not password:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if len(password) < min_length:
        raise ValidationError(
            f"{field_name} must be at least {min_length} characters",
            field=field_name
        )
    
    if require_uppercase and not any(c.isupper() for c in password):
        raise ValidationError(
            f"{field_name} must contain at least one uppercase letter",
            field=field_name
        )
    
    if require_digit and not any(c.isdigit() for c in password):
        raise ValidationError(
            f"{field_name} must contain at least one digit",
            field=field_name
        )
    
    return password


def handle_validation_error(error):

    return error.to_dict(), 400


# =============================================================================
# Bug Report Validators
# =============================================================================

def validate_bug_report_title(title, field_name="title"):
    """
    Validate bug report title.
    
    Args:
        title: The title to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated title
    
    Raises:
        ValidationError: If validation fails
    """
    if not title:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not isinstance(title, str):
        raise ValidationError(f"{field_name} must be a string", field=field_name)
    
    title = title.strip()
    
    if not title:
        raise ValidationError(f"{field_name} cannot be empty", field=field_name)
    
    if len(title) > BUG_TITLE_MAX_LENGTH:
        raise ValidationError(
            f"{field_name} must be {BUG_TITLE_MAX_LENGTH} characters or less",
            field=field_name
        )
    
    return title


def validate_bug_report_description(description, field_name="description"):
    """
    Validate bug report description.
    
    Args:
        description: The description to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated description
    
    Raises:
        ValidationError: If validation fails
    """
    if not description:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not isinstance(description, str):
        raise ValidationError(f"{field_name} must be a string", field=field_name)
    
    description = description.strip()
    
    if not description:
        raise ValidationError(f"{field_name} cannot be empty", field=field_name)
    
    if len(description) > BUG_DESCRIPTION_MAX_LENGTH:
        raise ValidationError(
            f"{field_name} must be {BUG_DESCRIPTION_MAX_LENGTH} characters or less",
            field=field_name
        )
    
    return description


def validate_bug_severity(severity, field_name="severity"):
    """
    Validate bug report severity.
    
    Args:
        severity: The severity to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated severity
    
    Raises:
        ValidationError: If validation fails
    """
    if not severity:
        return 'medium'  # Default
    
    severity = severity.lower().strip()
    
    if severity not in BUG_SEVERITIES:
        raise ValidationError(
            f"Invalid {field_name}. Must be one of: {', '.join(BUG_SEVERITIES)}",
            field=field_name,
            details={"allowed_values": BUG_SEVERITIES}
        )
    
    return severity


def validate_bug_category(category, field_name="category"):
    """
    Validate bug report category.
    
    Args:
        category: The category to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated category
    
    Raises:
        ValidationError: If validation fails
    """
    if not category:
        return 'other'  # Default
    
    category = category.lower().strip()
    
    if category not in BUG_CATEGORIES:
        raise ValidationError(
            f"Invalid {field_name}. Must be one of: {', '.join(BUG_CATEGORIES)}",
            field=field_name,
            details={"allowed_values": BUG_CATEGORIES}
        )
    
    return category


def validate_bug_status(status, field_name="status"):
    """
    Validate bug report status.
    
    Args:
        status: The status to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated status
    
    Raises:
        ValidationError: If validation fails
    """
    if not status:
        return 'open'  # Default
    
    status = status.lower().strip()
    
    if status not in BUG_STATUSES:
        raise ValidationError(
            f"Invalid {field_name}. Must be one of: {', '.join(BUG_STATUSES)}",
            field=field_name,
            details={"allowed_values": BUG_STATUSES}
        )
    
    return status


def validate_bug_priority(priority, field_name="priority"):
    """
    Validate bug report priority.
    
    Args:
        priority: The priority to validate (1-5, 1=highest)
        field_name: Field name for error messages
    
    Returns:
        int: Validated priority
    
    Raises:
        ValidationError: If validation fails
    """
    if priority is None:
        return 3  # Default to medium
    
    try:
        priority = int(priority)
    except (ValueError, TypeError):
        raise ValidationError(
            f"{field_name} must be an integer between 1 and 5",
            field=field_name
        )
    
    if priority < 1 or priority > 5:
        raise ValidationError(
            f"{field_name} must be between 1 (highest) and 5 (lowest)",
            field=field_name
        )
    
    return priority


def validate_bug_comment(comment, field_name="comment"):
    """
    Validate bug report comment.
    
    Args:
        comment: The comment to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated comment
    
    Raises:
        ValidationError: If validation fails
    """
    if not comment:
        raise ValidationError(f"{field_name} is required", field=field_name)
    
    if not isinstance(comment, str):
        raise ValidationError(f"{field_name} must be a string", field=field_name)
    
    comment = comment.strip()
    
    if not comment:
        raise ValidationError(f"{field_name} cannot be empty", field=field_name)
    
    if len(comment) > BUG_COMMENT_MAX_LENGTH:
        raise ValidationError(
            f"{field_name} must be {BUG_COMMENT_MAX_LENGTH} characters or less",
            field=field_name
        )
    
    return comment


def validate_bug_resolution_notes(notes, field_name="resolution_notes"):
    """
    Validate bug report resolution notes.
    
    Args:
        notes: The resolution notes to validate
        field_name: Field name for error messages
    
    Returns:
        str: Validated notes or None
    
    Raises:
        ValidationError: If validation fails
    """
    if not notes:
        return None
    
    if not isinstance(notes, str):
        raise ValidationError(f"{field_name} must be a string", field=field_name)
    
    notes = notes.strip()
    
    if len(notes) > BUG_RESOLUTION_NOTES_MAX_LENGTH:
        raise ValidationError(
            f"{field_name} must be {BUG_RESOLUTION_NOTES_MAX_LENGTH} characters or less",
            field=field_name
        )
    
    return notes


def validate_bug_attachment(file, field_name="attachment"):
    """
    Validate bug report attachment file.
    
    Args:
        file: The file object to validate
        field_name: Field name for error messages
    
    Returns:
        file: Validated file object
    
    Raises:
        ValidationError: If validation fails
    """
    if not file or file.filename == '':
        raise ValidationError("No file selected", field=field_name)
    
    # Check extension
    if '.' not in file.filename:
        raise ValidationError("File must have an extension", field=field_name)
    
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in BUG_ATTACHMENT_ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Invalid file type. Allowed: {', '.join(BUG_ATTACHMENT_ALLOWED_EXTENSIONS)}",
            field=field_name,
            details={"allowed_extensions": list(BUG_ATTACHMENT_ALLOWED_EXTENSIONS)}
        )
    
    # Check file size
    import os
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    max_size_bytes = BUG_ATTACHMENT_MAX_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        raise ValidationError(
            f"File too large. Maximum size: {BUG_ATTACHMENT_MAX_SIZE_MB}MB",
            field=field_name
        )
    
    return file


def validate_bug_report_data(data):
    """
    Validate complete bug report data.
    
    Args:
        data: Dictionary containing bug report data
    
    Returns:
        dict: Validated and cleaned data
    
    Raises:
        ValidationError: If validation fails
    """
    if not data:
        raise ValidationError("Request body required")
    
    validated = {}
    
    # Required fields
    validated['title'] = validate_bug_report_title(data.get('title'))
    validated['description'] = validate_bug_report_description(data.get('description'))
    
    # Optional fields with defaults
    validated['severity'] = validate_bug_severity(data.get('severity'))
    validated['category'] = validate_bug_category(data.get('category'))
    validated['priority'] = validate_bug_priority(data.get('priority'))
    
    # Optional fields without defaults
    if data.get('browser'):
        validated['browser'] = validate_string(
            data.get('browser'), 'browser', max_length=100
        )
    
    if data.get('device'):
        validated['device'] = validate_string(
            data.get('device'), 'device', max_length=100
        )
    
    if data.get('url_path'):
        validated['url_path'] = validate_string(
            data.get('url_path'), 'url_path', max_length=500
        )
    
    if data.get('company_id'):
        validated['company_id'] = validate_object_id(
            data.get('company_id'), 'company_id'
        )
    
    return validated


