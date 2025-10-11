package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		setup   func() (string, func())
		wantErr bool
		errMsg  string
		check   func(*testing.T, *WorkerConfig)
	}{
		{
			name: "valid config file",
			setup: func() (string, func()) {
				tmpDir := t.TempDir()
				envFile := filepath.Join(tmpDir, ".env")
				content := `RABBITMQ_URL=amqp://test:test@localhost:5672/
WORKFLOW_QUEUE_NAME=test.queue
WORKFLOW_PREFETCH=20
WORKFLOW_CONCURRENCY=5`
				_ = os.WriteFile(envFile, []byte(content), 0644)
				return envFile, func() {}
			},
			wantErr: false,
			check: func(t *testing.T, cfg *WorkerConfig) {
				if cfg.RabbitURL != "amqp://test:test@localhost:5672/" {
					t.Errorf("RabbitURL = %v, want amqp://test:test@localhost:5672/", cfg.RabbitURL)
				}
				if cfg.QueueName != "test.queue" {
					t.Errorf("QueueName = %v, want test.queue", cfg.QueueName)
				}
				if cfg.Prefetch != 20 {
					t.Errorf("Prefetch = %v, want 20", cfg.Prefetch)
				}
				if cfg.Concurrency != 5 {
					t.Errorf("Concurrency = %v, want 5", cfg.Concurrency)
				}
			},
		},
		{
			name: "non-existent file uses defaults",
			setup: func() (string, func()) {
				return "/nonexistent/.env", func() {}
			},
			wantErr: false,
			check: func(t *testing.T, cfg *WorkerConfig) {
				if cfg.RabbitURL != defaultRabbitURL {
					t.Errorf("RabbitURL = %v, want %v", cfg.RabbitURL, defaultRabbitURL)
				}
				if cfg.QueueName != defaultQueueName {
					t.Errorf("QueueName = %v, want %v", cfg.QueueName, defaultQueueName)
				}
				if cfg.Prefetch != defaultPrefetch {
					t.Errorf("Prefetch = %v, want %v", cfg.Prefetch, defaultPrefetch)
				}
				if cfg.Concurrency != defaultConcurrency {
					t.Errorf("Concurrency = %v, want %v", cfg.Concurrency, defaultConcurrency)
				}
			},
		},
		{
			name: "empty string path uses defaults",
			setup: func() (string, func()) {
				return "", func() {}
			},
			wantErr: false,
			check: func(t *testing.T, cfg *WorkerConfig) {
				if cfg == nil {
					t.Fatal("config is nil")
				}
			},
		},
	}

	// Save and restore environment
	originalEnv := make(map[string]string)
	envKeys := []string{envRabbitURL, envWorkflowQueue, envPrefetch, envConcurrency}
	for _, key := range envKeys {
		if val, ok := os.LookupEnv(key); ok {
			originalEnv[key] = val
		}
	}
	defer func() {
		for _, key := range envKeys {
			_ = os.Unsetenv(key)
		}
		for key, val := range originalEnv {
			_ = os.Setenv(key, val)
		}
	}()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear environment before each test
			for _, key := range envKeys {
				_ = os.Unsetenv(key)
			}

			path, cleanup := tt.setup()
			defer cleanup()

			cfg, err := Load(path)
			if tt.wantErr {
				if err == nil {
					t.Errorf("Load() expected error containing %q, got nil", tt.errMsg)
				} else if tt.errMsg != "" && !contains(err.Error(), tt.errMsg) {
					t.Errorf("Load() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			if err != nil {
				t.Errorf("Load() unexpected error = %v", err)
				return
			}
			if cfg == nil {
				t.Fatal("Load() returned nil config")
			}
			if tt.check != nil {
				tt.check(t, cfg)
			}
		})
	}
}

