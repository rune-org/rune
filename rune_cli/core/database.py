"""
Database Operations

Direct database operations for maintenance and management.
"""

from typing import Optional, List, Dict, Any, Tuple
from rune_cli.core.docker import DockerClient, DockerError, get_docker_client
from rune_cli.core.config import get_config


class DatabaseError(Exception):
    """Database operation error."""
    pass


class DatabaseManager:
    """Manager for database operations via Docker."""
    
    # Tables in order for safe truncation (respects foreign keys)
    TABLES_ORDER = [
        "alembic_version",
        "credential_shares",
        "workflow_credential_links",
        "workflow_users",
        "workflow_credentials",
        "workflow_templates",
        "workflows",
        "users",
    ]
    
    # Tables to preserve (don't truncate)
    PRESERVED_TABLES = ["alembic_version"]
    
    def __init__(self, docker_client: Optional[DockerClient] = None):
        """Initialize database manager."""
        self.docker = docker_client or get_docker_client()
        config = get_config()
        self.db_name = config.db_name
        self.db_user = config.db_user
    
    def check_connection(self) -> Tuple[bool, str]:
        """Check database connection."""
        if not self.docker.is_docker_available():
            return False, "Docker is not available"
        
        if not self.docker.is_container_running():
            return False, f"Container '{self.docker.container_name}' is not running"
        
        try:
            code, stdout, stderr = self.docker.exec_sql(
                "SELECT 1;",
                db_name=self.db_name,
                db_user=self.db_user,
            )
            if code == 0:
                return True, "Connected successfully"
            return False, stderr or "Connection failed"
        except DockerError as e:
            return False, str(e)
    
    def get_database_info(self) -> Dict[str, Any]:
        """Get database information."""
        info = {
            "database": self.db_name,
            "container": self.docker.container_name,
            "connected": False,
            "version": None,
            "size": None,
            "tables": [],
        }
        
        connected, _ = self.check_connection()
        info["connected"] = connected
        
        if not connected:
            return info
        
        # Get PostgreSQL version
        code, stdout, _ = self.docker.exec_sql(
            "SELECT version();",
            db_name=self.db_name,
            db_user=self.db_user,
        )
        if code == 0 and stdout:
            lines = stdout.strip().split('\n')
            if len(lines) >= 3:
                info["version"] = lines[2].strip()
        
        # Get database size
        code, stdout, _ = self.docker.exec_sql(
            f"SELECT pg_size_pretty(pg_database_size('{self.db_name}'));",
            db_name=self.db_name,
            db_user=self.db_user,
        )
        if code == 0 and stdout:
            lines = stdout.strip().split('\n')
            if len(lines) >= 3:
                info["size"] = lines[2].strip()
        
        # Get table list
        code, stdout, _ = self.docker.exec_sql(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
            db_name=self.db_name,
            db_user=self.db_user,
        )
        if code == 0 and stdout:
            lines = stdout.strip().split('\n')
            info["tables"] = [line.strip() for line in lines[2:-1] if line.strip()]
        
        return info
    
    def get_table_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for all tables."""
        stats = []
        
        sql = """
        SELECT 
            relname as table_name,
            n_live_tup as row_count,
            pg_size_pretty(pg_total_relation_size(relid)) as size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
        """
        
        code, stdout, _ = self.docker.exec_sql(sql, db_name=self.db_name, db_user=self.db_user)
        
        if code == 0 and stdout:
            lines = stdout.strip().split('\n')
            # Skip header lines
            for line in lines[2:-1]:
                if '|' in line:
                    parts = [p.strip() for p in line.split('|')]
                    if len(parts) >= 3:
                        stats.append({
                            "table": parts[0],
                            "rows": parts[1],
                            "size": parts[2],
                        })
        
        return stats
    
    def truncate_tables(self, tables: Optional[List[str]] = None) -> Tuple[bool, List[str], str]:
        """
        Truncate specified tables or all tables.
        
        Returns:
            Tuple of (success, tables_truncated, error_message)
        """
        if tables is None:
            # Get all tables except preserved ones
            info = self.get_database_info()
            tables = [t for t in info.get("tables", []) if t not in self.PRESERVED_TABLES]
        
        if not tables:
            return True, [], "No tables to truncate"
        
        # Build TRUNCATE statement with CASCADE
        tables_str = ", ".join(tables)
        sql = f"TRUNCATE TABLE {tables_str} RESTART IDENTITY CASCADE;"
        
        try:
            code, stdout, stderr = self.docker.exec_sql(sql, db_name=self.db_name, db_user=self.db_user)
            
            if code == 0:
                return True, tables, ""
            return False, [], stderr or "Truncate failed"
        except DockerError as e:
            return False, [], str(e)
    
    def reset_database(self) -> Tuple[bool, Dict[str, Any]]:
        """
        Reset database to clean state.
        
        Returns:
            Tuple of (success, result_info)
        """
        result = {
            "tables_cleared": [],
            "errors": [],
            "status": "failed",
        }
        
        # Check connection
        connected, msg = self.check_connection()
        if not connected:
            result["errors"].append(msg)
            return False, result
        
        # Truncate all tables
        success, tables, error = self.truncate_tables()
        
        if success:
            result["tables_cleared"] = tables
            result["status"] = "success"
            return True, result
        
        result["errors"].append(error)
        return False, result
    
    def seed_admin_user(
        self,
        name: str = "Admin",
        email: str = "admin@rune.io",
        password_hash: str = "",
    ) -> Tuple[bool, str]:
        """Create initial admin user."""
        # TODO(api): password hashing should be delegated to the API rather than
        # being performed here. Ideally this command should call the API's user
        # creation endpoint instead of writing to the DB directly.
        # Note: In production, password should be properly hashed
        # This is a placeholder - actual hashing should be done by the API
        
        if not password_hash:
            # For development only: bcrypt hash of 'admin123'.
            # Consider removing this fallback once the API handles seeding.
            password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYb.rIGOuKK2"
        
        sql = f"""
        INSERT INTO users (name, email, hashed_password, role, is_active, must_change_password, created_at, updated_at)
        VALUES ('{name}', '{email}', '{password_hash}', 'admin', true, true, NOW(), NOW())
        ON CONFLICT (email) DO NOTHING
        RETURNING id;
        """
        
        try:
            code, stdout, stderr = self.docker.exec_sql(sql, db_name=self.db_name, db_user=self.db_user)
            
            if code == 0:
                return True, "Admin user created successfully"
            return False, stderr or "Failed to create admin user"
        except DockerError as e:
            return False, str(e)
    
    def run_migrations(self) -> Tuple[bool, str]:
        """Run Alembic migrations."""
        try:
            # This would typically run alembic in the API container
            code, stdout, stderr = self.docker.exec_command(
                "alembic upgrade head",
                workdir="/app",
            )
            
            if code == 0:
                return True, stdout
            return False, stderr or "Migration failed"
        except DockerError as e:
            return False, str(e)
    
    def execute_sql(self, sql: str) -> Tuple[bool, str, str]:
        """Execute arbitrary SQL."""
        try:
            code, stdout, stderr = self.docker.exec_sql(sql, db_name=self.db_name, db_user=self.db_user)
            return code == 0, stdout, stderr
        except DockerError as e:
            return False, "", str(e)


def get_database_manager(docker_client: Optional[DockerClient] = None) -> DatabaseManager:
    """Get a database manager instance."""
    return DatabaseManager(docker_client)


# Export all public functions and classes
__all__ = [
    "DatabaseError",
    "DatabaseManager",
    "get_database_manager",
]

