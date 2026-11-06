"""
Validator unit tests.

Tests for all validation functions in src/validators.py:
- validate_required_fields
- validate_positive_number
- validate_number_range
- validate_date
- validate_choice
- validate_string
- validate_email
- validate_object_id
- validate_pagination
- validate_currency
- validate_file_upload
- validate_transaction_type
- validate_category
- validate_password
"""

import pytest
from src.validators import (
    ValidationError,
    validate_required_fields,
    validate_positive_number,
    validate_number_range,
    validate_date,
    validate_choice,
    validate_string,
    validate_email,
    validate_object_id,
    validate_pagination,
    validate_currency,
    validate_transaction_type,
    validate_category,
    validate_password
)
from datetime import datetime
from io import BytesIO


@pytest.mark.unit
class TestValidateRequiredFields:
    """Test validate_required_fields function."""
    
    def test_all_fields_present(self):
        """Test validation passes when all fields present."""
        data = {'name': 'John', 'email': 'john@test.com', 'amount': 100}
        validate_required_fields(data, ['name', 'email', 'amount'])
        # Should not raise
    
    def test_missing_field_raises_error(self):
        """Test validation fails when field missing."""
        data = {'name': 'John'}
        with pytest.raises(ValidationError) as exc_info:
            validate_required_fields(data, ['name', 'email'])
        
        assert 'Missing required fields' in str(exc_info.value)
    
    def test_empty_data_raises_error(self):
        """Test validation fails with empty data."""
        with pytest.raises(ValidationError) as exc_info:
            validate_required_fields(None, ['name'])
        
        assert 'Request body required' in str(exc_info.value)


@pytest.mark.unit
class TestValidatePositiveNumber:
    """Test validate_positive_number function."""
    
    def test_valid_positive_number(self):
        """Test validation passes for positive number."""
        result = validate_positive_number(100, 'amount')
        assert result == 100.0
    
    def test_positive_float(self):
        """Test validation passes for positive float."""
        result = validate_positive_number(99.99, 'amount')
        assert result == 99.99
    
    def test_zero_raises_error(self):
        """Test validation fails for zero."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number(0, 'amount')
        
        assert 'must be positive' in str(exc_info.value)
    
    def test_negative_raises_error(self):
        """Test validation fails for negative number."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number(-100, 'amount')
        
        assert 'must be positive' in str(exc_info.value)
    
    def test_string_number_converted(self):
        """Test string number is converted."""
        result = validate_positive_number('123.45', 'amount')
        assert result == 123.45
    
    def test_invalid_string_raises_error(self):
        """Test invalid string raises error."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number('not_a_number', 'amount')
        
        assert 'must be a valid number' in str(exc_info.value)


@pytest.mark.unit
class TestValidateNumberRange:
    """Test validate_number_range function."""
    
    def test_within_range(self):
        """Test number within range passes."""
        result = validate_number_range(50, 'value', min_val=0, max_val=100)
        assert result == 50.0
    
    def test_below_minimum_raises_error(self):
        """Test number below minimum fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_number_range(-1, 'value', min_val=0)
        
        assert 'must be at least' in str(exc_info.value)
    
    def test_above_maximum_raises_error(self):
        """Test number above maximum fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_number_range(150, 'value', max_val=100)
        
        assert 'must not exceed' in str(exc_info.value)


@pytest.mark.unit
class TestValidateDate:
    """Test validate_date function."""
    
    def test_valid_date_ymd_format(self):
        """Test validation passes for YYYY-MM-DD format."""
        result = validate_date('2024-01-15')
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15
    
    def test_valid_date_iso_format(self):
        """Test validation passes for ISO format."""
        result = validate_date('2024-01-15T10:30:00')
        assert isinstance(result, datetime)
    
    def test_invalid_date_format_raises_error(self):
        """Test invalid date format fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date('15-01-2024')
        
        assert 'Invalid' in str(exc_info.value)
    
    def test_future_date_when_not_allowed(self):
        """Test future date fails when allow_future=False."""
        future_date = '2099-12-31'
        with pytest.raises(ValidationError) as exc_info:
            validate_date(future_date, allow_future=False)
        
        assert 'cannot be in the future' in str(exc_info.value)


