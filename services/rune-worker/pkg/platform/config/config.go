package config

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strconv"
	"strings"
)

const (
	envRabbitURL       = "RABBITMQ_URL"
	envRedisURL        = "REDIS_URL"
	envWorkflowQueue   = "WORKFLOW_QUEUE_NAME"
	envPrefetch        = "WORKFLOW_PREFETCH"
	envConcurrency     = "WORKFLOW_CONCURRENCY"
	defaultRabbitURL   = "amqp://guest:guest@localhost:5672/"
	defaultRedisURL    = "redis://localhost:6379/0"
	defaultQueueName   = "workflow.execute"
	defaultPrefetch    = 10
	defaultConcurrency = 1
)

// WorkerConfig captures runtime configuration for the worker process.
type WorkerConfig struct {
	RabbitURL   string
	RedisURL    string
	QueueName   string
	Prefetch    int
	Concurrency int
}

// Load reads configuration from the provided dotenv file and environment variables.
func Load(path string) (*WorkerConfig, error) {
	if err := loadEnvFile(path); err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
	}

	cfg := &WorkerConfig{
		RabbitURL:   getEnv(envRabbitURL, defaultRabbitURL),
		RedisURL:    getEnv(envRedisURL, defaultRedisURL),
		QueueName:   getEnv(envWorkflowQueue, defaultQueueName),
		Prefetch:    getEnvAsInt(envPrefetch, defaultPrefetch),
		Concurrency: getEnvAsInt(envConcurrency, defaultConcurrency),
	}

	if cfg.RabbitURL == "" {
		return nil, fmt.Errorf("%s is required", envRabbitURL)
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("%s is required", envRedisURL)
	}
	if cfg.QueueName == "" {
		return nil, fmt.Errorf("%s is required", envWorkflowQueue)
	}
	if cfg.Prefetch <= 0 {
		return nil, fmt.Errorf("%s must be greater than zero", envPrefetch)
	}
	if cfg.Concurrency <= 0 {
		return nil, fmt.Errorf("%s must be greater than zero", envConcurrency)
	}

	return cfg, nil
}

func loadEnvFile(path string) error {
	if path == "" {
		return nil
	}

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() {
		_ = file.Close()
	}()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, "\"'")

		_ = os.Setenv(key, value)
	}

	return scanner.Err()
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	i, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return i
}
