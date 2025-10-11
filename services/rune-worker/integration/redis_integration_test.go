//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// TestRedisOperations tests basic Redis operations used by the worker
func TestRedisOperations(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx := context.Background()

	testCases := []struct {
		name      string
		operation func(t *testing.T)
	}{
		{
			name: "SET and GET",
			operation: func(t *testing.T) {
				key := "test:key:1"
				value := "test-value"

				err := env.RedisClient.Set(ctx, key, value, 5*time.Minute).Err()
				if err != nil {
					t.Fatalf("SET operation failed: %v", err)
				}

				result, err := env.RedisClient.Get(ctx, key).Result()
				if err != nil {
					t.Fatalf("GET operation failed: %v", err)
				}

				if result != value {
					t.Errorf("Expected %s, got %s", value, result)
				}
			},
		},
		{
			name: "INCR counter",
			operation: func(t *testing.T) {
				key := "test:counter:1"

				// Increment 5 times
				for i := 0; i < 5; i++ {
					err := env.RedisClient.Incr(ctx, key).Err()
					if err != nil {
						t.Fatalf("INCR operation failed: %v", err)
					}
				}

				count, err := env.RedisClient.Get(ctx, key).Int()
				if err != nil {
					t.Fatalf("GET counter failed: %v", err)
				}

				if count != 5 {
					t.Errorf("Expected counter to be 5, got %d", count)
				}
			},
		},
		{
			name: "JSON storage and retrieval",
			operation: func(t *testing.T) {
				key := "test:json:1"
				data := map[string]interface{}{
					"workflow_id": "wf-123",
					"status":      "running",
					"step":        3,
				}

				jsonBytes, err := json.Marshal(data)
				if err != nil {
					t.Fatalf("JSON marshal failed: %v", err)
				}

				err = env.RedisClient.Set(ctx, key, jsonBytes, 5*time.Minute).Err()
				if err != nil {
					t.Fatalf("SET JSON failed: %v", err)
				}

				result, err := env.RedisClient.Get(ctx, key).Bytes()
				if err != nil {
					t.Fatalf("GET JSON failed: %v", err)
				}

				var retrieved map[string]interface{}
				err = json.Unmarshal(result, &retrieved)
				if err != nil {
					t.Fatalf("JSON unmarshal failed: %v", err)
				}

				if retrieved["workflow_id"] != data["workflow_id"] {
					t.Errorf("Data mismatch: expected %v, got %v", data, retrieved)
				}
			},
		},
		{
			name: "Key expiration",
			operation: func(t *testing.T) {
				key := "test:expire:1"
				value := "expiring-value"

				err := env.RedisClient.Set(ctx, key, value, 2*time.Second).Err()
				if err != nil {
					t.Fatalf("SET with expiration failed: %v", err)
				}

				// Verify key exists
				result, err := env.RedisClient.Get(ctx, key).Result()
				if err != nil {
					t.Fatalf("GET before expiration failed: %v", err)
				}
				if result != value {
					t.Errorf("Value mismatch before expiration")
				}

				// Wait for expiration
				time.Sleep(3 * time.Second)

				// Verify key expired
				_, err = env.RedisClient.Get(ctx, key).Result()
				if err != redis.Nil {
					t.Errorf("Expected key to be expired, but got: %v", err)
				}
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.operation(t)
		})
	}
}