@pytest.mark.unit
class TestValidateChoice:
    """Test validate_choice function."""
    
    def test_valid_choice(self):
        """Test validation passes for valid choice."""
        result = validate_choice('active', 'status', ['active', 'inactive'])
        assert result == 'active'
    
    def test_invalid_choice_raises_error(self):
        """Test invalid choice fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_choice('invalid', 'status', ['active', 'inactive'])
        
        assert 'must be one of' in str(exc_info.value)


@pytest.mark.unit
class TestValidateString:
    """Test validate_string function."""
    
    def test_valid_string(self):
        """Test validation passes for valid string."""
        result = validate_string('Hello World', 'name')
        assert result == 'Hello World'
    
    def test_string_with_min_length(self):
        """Test string meets minimum length."""
        result = validate_string('John', 'name', min_length=3)
        assert result == 'John'
    
    def test_string_too_short_raises_error(self):
        """Test string below minimum fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_string('ab', 'name', min_length=3)
        
        assert 'at least 3 characters' in str(exc_info.value)
    
    def test_string_too_long_raises_error(self):
        """Test string above maximum fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_string('a' * 101, 'name', max_length=100)
        
        assert 'must not exceed 100 characters' in str(exc_info.value)
    
    def test_empty_string_raises_error(self):
        """Test empty string fails when not allowed."""
        with pytest.raises(ValidationError) as exc_info:
            validate_string('', 'name', allow_empty=False)
        
        assert 'cannot be empty' in str(exc_info.value)


@pytest.mark.unit
class TestValidateEmail:
    """Test validate_email function."""
    
    def test_valid_email(self):
        """Test validation passes for valid email."""
        result = validate_email('user@example.com')
        assert result == 'user@example.com'
    
    def test_email_lowercase_conversion(self):
        """Test email is converted to lowercase."""
        result = validate_email('USER@EXAMPLE.COM')
        assert result == 'user@example.com'
    
    def test_invalid_email_format_raises_error(self):
        """Test invalid email format fails."""
        invalid_emails = [
            'notanemail',
            '@example.com',
            'user@',
            'user @example.com',
            'user@.com'
        ]
        
        for email in invalid_emails:
            with pytest.raises(ValidationError):
                validate_email(email)


@pytest.mark.unit
class TestValidateObjectId:
    """Test validate_object_id function."""
    
    def test_valid_object_id(self):
        """Test validation passes for valid ObjectId."""
        valid_id = '507f1f77bcf86cd799439011'
        result = validate_object_id(valid_id)
        assert result == valid_id
    
    def test_invalid_object_id_raises_error(self):
        """Test invalid ObjectId fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_object_id('invalid_id')
        
        assert 'Invalid' in str(exc_info.value)
    
    def test_empty_id_raises_error(self):
        """Test empty ID fails."""
        with pytest.raises(ValidationError):
            validate_object_id('')


@pytest.mark.unit
class TestValidatePagination:
    """Test validate_pagination function."""
    
    def test_valid_pagination(self):
        """Test valid pagination parameters."""
        page, per_page = validate_pagination(2, 20)
        assert page == 2
        assert per_page == 20
    
    def test_page_minimum_enforced(self):
        """Test page number minimum is 1."""
        page, per_page = validate_pagination(0, 10)
        assert page == 1
    
    def test_per_page_maximum_enforced(self):
        """Test per_page maximum is enforced."""
        page, per_page = validate_pagination(1, 200)
        assert per_page == 100  # MAX_PAGE_SIZE
    
    def test_default_values(self):
        """Test default pagination values."""
        page, per_page = validate_pagination(None, None)
        assert page == 1
        assert per_page == 10  # DEFAULT_PAGE_SIZE


@pytest.mark.unit
class TestValidateCurrency:
    """Test validate_currency function."""
    
    def test_valid_currency(self):
        """Test valid currency code."""
        result = validate_currency('USD')
        assert result == 'USD'
    
    def test_default_currency(self):
        """Test default currency is USD."""
        result = validate_currency(None)
        assert result == 'USD'
    
    def test_invalid_currency_raises_error(self):
        """Test invalid currency fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_currency('XXX')
        
        assert 'Unsupported currency' in str(exc_info.value)


@pytest.mark.unit
class TestValidateTransactionType:
    """Test validate_transaction_type function."""
    
    def test_valid_inflow(self):
        """Test 'inflow' is valid."""
        result = validate_transaction_type('inflow')
        assert result == 'inflow'
    
    def test_valid_outflow(self):
        """Test 'outflow' is valid."""
        result = validate_transaction_type('outflow')
        assert result == 'outflow'
    
    def test_invalid_type_raises_error(self):
        """Test invalid transaction type fails."""
        with pytest.raises(ValidationError):
            validate_transaction_type('invalid')


@pytest.mark.unit
class TestValidateCategory:
    """Test validate_category function."""
    
    @pytest.mark.parametrize('category', [
        'operating', 'investing', 'financing',
        'revenue', 'expenses', 'assets',
        'equipment', 'loans', 'equity'
    ])
    def test_valid_categories(self, category):
        """Test all valid categories pass."""
        result = validate_category(category)
        assert result == category
    
    def test_invalid_category_raises_error(self):
        """Test invalid category fails."""
        with pytest.raises(ValidationError):
            validate_category('invalid_category')


@pytest.mark.unit
class TestValidatePassword:
    """Test validate_password function."""
    
    def test_valid_password(self):
        """Test valid password passes."""
        result = validate_password('Password123')
        assert result == 'Password123'
    
    def test_password_too_short_raises_error(self):
        """Test password below minimum length fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_password('Pass1')
        
        assert 'at least 8 characters' in str(exc_info.value)
    
    def test_password_no_uppercase_raises_error(self):
        """Test password without uppercase fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_password('password123')
        
        assert 'uppercase' in str(exc_info.value).lower()
    
    def test_password_no_digit_raises_error(self):
        """Test password without digit fails."""
        with pytest.raises(ValidationError) as exc_info:
            validate_password('Password')
        
        assert 'digit' in str(exc_info.value).lower()

