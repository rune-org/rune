import base64
import pytest
from cryptography.fernet import Fernet, InvalidToken

from src.credentials.encryption import CredentialEncryption, get_encryptor
from src.core.config import get_settings


class TestCredentialEncryption:
    """Test cases for CredentialEncryption class."""

    def test_encrypt_simple_dict(self):
        """Test encrypting a simple dictionary."""
        encryptor = CredentialEncryption()
        data = {"api_key": "test-key-123", "endpoint": "https://api.example.com"}

        encrypted = encryptor.encrypt_credential_data(data)

        # Verify it's a valid base64 string
        assert isinstance(encrypted, str)
        decoded = base64.b64decode(encrypted)
        assert decoded is not None

        # Verify original data is not visible in encrypted form
        assert "test-key-123" not in encrypted
        assert "api_key" not in encrypted

    def test_decrypt_simple_dict(self):
        """Test decrypting data back to original dictionary."""
        encryptor = CredentialEncryption()
        original_data = {
            "api_key": "test-key-123",
            "endpoint": "https://api.example.com",
        }

        encrypted = encryptor.encrypt_credential_data(original_data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        # Verify decrypted data matches original
        assert decrypted == original_data
        assert decrypted["api_key"] == "test-key-123"
        assert decrypted["endpoint"] == "https://api.example.com"

    def test_encrypt_decrypt_roundtrip(self):
        """Test that encrypt -> decrypt returns original data."""
        encryptor = CredentialEncryption()
        data = {
            "username": "admin",
            "password": "super-secret-password",
            "host": "db.example.com",
            "port": 5432,
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data

    def test_encrypt_empty_dict(self):
        """Test encrypting an empty dictionary."""
        encryptor = CredentialEncryption()
        data = {}

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == {}

    def test_encrypt_nested_dict(self):
        """Test encrypting a dictionary with nested structures."""
        encryptor = CredentialEncryption()
        data = {
            "service": "aws",
            "config": {
                "region": "us-east-1",
                "credentials": {
                    "access_key": "AKIAIOSFODNN7EXAMPLE",
                    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                },
                "options": {
                    "timeout": 30,
                    "retry": True,
                    "max_attempts": 3,
                },
            },
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert (
            decrypted["config"]["credentials"]["access_key"] == "AKIAIOSFODNN7EXAMPLE"
        )
        assert decrypted["config"]["options"]["timeout"] == 30

    def test_encrypt_dict_with_various_types(self):
        """Test encrypting dictionary with different value types."""
        encryptor = CredentialEncryption()
        data = {
            "string_value": "test",
            "int_value": 42,
            "float_value": 3.14,
            "bool_value": True,
            "null_value": None,
            "list_value": [1, 2, 3],
            "nested_dict": {"key": "value"},
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert decrypted["string_value"] == "test"
        assert decrypted["int_value"] == 42
        assert decrypted["float_value"] == 3.14
        assert decrypted["bool_value"] is True
        assert decrypted["null_value"] is None
        assert decrypted["list_value"] == [1, 2, 3]
        assert decrypted["nested_dict"] == {"key": "value"}

    def test_encrypt_dict_with_special_characters(self):
        """Test encrypting dictionary with special characters."""
        encryptor = CredentialEncryption()
        data = {
            "password": "p@$$w0rd!#%&*()[]{}|\\:;<>?,./",
            "unicode": "测试凭证-テスト-🔐",
            "newlines": "line1\nline2\nline3",
            "tabs": "col1\tcol2\tcol3",
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert decrypted["password"] == "p@$$w0rd!#%&*()[]{}|\\:;<>?,./"
        assert decrypted["unicode"] == "测试凭证-テスト-🔐"

    def test_encrypt_large_data(self):
        """Test encrypting a large dictionary."""
        encryptor = CredentialEncryption()
        data = {f"key_{i}": f"value_{i}" * 100 for i in range(100)}

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert len(decrypted) == 100

    def test_encrypted_output_is_different_each_time(self):
        """Test that encrypting the same data produces different ciphertext."""
        encryptor = CredentialEncryption()
        data = {"api_key": "test-key-123"}

        encrypted1 = encryptor.encrypt_credential_data(data)
        encrypted2 = encryptor.encrypt_credential_data(data)

        assert encrypted1 != encrypted2

        # But both decrypt to the same data
        assert encryptor.decrypt_credential_data(encrypted1) == data
        assert encryptor.decrypt_credential_data(encrypted2) == data

    def test_decrypt_with_invalid_base64(self):
        """Test that decrypting invalid base64 raises an error."""
        encryptor = CredentialEncryption()
        invalid_data = "not-valid-base64!@#$"

        with pytest.raises(Exception):
            encryptor.decrypt_credential_data(invalid_data)

    def test_decrypt_with_invalid_ciphertext(self):
        """Test that decrypting invalid ciphertext raises InvalidToken."""
        encryptor = CredentialEncryption()
        # Valid base64 but not valid Fernet ciphertext
        invalid_ciphertext = base64.b64encode(b"invalid encrypted data").decode()

        with pytest.raises(InvalidToken):
            encryptor.decrypt_credential_data(invalid_ciphertext)

    def test_decrypt_with_wrong_key(self):
        """Test that decrypting with a different key fails."""
        encryptor1 = CredentialEncryption()
        data = {"api_key": "test-key-123"}

        encrypted = encryptor1.encrypt_credential_data(data)

        # Create a new encryptor with a different key
        new_key = Fernet.generate_key()
        encryptor2 = CredentialEncryption()
        encryptor2._fernet = Fernet(new_key)

        with pytest.raises(InvalidToken):
            encryptor2.decrypt_credential_data(encrypted)

    def test_decrypt_tampered_data(self):
        """Test that tampering with encrypted data causes decryption to fail."""
        encryptor = CredentialEncryption()
        data = {"api_key": "test-key-123"}

        encrypted = encryptor.encrypt_credential_data(data)

        # Tamper with the encrypted data
        decoded = base64.b64decode(encrypted)
        # Flip a bit in the middle
        tampered = decoded[:10] + bytes([decoded[10] ^ 1]) + decoded[11:]
        tampered_encrypted = base64.b64encode(tampered).decode()

        with pytest.raises(InvalidToken):
            encryptor.decrypt_credential_data(tampered_encrypted)

    def test_get_encryptor_returns_instance(self):
        """Test that get_encryptor returns a CredentialEncryption instance."""
        encryptor = get_encryptor()

        assert isinstance(encryptor, CredentialEncryption)
        assert hasattr(encryptor, "encrypt_credential_data")
        assert hasattr(encryptor, "decrypt_credential_data")

    def test_get_encryptor_works_correctly(self):
        """Test that get_encryptor returns a working encryptor."""
        encryptor = get_encryptor()
        data = {"test": "data"}

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data

    def test_encryption_preserves_data_types(self):
        """Test that encryption/decryption preserves all JSON-compatible types."""
        encryptor = CredentialEncryption()
        data = {
            "string": "text",
            "integer": 42,
            "float": 3.14159,
            "boolean_true": True,
            "boolean_false": False,
            "null": None,
            "array": [1, "two", 3.0, None, True],
            "object": {"nested": "value"},
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        # Verify types are preserved
        assert isinstance(decrypted["string"], str)
        assert isinstance(decrypted["integer"], int)
        assert isinstance(decrypted["float"], float)
        assert isinstance(decrypted["boolean_true"], bool)
        assert isinstance(decrypted["boolean_false"], bool)
        assert decrypted["null"] is None
        assert isinstance(decrypted["array"], list)
        assert isinstance(decrypted["object"], dict)

    def test_encrypt_dict_with_empty_strings(self):
        """Test encrypting dictionary with empty string values."""
        encryptor = CredentialEncryption()
        data = {
            "empty_string": "",
            "normal_string": "value",
            "another_empty": "",
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert decrypted["empty_string"] == ""
        assert decrypted["another_empty"] == ""

    def test_encrypt_dict_with_arrays(self):
        """Test encrypting dictionary with array values."""
        encryptor = CredentialEncryption()
        data = {
            "endpoints": ["https://api1.example.com", "https://api2.example.com"],
            "ports": [8080, 8081, 8082],
            "features": ["feature1", "feature2"],
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert decrypted["endpoints"] == [
            "https://api1.example.com",
            "https://api2.example.com",
        ]
        assert decrypted["ports"] == [8080, 8081, 8082]

    def test_encrypted_data_is_base64_encoded(self):
        """Test that encrypted data is valid base64."""
        encryptor = CredentialEncryption()
        data = {"key": "value"}

        encrypted = encryptor.encrypt_credential_data(data)

        # Should be able to decode as base64
        try:
            decoded = base64.b64decode(encrypted)
            assert isinstance(decoded, bytes)
        except Exception as e:
            pytest.fail(f"Encrypted data is not valid base64: {e}")

    def test_encryption_uses_settings_key(self):
        """Test that encryption uses the key from settings."""
        settings = get_settings()

        # Verify settings has encryption key
        assert settings.encryption_key is not None
        assert len(settings.encryption_key) > 0

        # Create encryptor and verify it works
        encryptor = CredentialEncryption()
        data = {"test": "value"}

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data

    def test_multiple_encryptors_use_same_key(self):
        """Test that multiple encryptor instances use the same key from settings."""
        encryptor1 = CredentialEncryption()
        encryptor2 = CredentialEncryption()

        data = {"api_key": "test-123"}

        # Encrypt with first encryptor
        encrypted = encryptor1.encrypt_credential_data(data)

        # Decrypt with second encryptor (should work with same key)
        decrypted = encryptor2.decrypt_credential_data(encrypted)

        assert decrypted == data

    def test_encrypt_oauth2_credentials(self):
        """Test encrypting OAuth2-style credentials."""
        encryptor = CredentialEncryption()
        data = {
            "client_id": "abc123",
            "client_secret": "secret456",
            "redirect_uri": "https://example.com/callback",
            "scope": ["read", "write"],
            "token_url": "https://oauth.example.com/token",
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data

    def test_encrypt_api_key_credentials(self):
        """Test encrypting API key credentials."""
        encryptor = CredentialEncryption()
        data = {
            "api_key": "sk-1234567890abcdef",
            "api_secret": "secret-key-xyz",
            "endpoint": "https://api.example.com/v1",
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert "sk-1234567890abcdef" not in encrypted

    def test_encrypt_basic_auth_credentials(self):
        """Test encrypting basic auth credentials."""
        encryptor = CredentialEncryption()
        data = {
            "username": "admin",
            "password": "P@ssw0rd!123",
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert "admin" not in encrypted
        assert "P@ssw0rd!123" not in encrypted

    def test_encrypt_database_credentials(self):
        """Test encrypting database connection credentials."""
        encryptor = CredentialEncryption()
        data = {
            "host": "db.example.com",
            "port": 5432,
            "database": "production",
            "username": "dbuser",
            "password": "dbpass123",
            "ssl": True,
            "connection_timeout": 30,
        }

        encrypted = encryptor.encrypt_credential_data(data)
        decrypted = encryptor.decrypt_credential_data(encrypted)

        assert decrypted == data
        assert decrypted["port"] == 5432
        assert decrypted["ssl"] is True
