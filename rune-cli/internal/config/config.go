/*
Package config manages CLI configuration and credentials.

Configuration is stored in a YAML file at ~/.config/rune/config.yaml
and can be overridden using environment variables with the RUNE_ prefix.

Configuration hierarchy (highest to lowest priority):
 1. Command-line flags
 2. Environment variables (RUNE_*)
 3. Configuration file
 4. Default values

File locations:
  - Config: ~/.config/rune/config.yaml
  - Credentials: Stored in OS keyring or ~/.config/rune/credentials.json
*/
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/spf13/viper"
)

// Config holds all CLI configuration values
type Config struct {
	// API configuration
	APIURL  string `mapstructure:"api_url" json:"api_url"`
	Timeout int    `mapstructure:"timeout" json:"timeout"`

	// Database configuration (for direct access mode)
	DatabaseURL string `mapstructure:"database_url" json:"database_url"`

	// UI preferences
	ColorEnabled bool   `mapstructure:"color_enabled" json:"color_enabled"`
	OutputFormat string `mapstructure:"output_format" json:"output_format"`

	// Docker configuration (for db commands)
	DockerContainer string `mapstructure:"docker_container" json:"docker_container"`
	DockerNetwork   string `mapstructure:"docker_network" json:"docker_network"`
}

// Credentials holds authentication tokens
type Credentials struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	Email        string    `json:"email"`
	UserID       int       `json:"user_id"`
	Role         string    `json:"role"`
}

// Default configuration values
var defaultConfig = Config{
	APIURL:          "http://localhost:8000",
	Timeout:         30,
	DatabaseURL:     "",
	ColorEnabled:    true,
	OutputFormat:    "text",
	DockerContainer: "rune-db-1",
	DockerNetwork:   "rune_default",
}

var (
	cfg      *Config
	cfgOnce  sync.Once
	cfgMutex sync.RWMutex
)

// GetConfigDir returns the configuration directory path
func GetConfigDir() string {
	var configDir string

	switch runtime.GOOS {
	case "windows":
		configDir = os.Getenv("APPDATA")
		if configDir == "" {
			configDir = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
	case "darwin":
		configDir = filepath.Join(os.Getenv("HOME"), "Library", "Application Support")
	default:
		configDir = os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			configDir = filepath.Join(os.Getenv("HOME"), ".config")
		}
	}

	return filepath.Join(configDir, "rune")
}

// GetConfigPath returns the full path to the config file
func GetConfigPath() string {
	return filepath.Join(GetConfigDir(), "config.yaml")
}

// GetCredentialsPath returns the full path to the credentials file
func GetCredentialsPath() string {
	return filepath.Join(GetConfigDir(), "credentials.json")
}

// ensureConfigDir creates the config directory if it doesn't exist
func ensureConfigDir() error {
	dir := GetConfigDir()
	return os.MkdirAll(dir, 0700)
}

// Load reads configuration from file and environment
func Load() (*Config, error) {
	var loadErr error

	cfgOnce.Do(func() {
		cfg = &Config{}

		// Ensure config directory exists
		if err := ensureConfigDir(); err != nil {
			loadErr = fmt.Errorf("failed to create config directory: %w", err)
			return
		}

		// Set up Viper
		v := viper.New()
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(GetConfigDir())

		// Set defaults
		v.SetDefault("api_url", defaultConfig.APIURL)
		v.SetDefault("timeout", defaultConfig.Timeout)
		v.SetDefault("database_url", defaultConfig.DatabaseURL)
		v.SetDefault("color_enabled", defaultConfig.ColorEnabled)
		v.SetDefault("output_format", defaultConfig.OutputFormat)
		v.SetDefault("docker_container", defaultConfig.DockerContainer)
		v.SetDefault("docker_network", defaultConfig.DockerNetwork)

		// Enable environment variable overrides
		v.SetEnvPrefix("RUNE")
		v.AutomaticEnv()

		// Try to read config file (create if doesn't exist)
		if err := v.ReadInConfig(); err != nil {
			if _, ok := err.(viper.ConfigFileNotFoundError); ok {
				// Config file doesn't exist, create with defaults
				if err := SaveDefault(); err != nil {
					loadErr = fmt.Errorf("failed to create default config: %w", err)
					return
				}
				// Re-read after creation
				_ = v.ReadInConfig()
			}
		}

		// Unmarshal to struct
		if err := v.Unmarshal(cfg); err != nil {
			loadErr = fmt.Errorf("failed to parse config: %w", err)
			return
		}
	})

	return cfg, loadErr
}

// Get returns the current configuration (loads if needed)
func Get() *Config {
	cfgMutex.RLock()
	if cfg != nil {
		cfgMutex.RUnlock()
		return cfg
	}
	cfgMutex.RUnlock()

	loadedCfg, err := Load()
	if err != nil {
		return &defaultConfig
	}
	return loadedCfg
}

// Save writes the current configuration to file
func Save(c *Config) error {
	if err := ensureConfigDir(); err != nil {
		return err
	}

	v := viper.New()
	v.Set("api_url", c.APIURL)
	v.Set("timeout", c.Timeout)
	v.Set("database_url", c.DatabaseURL)
	v.Set("color_enabled", c.ColorEnabled)
	v.Set("output_format", c.OutputFormat)
	v.Set("docker_container", c.DockerContainer)
	v.Set("docker_network", c.DockerNetwork)

	cfgMutex.Lock()
	cfg = c
	cfgMutex.Unlock()

	return v.WriteConfigAs(GetConfigPath())
}

// SaveDefault creates a config file with default values
func SaveDefault() error {
	return Save(&defaultConfig)
}

// SetAPIURL updates the API URL in the configuration
func SetAPIURL(url string) error {
	c := Get()
	c.APIURL = url
	return Save(c)
}

// SetDatabaseURL updates the database URL in the configuration
func SetDatabaseURL(url string) error {
	c := Get()
	c.DatabaseURL = url
	return Save(c)
}

// LoadCredentials reads stored authentication credentials
func LoadCredentials() (*Credentials, error) {
	path := GetCredentialsPath()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read credentials: %w", err)
	}

	var creds Credentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, fmt.Errorf("failed to parse credentials: %w", err)
	}

	return &creds, nil
}

// SaveCredentials stores authentication credentials
func SaveCredentials(creds *Credentials) error {
	if err := ensureConfigDir(); err != nil {
		return err
	}

	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode credentials: %w", err)
	}

	path := GetCredentialsPath()
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write credentials: %w", err)
	}

	return nil
}

// ClearCredentials removes stored credentials
func ClearCredentials() error {
	path := GetCredentialsPath()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove credentials: %w", err)
	}
	return nil
}

// IsAuthenticated checks if valid credentials exist
func IsAuthenticated() bool {
	creds, err := LoadCredentials()
	if err != nil || creds == nil {
		return false
	}

	// Check if token is expired (with 1 minute buffer)
	if time.Now().Add(time.Minute).After(creds.ExpiresAt) {
		return false
	}

	return creds.AccessToken != ""
}

// GetAccessToken returns the current access token if valid
func GetAccessToken() string {
	creds, err := LoadCredentials()
	if err != nil || creds == nil {
		return ""
	}

	if time.Now().After(creds.ExpiresAt) {
		return ""
	}

	return creds.AccessToken
}

// Reset removes the config file and resets to defaults
func Reset() error {
	cfgMutex.Lock()
	cfg = nil
	cfgOnce = sync.Once{}
	cfgMutex.Unlock()

	configPath := GetConfigPath()
	if err := os.Remove(configPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return SaveDefault()
}
