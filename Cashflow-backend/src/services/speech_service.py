"""
Speech Service for Flowback Cashflow API.

This module provides speech-based interaction capabilities including:
- Speech-to-forecast conversion using Claude AI
- Report-to-speech summary generation
- Invoice speech summaries
- Transcription processing

Dependencies:
    pip install SpeechRecognition pyttsx3 anthropic
"""

import os
import json
from typing import Dict, Any, Optional, Union
from flask import current_app
import anthropic

from src.models import utc_now


class SpeechService:
    """
    Service for processing speech input and generating speech-friendly output.
    
    Uses Anthropic Claude for natural language processing and extraction.
    """
    
    def __init__(self):
        """Initialize the speech service with Anthropic client."""
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        
        self.anthropic_client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"
    
    def process_speech_to_forecast(
        self,
        transcript: str,
        company_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Convert speech transcript to structured forecast data using Claude.
        
        Args:
            transcript: The speech transcript text
            company_id: The company ID for context
            context: Optional additional context (e.g., recent transactions, current balance)
        
        Returns:
            Dict containing structured forecast data:
            - scenario_name: Name for the forecast scenario
            - forecast_period: {start_date, end_date}
            - projections: {expected_revenue, expected_expenses, net_cash_flow}
            - assumptions: List of assumptions made
            - confidence_level: Confidence in the forecast (low/medium/high)
        
        Raises:
            ValueError: If transcript is empty or invalid
            anthropic.APIError: If Claude API call fails
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript cannot be empty")
        
        context_str = ""
        if context:
            context_str = f"""
            
Additional context about the company:
- Current balance: {context.get('current_balance', 'Unknown')}
- Recent monthly revenue: {context.get('monthly_revenue', 'Unknown')}
- Recent monthly expenses: {context.get('monthly_expenses', 'Unknown')}
- Industry: {context.get('industry', 'Not specified')}
"""
        
        prompt = f"""You are a financial analyst assistant. Extract structured financial forecast data from this speech transcript.

TRANSCRIPT:
{transcript}
{context_str}

Analyze the transcript and extract forecast information. Return ONLY valid JSON with this exact structure:
{{
    "scenario_name": "string - descriptive name for this forecast scenario",
    "forecast_period": {{
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "duration_months": number
    }},
    "projections": {{
        "expected_revenue": number,
        "expected_expenses": number,
        "net_cash_flow": number,
        "monthly_breakdown": [
            {{"month": "YYYY-MM", "revenue": number, "expenses": number}}
        ]
    }},
    "assumptions": ["list of assumptions made"],
    "confidence_level": "low|medium|high",
    "notes": "any additional notes or caveats"
}}

If specific numbers aren't mentioned, make reasonable estimates based on context and note them in assumptions.
If dates aren't specified, assume starting from next month for the duration mentioned (default 12 months).
Return ONLY the JSON, no explanation."""

        try:
            message = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            
            # Handle potential markdown code blocks
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])
            
            forecast_data = json.loads(response_text)
            
            # Add metadata
            forecast_data['company_id'] = company_id
            forecast_data['created_from'] = 'speech'
            forecast_data['created_at'] = utc_now().isoformat()
            
            current_app.logger.info(
                f"Successfully extracted forecast from speech for company {company_id}"
            )
            
            return forecast_data
            
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Failed to parse Claude response as JSON: {e}")
            raise ValueError(f"Failed to extract structured data from speech: {str(e)}")
        except anthropic.APIError as e:
            current_app.logger.error(f"Anthropic API error: {e}")
            raise
    
    def generate_report_speech(
        self,
        report_data: Dict[str, Any],
        report_type: str = "general",
        style: str = "conversational"
    ) -> str:
        """
        Convert report data to a speech-friendly summary.
        
        Args:
            report_data: The report data to summarize
            report_type: Type of report (general, cashflow, forecast, invoice)
            style: Speech style (conversational, formal, brief)
        
        Returns:
            str: Speech-friendly text summary
        """
        style_instructions = {
            "conversational": "Make it conversational and easy to understand when read aloud. Use natural language.",
            "formal": "Use professional business language suitable for executive briefings.",
            "brief": "Keep it very concise, hitting only the key points in under 100 words."
        }
        
        prompt = f"""Create a spoken summary of this {report_type} financial report.

REPORT DATA:
{json.dumps(report_data, indent=2, default=str)}

INSTRUCTIONS:
{style_instructions.get(style, style_instructions['conversational'])}

- Use numbers in a speakable format (e.g., "fifty thousand dollars" instead of "$50,000")
- Round large numbers appropriately for speech
- Highlight key insights and trends
- Include any warnings or concerns if relevant
- End with a brief conclusion or recommendation if appropriate

Return ONLY the speech text, no formatting or headers."""

        try:
            message = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return message.content[0].text.strip()
            
        except anthropic.APIError as e:
            current_app.logger.error(f"Failed to generate report speech: {e}")
            raise
    
    def generate_invoice_speech(
        self,
        invoice_data: Dict[str, Any],
        include_line_items: bool = True
    ) -> str:
        """
        Generate a speech summary of an invoice.
        
        Args:
            invoice_data: Invoice data dictionary
            include_line_items: Whether to include line item details
        
        Returns:
            str: Speech-friendly invoice summary
        """
        line_items_instruction = ""
        if not include_line_items:
            line_items_instruction = "Do not list individual line items, just mention the count."
        
        prompt = f"""Create a spoken summary of this invoice for verbal communication.

INVOICE DATA:
{json.dumps(invoice_data, indent=2, default=str)}

INSTRUCTIONS:
- State the invoice number and customer name clearly
- Mention the total amount in speakable format
- State the due date and current status
- {line_items_instruction}
- If overdue, emphasize this appropriately

Return ONLY the speech text."""

        try:
            message = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return message.content[0].text.strip()
            
        except anthropic.APIError as e:
            current_app.logger.error(f"Failed to generate invoice speech: {e}")
            raise
    
    def generate_dashboard_speech(
        self,
        dashboard_data: Dict[str, Any]
    ) -> str:
        """
        Generate a speech summary of dashboard KPIs.
        
        Args:
            dashboard_data: Dashboard data including KPIs, balance, inflows, outflows
        
        Returns:
            str: Speech-friendly dashboard summary
        """
        prompt = f"""Create a brief spoken summary of this financial dashboard for a quick verbal update.

DASHBOARD DATA:
{json.dumps(dashboard_data, indent=2, default=str)}

INSTRUCTIONS:
- Start with the current cash position
- Highlight key trends (inflows vs outflows)
- Mention burn rate and runway if available
- Note any concerning metrics
- Keep it under 150 words for a quick update

Return ONLY the speech text."""

        try:
            message = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return message.content[0].text.strip()
            
        except anthropic.APIError as e:
            current_app.logger.error(f"Failed to generate dashboard speech: {e}")
            raise
    
    def process_speech_command(
        self,
        transcript: str,
        available_actions: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Parse a speech command to determine user intent and parameters.
        
        Args:
            transcript: The speech transcript
            available_actions: List of available actions to match against
        
        Returns:
            Dict with 'action', 'parameters', and 'confidence'
        """
        if available_actions is None:
            available_actions = [
                "create_transaction",
                "create_forecast",
                "view_dashboard",
                "generate_report",
                "create_invoice",
                "check_balance",
                "list_transactions",
                "unknown"
            ]
        
        prompt = f"""Parse this voice command to determine the user's intent.

COMMAND:
{transcript}

AVAILABLE ACTIONS:
{json.dumps(available_actions)}

Return JSON with:
{{
    "action": "one of the available actions",
    "parameters": {{
        "any relevant parameters extracted from the command"
    }},
    "confidence": "low|medium|high",
    "clarification_needed": "question to ask if intent is unclear, or null"
}}

Return ONLY the JSON."""

        try:
            message = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            
            response_text = message.content[0].text.strip()
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])
            
            return json.loads(response_text)
            
        except (json.JSONDecodeError, anthropic.APIError) as e:
            current_app.logger.error(f"Failed to parse speech command: {e}")
            return {
                "action": "unknown",
                "parameters": {},
                "confidence": "low",
                "clarification_needed": "I couldn't understand that command. Could you please rephrase?"
            }


def get_speech_service() -> SpeechService:
    """
    Factory function to get a SpeechService instance.
    
    Returns:
        SpeechService: Configured speech service instance
    
    Raises:
        ValueError: If ANTHROPIC_API_KEY is not configured
    """
    return SpeechService()
