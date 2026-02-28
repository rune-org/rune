from src.core.config import Settings


def make_settings(cors_origins_raw: str) -> Settings:
    """Helper to build a Settings instance with a custom cors_origins_raw value,
    bypassing .env loading."""
    return Settings(
        cors_origins_raw=cors_origins_raw,
        postgres_user="test",
        postgres_password="test",
        postgres_db="test",
    )


# ============================================================================
# VALID INPUTS
# ============================================================================


def test_cors_origins_comma_separated():
    """Standard comma-separated string should be split into a list."""
    s = make_settings("http://localhost:3000,http://frontend:3000")
    assert s.cors_origins == ["http://localhost:3000", "http://frontend:3000"]


def test_cors_origins_single_origin():
    """A single origin with no commas should return a list with one item."""
    s = make_settings("http://localhost:3000")
    assert s.cors_origins == ["http://localhost:3000"]


def test_cors_origins_strips_whitespace():
    """Whitespace around origins should be stripped."""
    s = make_settings("  http://localhost:3000 ,  http://frontend:3000  ")
    assert s.cors_origins == ["http://localhost:3000", "http://frontend:3000"]


def test_cors_origins_bracket_style():
    """JSON-style bracket string should be parsed correctly."""
    s = make_settings("[http://localhost:3000, http://frontend:3000]")
    assert s.cors_origins == ["http://localhost:3000", "http://frontend:3000"]


def test_cors_origins_bracket_single():
    """JSON-style bracket string with one origin should return a single-item list."""
    s = make_settings("[http://localhost:3000]")
    assert s.cors_origins == ["http://localhost:3000"]


def test_cors_origins_default_value():
    """Default cors_origins_raw should parse to the three default origins."""
    s = Settings(postgres_user="test", postgres_password="test", postgres_db="test")
    assert s.cors_origins == [
        "http://localhost:3000",
        "http://frontend:3000",
        "http://127.0.0.1:3000",
    ]


def test_cors_origins_filters_blank_entries():
    """Blank/empty entries within commas should be silently filtered."""
    s = make_settings("http://localhost:3000,,http://frontend:3000")
    assert s.cors_origins == ["http://localhost:3000", "http://frontend:3000"]


def test_cors_origins_returns_list_type():
    """cors_origins should always return a list."""
    s = make_settings("http://localhost:3000")
    assert isinstance(s.cors_origins, list)
