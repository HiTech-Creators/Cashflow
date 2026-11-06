"""
Services module for Flowback Cashflow API.
Contains automated services like invoice generation, scheduled tasks, speech processing, and data export/import.
"""

from src.services.invoice_automation import (
    generate_invoice_from_template,
    generate_invoice_number,
    process_automated_invoices,
    update_overdue_invoices,
    calculate_next_generation_date,
    get_invoice_summary
)

from src.services.speech_service import (
    SpeechService,
    get_speech_service
)

from src.services.export_service import (
    ExportService,
    get_export_service
)

__all__ = [
    # Invoice automation
    'generate_invoice_from_template',
    'generate_invoice_number',
    'process_automated_invoices',
    'update_overdue_invoices',
    'calculate_next_generation_date',
    'get_invoice_summary',
    # Speech service
    'SpeechService',
    'get_speech_service',
    # Export service
    'ExportService',
    'get_export_service'
]
