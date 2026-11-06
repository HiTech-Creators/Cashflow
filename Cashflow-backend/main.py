import os
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, g, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mongoengine_patch import patch_flask_for_mongoengine
from flask_mongoengine import MongoEngine
from flask_talisman import Talisman
from flask_mail import Mail
from flask_apscheduler import APScheduler

from src.config import Config
from src.constants import HTTP_OK, HTTP_SERVICE_UNAVAILABLE
from src.models import (
    Role, User, Company, Transaction, InitialBalance,
    UserPreferences, Forecast, Receivable, Payable, Inventory, Budget, UserInvitation,
    InvoiceTemplate, Invoice,
    # Phase 4: Sidebar Modules
    BankStatement, ReconciliationItem, Drawing, EquityAccount,
    Employee, SalaryPayment, ExpenseAccount,
    # Phase 5: Bug Report Forum
    BugReport
)
from src.api_routes import (
    auth_bp, transactions_bp, forecasts_bp, dashboard_bp,
    working_capital_bp, budgets_bp, companies_bp, users_bp,
    admin_bp, ai_bp, core_bp, analytics_bp, invoices_bp
)
# Phase 4: Sidebar Module Routes
from src.routes.reconciliation_routes import reconciliation_bp
from src.routes.drawings_routes import drawings_bp
from src.routes.salary_routes import salary_bp
# Phase 5: Bug Report Forum
from src.routes.bug_report_routes import bug_reports_bp


load_dotenv()

patch_flask_for_mongoengine()


def create_app() -> Flask:
    app = Flask(
        __name__,
        template_folder='templates',
        static_folder='static',
        instance_relative_config=True
    )

    app.config.from_object(Config)

    _ensure_directories()

    mongo = MongoEngine(app)
    jwt = JWTManager(app)
    mail = Mail(app)
    scheduler = APScheduler()
    scheduler.init_app(app)
    scheduler.start()

    CORS(
        app,
        origins="*",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["X-Request-ID"],
        max_age=3600
    )

    Talisman(
        app,
        force_https=os.environ.get('FLASK_ENV') == 'production',
        strict_transport_security=True,
        strict_transport_security_max_age=31536000,
        content_security_policy={
            'default-src': "'self'",
            'script-src': "'self'",
            'style-src': "'self'",
            'img-src': "'self' data:",
            'font-src': "'self'",
        },
        content_security_policy_nonce_in=['script-src'],
        frame_options='DENY',
        referrer_policy='strict-origin-when-cross-origin',
        feature_policy={
            'geolocation': "'none'",
            'camera': "'none'",
            'microphone': "'none'",
        }
    )

    @jwt.invalid_token_loader
    def _invalid_token_callback(error: str) -> tuple[Response, int]:
        return jsonify({"error": "Invalid token", "details": error}), 401

    @jwt.unauthorized_loader
    def _unauthorized_callback(error: str) -> tuple[Response, int]:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    @jwt.expired_token_loader
    def _expired_token_callback(jwt_header: dict, jwt_payload: dict) -> tuple[Response, int]:
        return jsonify({"error": "Token has expired"}), 401

    @app.before_request
    def _add_request_id() -> None:
        g.request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        app.logger.info(f"[{g.request_id}] {request.method} {request.path}")

    @app.after_request
    def _add_request_id_header(response: Response) -> Response:
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        return response

    @app.after_request
    def _add_security_headers(response: Response) -> Response:
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['X-Download-Options'] = 'noopen'
        response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
        return response

    _register_blueprints(app)

    with app.app_context():
        _ensure_indexes(app)

    _register_health_endpoints(app)

    return app


def _ensure_directories() -> None:
    instance_path = os.path.join(os.path.dirname(__file__), 'instance')
    upload_path = os.path.join(os.path.dirname(__file__), 'uploads')
    bug_reports_upload_path = os.path.join(os.path.dirname(__file__), 'uploads', 'bug_reports')
    os.makedirs(instance_path, exist_ok=True)
    os.makedirs(upload_path, exist_ok=True)
    os.makedirs(bug_reports_upload_path, exist_ok=True)


def _register_blueprints(app: Flask) -> None:
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(transactions_bp, url_prefix='/api')
    app.register_blueprint(forecasts_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(working_capital_bp, url_prefix='/api')
    app.register_blueprint(budgets_bp, url_prefix='/api')
    app.register_blueprint(companies_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(ai_bp, url_prefix='/api')
    app.register_blueprint(core_bp, url_prefix='/')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(invoices_bp, url_prefix='/api')
    # Phase 4: Sidebar Modules
    app.register_blueprint(reconciliation_bp, url_prefix='/api')
    app.register_blueprint(drawings_bp, url_prefix='/api')
    app.register_blueprint(salary_bp, url_prefix='/api')
    # Phase 5: Bug Report Forum
    app.register_blueprint(bug_reports_bp, url_prefix='/api')


def _ensure_indexes(app: Flask) -> None:
    try:
        Role.ensure_indexes()
        User.ensure_indexes()
        Company.ensure_indexes()
        Transaction.ensure_indexes()
        InitialBalance.ensure_indexes()
        UserPreferences.ensure_indexes()
        Forecast.ensure_indexes()
        Receivable.ensure_indexes()
        Payable.ensure_indexes()
        Inventory.ensure_indexes()
        Budget.ensure_indexes()
        UserInvitation.ensure_indexes()
        InvoiceTemplate.ensure_indexes()
        Invoice.ensure_indexes()
        # Phase 4: Sidebar Modules
        BankStatement.ensure_indexes()
        ReconciliationItem.ensure_indexes()
        Drawing.ensure_indexes()
        EquityAccount.ensure_indexes()
        Employee.ensure_indexes()
        SalaryPayment.ensure_indexes()
        ExpenseAccount.ensure_indexes()
        # Phase 5: Bug Report Forum
        BugReport.ensure_indexes()
        app.logger.info("Database indexes ensured successfully")
    except Exception as e:
        app.logger.error(f"Error ensuring indexes: {e}")


def _register_health_endpoints(app: Flask) -> None:

    @app.route('/health', methods=['GET'])
    @app.route('/status', methods=['GET'])
    def health_check() -> tuple[Response, int]:
        status: dict[str, Any] = {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
            "service": "Cashflow Backend API"
        }

        try:
            User.objects().first()
            status["database"] = "connected"
        except Exception as e:
            status["status"] = "unhealthy"
            status["database"] = "disconnected"
            status["error"] = str(e)
            return jsonify(status), HTTP_SERVICE_UNAVAILABLE

        try:
            import redis
            redis_url = os.environ.get('REDIS_URL')
            if redis_url and redis_url != 'memory://':
                r = redis.from_url(redis_url)
                r.ping()
                status["redis"] = "connected"
            else:
                status["redis"] = "not configured (using memory)"
        except Exception as e:
            status["redis"] = f"error: {str(e)}"

        return jsonify(status), HTTP_OK

app = create_app()


if __name__ == '__main__':
    app.run(debug=True)
