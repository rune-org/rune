"""
Docker Integration

Execute commands in Docker containers for database operations.
"""

import subprocess
import shlex
from typing import Optional, Tuple, List
from cli.core.config import get_config


class DockerError(Exception):
    """Docker operation error."""
    pass


class DockerClient:
    """Client for Docker container operations."""
    
    def __init__(self, container_name: Optional[str] = None):
        """Initialize Docker client."""
        config = get_config()
        self.container_name = container_name or config.docker_container
    
    def is_docker_available(self) -> bool:
        """Check if Docker is available."""
        try:
            result = subprocess.run(
                ["docker", "version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    
    def is_container_running(self) -> bool:
        """Check if the target container is running."""
        try:
            result = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", self.container_name],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0 and result.stdout.strip() == "true"
        except subprocess.SubprocessError:
            return False
    
    def get_container_info(self) -> dict:
        """Get container information."""
        try:
            result = subprocess.run(
                ["docker", "inspect", "--format", 
                 '{"id":"{{.Id}}","name":"{{.Name}}","status":"{{.State.Status}}","image":"{{.Config.Image}}"}',
                 self.container_name],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0:
                import json
                return json.loads(result.stdout.strip())
            return {}
        except (subprocess.SubprocessError, ValueError):
            return {}
    
    def exec_command(
        self,
        command: str,
        user: Optional[str] = None,
        workdir: Optional[str] = None,
        env: Optional[dict] = None,
        timeout: int = 60,
    ) -> Tuple[int, str, str]:
        """
        Execute a command in the container.
        
        Returns:
            Tuple of (return_code, stdout, stderr)
        """
        docker_cmd = ["docker", "exec"]
        
        if user:
            docker_cmd.extend(["-u", user])
        if workdir:
            docker_cmd.extend(["-w", workdir])
        if env:
            for key, value in env.items():
                docker_cmd.extend(["-e", f"{key}={value}"])
        
        docker_cmd.append(self.container_name)
        
        # Handle command as string or list
        if isinstance(command, str):
            docker_cmd.extend(["sh", "-c", command])
        else:
            docker_cmd.extend(command)
        
        try:
            result = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            raise DockerError(f"Command timed out after {timeout} seconds")
        except subprocess.SubprocessError as e:
            raise DockerError(f"Docker command failed: {e}")
    
    def exec_sql(
        self,
        sql: str,
        db_name: str = "rune",
        db_user: str = "postgres",
        timeout: int = 60,
    ) -> Tuple[int, str, str]:
        """Execute SQL command in PostgreSQL container."""
        command = f'psql -U {db_user} -d {db_name} -c "{sql}"'
        return self.exec_command(command, timeout=timeout)
    
    def exec_sql_file(
        self,
        sql_content: str,
        db_name: str = "rune",
        db_user: str = "postgres",
        timeout: int = 120,
    ) -> Tuple[int, str, str]:
        """Execute SQL content (can be multiple statements)."""
        # Use heredoc style for multi-statement SQL
        command = f"psql -U {db_user} -d {db_name} <<'EOSQL'\n{sql_content}\nEOSQL"
        return self.exec_command(command, timeout=timeout)
    
    def list_containers(self, all_containers: bool = False) -> List[dict]:
        """List Docker containers."""
        cmd = ["docker", "ps", "--format", '{"id":"{{.ID}}","name":"{{.Names}}","status":"{{.Status}}","image":"{{.Image}}"}']
        if all_containers:
            cmd.insert(2, "-a")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                import json
                containers = []
                for line in result.stdout.strip().split('\n'):
                    if line:
                        containers.append(json.loads(line))
                return containers
            return []
        except (subprocess.SubprocessError, ValueError):
            return []
    
    def find_database_container(self) -> Optional[str]:
        """Find the PostgreSQL database container."""
        containers = self.list_containers()
        
        # Look for common database container names/images
        db_patterns = ["postgres", "postgresql", "db", "database", "rune-db"]
        
        for container in containers:
            name = container.get("name", "").lower()
            image = container.get("image", "").lower()
            
            for pattern in db_patterns:
                if pattern in name or pattern in image:
                    return container.get("name")
        
        return None


def get_docker_client(container_name: Optional[str] = None) -> DockerClient:
    """Get a Docker client instance."""
    return DockerClient(container_name)


# Export all public functions and classes
__all__ = [
    "DockerError",
    "DockerClient",
    "get_docker_client",
]
