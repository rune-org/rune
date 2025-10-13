//go:build integration

package integration

import (
	"testing"

	testutils "rune-worker/test_utils"
)

// Wrapper functions to maintain backward compatibility with existing tests
func setupIntegrationTest(t *testing.T) *testutils.TestEnv {
	return testutils.SetupTestEnv(t)
}

func getKeys(m map[string]interface{}) []string {
	return testutils.GetKeys(m)
}

const (
	testTimeout = testutils.TestTimeout
)