func TestLoadWithEnvVariables(t *testing.T) {
	// Save and restore original environment
	originalEnv := make(map[string]string)
	envKeys := []string{envRabbitURL, envWorkflowQueue, envPrefetch, envConcurrency}
	for _, key := range envKeys {
		if val, ok := os.LookupEnv(key); ok {
			originalEnv[key] = val
		}
	}
	defer func() {
		for _, key := range envKeys {
			_ = os.Unsetenv(key)
		}
		for key, val := range originalEnv {
			_ = os.Setenv(key, val)
		}
	}()

	// Set environment variables
	_ = os.Setenv(envRabbitURL, "amqp://env:env@localhost:5672/")
	_ = os.Setenv(envWorkflowQueue, "env.queue")
	_ = os.Setenv(envPrefetch, "15")
	_ = os.Setenv(envConcurrency, "3")

	cfg, err := Load("")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.RabbitURL != "amqp://env:env@localhost:5672/" {
		t.Errorf("RabbitURL = %v, want amqp://env:env@localhost:5672/", cfg.RabbitURL)
	}
	if cfg.QueueName != "env.queue" {
		t.Errorf("QueueName = %v, want env.queue", cfg.QueueName)
	}
	if cfg.Prefetch != 15 {
		t.Errorf("Prefetch = %v, want 15", cfg.Prefetch)
	}
	if cfg.Concurrency != 3 {
		t.Errorf("Concurrency = %v, want 3", cfg.Concurrency)
	}
}

func TestLoadEnvFile(t *testing.T) {
	tests := []struct {
		name    string
		content string
		wantErr bool
	}{
		{
			name: "valid env file",
			content: `RABBITMQ_URL=amqp://localhost:5672/
WORKFLOW_QUEUE_NAME=test.queue`,
			wantErr: false,
		},
		{
			name: "env file with comments",
			content: `# This is a comment
RABBITMQ_URL=amqp://localhost:5672/
# Another comment
WORKFLOW_QUEUE_NAME=test.queue`,
			wantErr: false,
		},
		{
			name: "env file with quoted values",
			content: `RABBITMQ_URL="amqp://localhost:5672/"
WORKFLOW_QUEUE_NAME='test.queue'`,
			wantErr: false,
		},
		{
			name:    "empty file",
			content: "",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			envFile := filepath.Join(tmpDir, ".env")
			if err := os.WriteFile(envFile, []byte(tt.content), 0644); err != nil {
				t.Fatalf("Failed to create test file: %v", err)
			}

			err := loadEnvFile(envFile)
			if tt.wantErr {
				if err == nil {
					t.Error("loadEnvFile() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("loadEnvFile() unexpected error = %v", err)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		fallback string
		setValue string
		want     string
	}{
		{
			name:     "env variable exists",
			key:      "TEST_VAR",
			fallback: "default",
			setValue: "actual",
			want:     "actual",
		},
		{
			name:     "env variable not exists",
			key:      "NONEXISTENT_VAR",
			fallback: "default",
			setValue: "",
			want:     "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setValue != "" {
				_ = os.Setenv(tt.key, tt.setValue)
				defer func() {
					_ = os.Unsetenv(tt.key)
				}()
			} else {
				_ = os.Unsetenv(tt.key)
			}

			got := getEnv(tt.key, tt.fallback)
			if got != tt.want {
				t.Errorf("getEnv(%v, %v) = %v, want %v", tt.key, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestGetEnvAsInt(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		fallback int
		setValue string
		want     int
	}{
		{
			name:     "valid integer",
			key:      "TEST_INT",
			fallback: 10,
			setValue: "25",
			want:     25,
		},
		{
			name:     "invalid integer uses fallback",
			key:      "TEST_INT",
			fallback: 10,
			setValue: "invalid",
			want:     10,
		},
		{
			name:     "empty value uses fallback",
			key:      "TEST_INT",
			fallback: 10,
			setValue: "",
			want:     10,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setValue != "" {
				_ = os.Setenv(tt.key, tt.setValue)
				defer func() {
					_ = os.Unsetenv(tt.key)
				}()
			} else {
				_ = os.Unsetenv(tt.key)
			}

			got := getEnvAsInt(tt.key, tt.fallback)
			if got != tt.want {
				t.Errorf("getEnvAsInt(%v, %v) = %v, want %v", tt.key, tt.fallback, got, tt.want)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && indexOf(s, substr) >= 0))
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
