"""
Phase 5: Bug Report Forum Tests

Comprehensive tests for the Bug Report System including:
- Bug report CRUD operations
- Access control (SuperAdmin sees all, users see own)
- File attachment handling
- Comment functionality
- Statistics endpoint
- Validation edge cases
- Search and filtering
"""

import pytest
import json
import io
from datetime import datetime, timedelta
from mongoengine import connect, disconnect
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash

from src.models import BugReport, User, Role, Company, CompanyMembership


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sample_bug_report(user_a, company_a):
    """Create a sample bug report for testing."""
    return BugReport(
        title='Test Bug Report',
        description='This is a test bug report description with enough details.',
        reported_by=user_a,
        company_id=company_a,
        severity='medium',
        category='api',
        status='open',
        priority=3,
        browser='Chrome 120',
        device='Desktop',
        url_path='/api/transactions'
    ).save()


@pytest.fixture
def sample_bug_reports(user_a, user_b, company_a, company_b, superadmin):
    """Create multiple bug reports for testing."""
    reports = []
    
    # Bug reports from user_a
    for i in range(3):
        report = BugReport(
            title=f'User A Bug {i+1}',
            description=f'Description for user A bug report {i+1}',
            reported_by=user_a,
            company_id=company_a,
            severity=['low', 'medium', 'high'][i % 3],
            category='api',
            status='open',
            priority=i + 1
        ).save()
        reports.append(report)
    
    # Bug reports from user_b
    for i in range(2):
        report = BugReport(
            title=f'User B Bug {i+1}',
            description=f'Description for user B bug report {i+1}',
            reported_by=user_b,
            company_id=company_b,
            severity='medium',
            category='ui',
            status='open',
            priority=3
        ).save()
        reports.append(report)
    
    # Bug report from superadmin
    report = BugReport(
        title='SuperAdmin Bug',
        description='Bug reported by SuperAdmin',
        reported_by=superadmin,
        severity='critical',
        category='security',
        status='open',
        priority=1
    ).save()
    reports.append(report)
    
    return reports


# =============================================================================
# Bug Report CRUD Tests
# =============================================================================

