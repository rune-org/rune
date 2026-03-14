import logging
import os
import sys
from dotenv import load_dotenv

load_dotenv()

POSTGRES_DSN = (
    f"postgresql://{os.getenv('POSTGRES_USER', 'rune')}:{os.getenv('POSTGRES_PASSWORD', 'rune_password')}"
    f"@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{os.getenv('POSTGRES_DB', 'rune_db')}"
)

POLL_INTERVAL = int(os.getenv("SCHEDULER_POLL_INTERVAL", "30"))
API_BASE_URL = os.getenv("API_BASE_URL", "http://api:8000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("scheduler")
