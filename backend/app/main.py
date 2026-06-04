"""
FastAPI entry point — Chani Kramer Wigs Salon backend.

All routes are registered here. The app is started with:
  uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import employees, customers, transactions, daily_summary, expenses, payroll, deposits, financials, users, ella, wig_orders, board_posts, notifications, checkins, inventory, pos_sales, time_logs, providers, repair_services, reports
from app.core.config import settings

app = FastAPI(
    title="Chani Kramer Wigs Salon API",
    version="1.0.0",
    description="Backend for the Chani Kramer Wigs Salon management system",
)

# ── CORS — allow the React frontend to talk to this API ──────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers ─────────────────────────────────────
app.include_router(users.router,         prefix="/api/v1")
app.include_router(employees.router,     prefix="/api/v1")
app.include_router(customers.router,     prefix="/api/v1")
app.include_router(transactions.router,  prefix="/api/v1")
app.include_router(daily_summary.router, prefix="/api/v1")
app.include_router(expenses.router,      prefix="/api/v1")
app.include_router(payroll.router,       prefix="/api/v1")
app.include_router(deposits.router,      prefix="/api/v1")
app.include_router(financials.router,    prefix="/api/v1")
app.include_router(ella.router,          prefix="/api/v1")
app.include_router(wig_orders.router,    prefix="/api/v1")
app.include_router(board_posts.router,   prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(checkins.router,      prefix="/api/v1")
app.include_router(inventory.router,     prefix="/api/v1")
app.include_router(pos_sales.router,    prefix="/api/v1")
app.include_router(time_logs.router,    prefix="/api/v1")
app.include_router(providers.router,       prefix="/api/v1")
app.include_router(repair_services.router, prefix="/api/v1")
app.include_router(reports.router,         prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "chani-kramer-salon"}