class TestBugReportCRUD:
    """Tests for basic CRUD operations on bug reports."""
    
    def test_create_bug_report(self, client, auth_headers_user_a, company_a):
        """Test creating a new bug report."""
        data = {
            'title': 'New Bug Report',
            'description': 'Detailed description of the bug encountered',
            'severity': 'high',
            'category': 'api',
            'priority': 2,
            'browser': 'Firefox 121',
            'device': 'Desktop',
            'url_path': '/api/dashboard',
            'company_id': str(company_a.id)
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        result = response.json
        assert result['message'] == 'Bug report submitted successfully'
        assert result['bug_report']['title'] == 'New Bug Report'
        assert result['bug_report']['severity'] == 'high'
        assert result['bug_report']['status'] == 'open'
        assert 'id' in result['bug_report']
    
    def test_create_bug_report_minimal(self, client, auth_headers_user_a):
        """Test creating bug report with only required fields."""
        data = {
            'title': 'Minimal Bug Report',
            'description': 'Only required fields provided'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        result = response.json
        assert result['bug_report']['severity'] == 'medium'  # Default
        assert result['bug_report']['category'] == 'other'  # Default
        assert result['bug_report']['priority'] == 3  # Default
    
    def test_create_bug_report_missing_title(self, client, auth_headers_user_a):
        """Test creating bug report without title fails."""
        data = {
            'description': 'Description without title'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'title' in response.json.get('error', '').lower()
    
    def test_create_bug_report_missing_description(self, client, auth_headers_user_a):
        """Test creating bug report without description fails."""
        data = {
            'title': 'Title without description'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'description' in response.json.get('error', '').lower()
    
    def test_create_bug_report_unauthenticated(self, client):
        """Test creating bug report without authentication fails."""
        data = {
            'title': 'Unauthorized Bug',
            'description': 'This should fail'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            content_type='application/json'
        )
        
        assert response.status_code == 401
    
    def test_get_bug_report(self, client, auth_headers_user_a, sample_bug_report):
        """Test getting a specific bug report."""
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        result = response.json
        assert result['title'] == 'Test Bug Report'
        assert result['severity'] == 'medium'
        assert result['status'] == 'open'
    
    def test_get_bug_report_not_found(self, client, auth_headers_user_a):
        """Test getting non-existent bug report returns 404."""
        response = client.get(
            '/api/bug-reports/507f1f77bcf86cd799439011',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 404
    
    def test_update_bug_report(self, client, auth_headers_user_a, sample_bug_report):
        """Test updating a bug report."""
        data = {
            'title': 'Updated Bug Title',
            'severity': 'critical',
            'priority': 1
        }
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        result = response.json
        assert result['bug_report']['title'] == 'Updated Bug Title'
        assert result['bug_report']['severity'] == 'critical'
        assert result['bug_report']['priority'] == 1
    
    def test_update_bug_report_status(self, client, auth_headers_user_a, sample_bug_report):
        """Test updating bug report status."""
        data = {
            'status': 'in_progress'
        }
        
        response = client.patch(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['bug_report']['status'] == 'in_progress'
    
    def test_delete_bug_report(self, client, auth_headers_user_a, sample_bug_report):
        """Test deleting a bug report."""
        response = client.delete(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['message'] == 'Bug report deleted successfully'
        
        # Verify deletion
        deleted_bug = BugReport.objects(id=sample_bug_report.id).first()
        assert deleted_bug is None


# =============================================================================
# Access Control Tests
# =============================================================================

class TestBugReportAccessControl:
    """Tests for role-based access control on bug reports."""
    
    def test_user_sees_only_own_bug_reports(
        self, client, auth_headers_user_a, sample_bug_reports
    ):
        """Test that regular users only see their own bug reports."""
        response = client.get(
            '/api/bug-reports',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        # user_a created 3 bug reports
        assert response.json['total'] == 3
        for bug in response.json['bug_reports']:
            assert 'User A' in bug['title']
    
    def test_superadmin_sees_all_bug_reports(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test that SuperAdmin sees all bug reports."""
        response = client.get(
            '/api/bug-reports',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        # Total: 3 from user_a + 2 from user_b + 1 from superadmin = 6
        assert response.json['total'] == 6
    
    def test_user_cannot_access_other_user_bug(
        self, client, auth_headers_user_b, sample_bug_report
    ):
        """Test user cannot access another user's bug report."""
        # sample_bug_report is created by user_a
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_user_b
        )
        
        assert response.status_code == 403
    
    def test_superadmin_can_access_any_bug(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test SuperAdmin can access any bug report."""
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
    
    def test_user_cannot_update_other_user_bug(
        self, client, auth_headers_user_b, sample_bug_report
    ):
        """Test user cannot update another user's bug report."""
        data = {'title': 'Hacked Title'}
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_user_b
        )
        
        assert response.status_code == 403
    
    def test_superadmin_can_update_any_bug(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test SuperAdmin can update any bug report."""
        data = {'status': 'resolved'}
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
    
    def test_user_cannot_delete_other_user_bug(
        self, client, auth_headers_user_b, sample_bug_report
    ):
        """Test user cannot delete another user's bug report."""
        response = client.delete(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_user_b
        )
        
        assert response.status_code == 403
    
    def test_superadmin_can_delete_any_bug(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test SuperAdmin can delete any bug report."""
        response = client.delete(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
    
    def test_my_bug_reports_endpoint(
        self, client, auth_headers_user_a, sample_bug_reports
    ):
        """Test /my-bug-reports returns only user's own reports."""
        response = client.get(
            '/api/my-bug-reports',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert response.json['total'] == 3


# =============================================================================
# Comment Tests
# =============================================================================

class TestBugReportComments:
    """Tests for bug report comment functionality."""
    
    def test_add_comment(self, client, auth_headers_user_a, sample_bug_report):
        """Test adding a comment to a bug report."""
        data = {
            'comment': 'This is a test comment on the bug report.'
        }
        
        response = client.post(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 201
        assert response.json['message'] == 'Comment added successfully'
        assert len(response.json['comments']) == 1
        assert response.json['comments'][0]['comment'] == data['comment']
    
    def test_add_multiple_comments(
        self, client, auth_headers_user_a, sample_bug_report
    ):
        """Test adding multiple comments."""
        comments = ['First comment', 'Second comment', 'Third comment']
        
        for comment_text in comments:
            response = client.post(
                f'/api/bug-reports/{sample_bug_report.id}/comments',
                data=json.dumps({'comment': comment_text}),
                headers=auth_headers_user_a
            )
            assert response.status_code == 201
        
        # Get all comments
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert len(response.json['comments']) == 3
    
    def test_add_comment_empty_fails(
        self, client, auth_headers_user_a, sample_bug_report
    ):
        """Test adding empty comment fails."""
        data = {'comment': ''}
        
        response = client.post(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_superadmin_can_comment_on_any_bug(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test SuperAdmin can add comments to any bug."""
        data = {'comment': 'SuperAdmin comment'}
        
        response = client.post(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            data=json.dumps(data),
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 201
    
    def test_user_cannot_comment_on_other_user_bug(
        self, client, auth_headers_user_b, sample_bug_report
    ):
        """Test user cannot comment on another user's bug."""
        data = {'comment': 'Unauthorized comment'}
        
        response = client.post(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            data=json.dumps(data),
            headers=auth_headers_user_b
        )
        
        assert response.status_code == 403


# =============================================================================
# Statistics Tests
# =============================================================================

class TestBugReportStatistics:
    """Tests for bug report statistics endpoint."""
    
    def test_superadmin_can_access_statistics(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test SuperAdmin can access statistics."""
        response = client.get(
            '/api/bug-reports/statistics',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        stats = response.json
        assert 'total_reports' in stats
        assert 'by_status' in stats
        assert 'by_severity' in stats
        assert 'by_category' in stats
        assert stats['total_reports'] == 6
    
    def test_regular_user_cannot_access_statistics(
        self, client, auth_headers_user_a
    ):
        """Test regular user cannot access statistics."""
        response = client.get(
            '/api/bug-reports/statistics',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 403
    
    def test_recent_bugs_superadmin_only(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test recent bugs endpoint is SuperAdmin only."""
        response = client.get(
            '/api/bug-reports/recent',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert 'bug_reports' in response.json
    
    def test_critical_bugs_superadmin_only(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test critical bugs endpoint is SuperAdmin only."""
        response = client.get(
            '/api/bug-reports/critical',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        # One critical bug from superadmin
        assert len(response.json['bug_reports']) >= 1


# =============================================================================
# Filter and Search Tests
# =============================================================================

class TestBugReportFiltering:
    """Tests for bug report filtering and search."""
    
    def test_filter_by_status(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test filtering bug reports by status."""
        response = client.get(
            '/api/bug-reports?status=open',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        for bug in response.json['bug_reports']:
            assert bug['status'] == 'open'
    
    def test_filter_by_severity(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test filtering bug reports by severity."""
        response = client.get(
            '/api/bug-reports?severity=critical',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        for bug in response.json['bug_reports']:
            assert bug['severity'] == 'critical'
    
    def test_filter_by_category(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test filtering bug reports by category."""
        response = client.get(
            '/api/bug-reports?category=api',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        for bug in response.json['bug_reports']:
            assert bug['category'] == 'api'
    
    def test_filter_by_priority(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test filtering bug reports by priority."""
        response = client.get(
            '/api/bug-reports?priority=1',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        for bug in response.json['bug_reports']:
            assert bug['priority'] == 1
    
    def test_pagination(
        self, client, auth_headers_superadmin, sample_bug_reports
    ):
        """Test pagination of bug reports."""
        response = client.get(
            '/api/bug-reports?page=1&per_page=2',
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert len(response.json['bug_reports']) <= 2
        assert response.json['page'] == 1
        assert response.json['per_page'] == 2
        assert response.json['pages'] >= 1


# =============================================================================
# Validation Tests
# =============================================================================

class TestBugReportValidation:
    """Tests for bug report validation."""
    
    def test_title_too_long(self, client, auth_headers_user_a):
        """Test title exceeding max length fails."""
        data = {
            'title': 'A' * 250,  # Max is 200
            'description': 'Valid description'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
        assert 'title' in response.json.get('error', '').lower()
    
    def test_invalid_severity(self, client, auth_headers_user_a):
        """Test invalid severity value fails."""
        data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'severity': 'invalid_severity'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_invalid_category(self, client, auth_headers_user_a):
        """Test invalid category value fails."""
        data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'category': 'invalid_category'
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_invalid_status(self, client, auth_headers_user_a, sample_bug_report):
        """Test invalid status value fails."""
        data = {'status': 'invalid_status'}
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_invalid_priority_too_low(self, client, auth_headers_user_a):
        """Test priority below 1 fails."""
        data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'priority': 0
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_invalid_priority_too_high(self, client, auth_headers_user_a):
        """Test priority above 5 fails."""
        data = {
            'title': 'Valid Title',
            'description': 'Valid description',
            'priority': 6
        }
        
        response = client.post(
            '/api/bug-reports',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400
    
    def test_comment_too_long(self, client, auth_headers_user_a, sample_bug_report):
        """Test comment exceeding max length fails."""
        data = {
            'comment': 'A' * 2500  # Max is 2000
        }
        
        response = client.post(
            f'/api/bug-reports/{sample_bug_report.id}/comments',
            data=json.dumps(data),
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 400


# =============================================================================
# Resolution Tests
# =============================================================================

class TestBugReportResolution:
    """Tests for bug report resolution workflow."""
    
    def test_resolve_bug_report(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test resolving a bug report with notes."""
        data = {
            'status': 'resolved',
            'resolution_notes': 'Fixed in version 1.2.3'
        }
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert response.json['bug_report']['status'] == 'resolved'
    
    def test_close_bug_report(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test closing a bug report."""
        data = {'status': 'closed'}
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert response.json['bug_report']['status'] == 'closed'
    
    def test_mark_wont_fix(
        self, client, auth_headers_superadmin, sample_bug_report
    ):
        """Test marking a bug as won't fix."""
        data = {
            'status': 'wont_fix',
            'resolution_notes': 'This is expected behavior'
        }
        
        response = client.put(
            f'/api/bug-reports/{sample_bug_report.id}',
            data=json.dumps(data),
            headers=auth_headers_superadmin
        )
        
        assert response.status_code == 200
        assert response.json['bug_report']['status'] == 'wont_fix'


# =============================================================================
# File Attachment Tests (Basic - actual file upload tested separately)
# =============================================================================

class TestBugReportAttachments:
    """Tests for bug report file attachments (mocked)."""
    
    def test_get_bug_with_attachments(
        self, client, auth_headers_user_a, sample_bug_report
    ):
        """Test getting bug report includes attachments list."""
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 200
        assert 'attachments' in response.json
        assert isinstance(response.json['attachments'], list)
    
    def test_get_nonexistent_attachment(
        self, client, auth_headers_user_a, sample_bug_report
    ):
        """Test getting non-existent attachment returns 404."""
        response = client.get(
            f'/api/bug-reports/{sample_bug_report.id}/attachments/0',
            headers=auth_headers_user_a
        )
        
        assert response.status_code == 404


# =============================================================================
# Model Tests
# =============================================================================

class TestBugReportModel:
    """Tests for BugReport model methods."""
    
    def test_to_dict_method(self, sample_bug_report):
        """Test BugReport.to_dict() method."""
        data = sample_bug_report.to_dict()
        
        assert 'id' in data
        assert data['title'] == 'Test Bug Report'
        assert data['severity'] == 'medium'
        assert data['status'] == 'open'
        assert 'reported_by' in data
        assert 'created_at' in data
    
    def test_default_values(self, user_a):
        """Test default values are set correctly."""
        bug = BugReport(
            title='Test Defaults',
            description='Testing default values',
            reported_by=user_a
        ).save()
        
        assert bug.severity == 'medium'
        assert bug.category == 'other'
        assert bug.status == 'open'
        assert bug.priority == 3
        assert bug.attachments == []
        assert bug.comments == []
    
    def test_indexes_exist(self):
        """Test that model indexes are defined."""
        # Check that indexes are defined in meta
        assert 'indexes' in BugReport._meta
        indexes = BugReport._meta['indexes']
        
        # Should have indexes for common queries
        index_fields = []
        for idx in indexes:
            if isinstance(idx, str):
                index_fields.append(idx)
            elif isinstance(idx, tuple):
                index_fields.extend(idx)
        
        assert 'reported_by' in index_fields or any('reported_by' in str(i) for i in indexes)
        assert 'status' in index_fields or any('status' in str(i) for i in indexes)


# =============================================================================
# Service Tests
# =============================================================================

class TestBugReportService:
    """Tests for BugReportService."""
    
    def test_get_bug_statistics(self, sample_bug_reports):
        """Test getting bug statistics."""
        from src.services.bug_report_service import get_bug_report_service
        
        service = get_bug_report_service()
        stats = service.get_bug_statistics()
        
        assert stats['total_reports'] == 6
        assert 'by_status' in stats
        assert 'by_severity' in stats
        assert 'by_category' in stats
        assert 'open' in stats['by_status']
    
    def test_add_comment_service(self, sample_bug_report, user_a):
        """Test adding comment via service."""
        from src.services.bug_report_service import get_bug_report_service
        
        service = get_bug_report_service()
        result = service.add_comment(
            bug_report_id=str(sample_bug_report.id),
            user_id=str(user_a.id),
            comment='Service test comment'
        )
        
        assert result['success'] is True
        assert len(result['comments']) == 1
    
    def test_update_status_service(self, sample_bug_report, superadmin):
        """Test updating status via service."""
        from src.services.bug_report_service import get_bug_report_service
        
        service = get_bug_report_service()
        result = service.update_status(
            bug_report_id=str(sample_bug_report.id),
            new_status='in_progress',
            user_id=str(superadmin.id)
        )
        
        assert result['success'] is True
        assert result['bug_report']['status'] == 'in_progress'
    
    def test_get_user_bug_reports_service(self, sample_bug_reports, user_a):
        """Test getting user's bug reports via service."""
        from src.services.bug_report_service import get_bug_report_service
        
        service = get_bug_report_service()
        result = service.get_user_bug_reports(str(user_a.id))
        
        assert result['success'] is True
        assert len(result['bug_reports']) == 3


# =============================================================================
# Validator Tests
# =============================================================================

class TestBugReportValidators:
    """Tests for bug report validators."""
    
    def test_validate_bug_report_title(self):
        """Test title validation."""
        from src.validators import validate_bug_report_title, ValidationError
        
        # Valid title
        assert validate_bug_report_title('Valid Title') == 'Valid Title'
        
        # Empty title
        with pytest.raises(ValidationError):
            validate_bug_report_title('')
        
        # Title too long
        with pytest.raises(ValidationError):
            validate_bug_report_title('A' * 250)
    
    def test_validate_bug_severity(self):
        """Test severity validation."""
        from src.validators import validate_bug_severity, ValidationError
        
        # Valid severities
        assert validate_bug_severity('low') == 'low'
        assert validate_bug_severity('MEDIUM') == 'medium'
        assert validate_bug_severity(None) == 'medium'  # Default
        
        # Invalid severity
        with pytest.raises(ValidationError):
            validate_bug_severity('invalid')
    
    def test_validate_bug_category(self):
        """Test category validation."""
        from src.validators import validate_bug_category, ValidationError
        
        # Valid categories
        assert validate_bug_category('api') == 'api'
        assert validate_bug_category('UI') == 'ui'
        assert validate_bug_category(None) == 'other'  # Default
        
        # Invalid category
        with pytest.raises(ValidationError):
            validate_bug_category('invalid')
    
    def test_validate_bug_status(self):
        """Test status validation."""
        from src.validators import validate_bug_status, ValidationError
        
        # Valid statuses
        assert validate_bug_status('open') == 'open'
        assert validate_bug_status('IN_PROGRESS') == 'in_progress'
        assert validate_bug_status(None) == 'open'  # Default
        
        # Invalid status
        with pytest.raises(ValidationError):
            validate_bug_status('invalid')
    
    def test_validate_bug_priority(self):
        """Test priority validation."""
        from src.validators import validate_bug_priority, ValidationError
        
        # Valid priorities
        assert validate_bug_priority(1) == 1
        assert validate_bug_priority(5) == 5
        assert validate_bug_priority(None) == 3  # Default
        
        # Invalid priorities
        with pytest.raises(ValidationError):
            validate_bug_priority(0)
        
        with pytest.raises(ValidationError):
            validate_bug_priority(6)
    
    def test_validate_bug_comment(self):
        """Test comment validation."""
        from src.validators import validate_bug_comment, ValidationError
        
        # Valid comment
        assert validate_bug_comment('Valid comment') == 'Valid comment'
        
        # Empty comment
        with pytest.raises(ValidationError):
            validate_bug_comment('')
        
        # Comment too long
        with pytest.raises(ValidationError):
            validate_bug_comment('A' * 2500)
    
    def test_validate_bug_report_data(self):
        """Test complete bug report data validation."""
        from src.validators import validate_bug_report_data, ValidationError
        
        # Valid data
        data = {
            'title': 'Test Bug',
            'description': 'Test description',
            'severity': 'high',
            'category': 'api'
        }
        validated = validate_bug_report_data(data)
        assert validated['title'] == 'Test Bug'
        assert validated['severity'] == 'high'
        
        # Missing required fields
        with pytest.raises(ValidationError):
            validate_bug_report_data({'title': 'Only title'})
