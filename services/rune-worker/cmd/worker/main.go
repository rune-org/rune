package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"rune-worker/pkg/config"
	"rune-worker/pkg/consumers"
)

func main() {
	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	consumer, err := consumers.NewWorkflowConsumer(cfg)
	if err != nil {
		slog.Error("unable to create workflow consumer", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := consumer.Close(); err != nil {
			slog.Error("error closing consumer", "error", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := consumer.Run(ctx); err != nil {
		slog.Error("workflow consumer stopped", "error", err)
		os.Exit(1)
	}
}
