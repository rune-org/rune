package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/registry"
)

func main() {
	// Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("starting rune workflow worker",
		"version", "1.0.0",
		"go_version", "1.25")

	// Load configuration
	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	slog.Info("configuration loaded",
		"rabbitmq_url", cfg.RabbitURL,
		"queue_name", cfg.QueueName,
		"prefetch", cfg.Prefetch,
		"concurrency", cfg.Concurrency)

	// Initialize node registry with built-in nodes
	// All nodes that have init() functions will be auto-registered
	nodeRegistry := registry.InitializeRegistry()
	slog.Info("node registry initialized",
		"registered_nodes", len(nodeRegistry.GetAllTypes()))

	// Create workflow consumer
	consumer, err := messaging.NewWorkflowConsumer(cfg)
	if err != nil {
		slog.Error("unable to create workflow consumer", "error", err)
		os.Exit(1)
	}
	defer func() {
		slog.Info("shutting down workflow consumer")
		if err := consumer.Close(); err != nil {
			slog.Error("error closing consumer", "error", err)
		}
	}()

	slog.Info("workflow consumer created successfully")

	// Setup graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Start consuming messages
	slog.Info("workflow worker ready to process messages")
	if err := consumer.Run(ctx); err != nil {
		slog.Error("workflow consumer stopped with error", "error", err)
		os.Exit(1)
	}

	slog.Info("workflow worker shutdown complete")
}
