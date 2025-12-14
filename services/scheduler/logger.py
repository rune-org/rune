"""Logging configuration for scheduler service."""

import logging
import sys


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """
    Configure comprehensive logging with fallback mechanisms.
    
    Logs go to:
    - stdout (for Docker logs)
    - stderr (for critical errors)
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Configured logger instance
    """
    log_format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
        force=True
    )
    
    # Create scheduler logger
    logger = logging.getLogger("scheduler")
    
    # Add error handler to stderr for critical issues
    error_handler = logging.StreamHandler(sys.stderr)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    logger.addHandler(error_handler)
    
    return logger
