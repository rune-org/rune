# Workflow Regression Fixtures

This directory backs `TestWorkflowRegressionSuite` in `../workflow_regression_e2e_test.go`.

The suite loads UI-exported workflow JSON, converts it to the worker `core.Workflow`
shape, executes it through the in-process `WorkflowConsumer`, and compares a
normalized execution report against snapshots.

## Layout

- `workflows/manifest.json` lists every regression case.
- `workflows/*.json` contains UI canvas-shaped workflow fixtures.
- `expected/*.json` contains normalized snapshots for node statuses and workflow
  completion state.

## Prerequisites

RabbitMQ and Redis must be running with the same defaults used by the worker tests:

- RabbitMQ: `amqp://guest:guest@localhost:5672/`
- Redis: `localhost:6379`

You can override them with:

```powershell
$env:RABBITMQ_URL = "amqp://guest:guest@localhost:5672/"
$env:REDIS_ADDR = "localhost:6379"
```

## Run

From `services/rune-worker`:

```powershell
go test ./e2e -tags integration -run TestWorkflowRegressionSuite -count=1 -v
```

The suite uses one worker and one pair of status/completion consumers for the
whole run, then resets RabbitMQ queues and Redis state between cases.

## Update Snapshots

Only update snapshots after confirming the behavior change is intentional.

From `services/rune-worker`:

```powershell
$env:UPDATE_SNAPSHOTS = "true"
go test ./e2e -tags integration -run TestWorkflowRegressionSuite -count=1
Remove-Item Env:\UPDATE_SNAPSHOTS
```

Then run the suite again without `UPDATE_SNAPSHOTS` to verify the snapshots are
stable:

```powershell
go test ./e2e -tags integration -run TestWorkflowRegressionSuite -count=1
```

## Adding A Case

1. Add a UI canvas workflow JSON file under `workflows/`.
2. Add a manifest entry with:
   - `id`: stable snapshot name.
   - `workflow`: fixture filename.
   - `entry_node_id`: node where execution starts.
   - `expect_completion_status`: usually `completed` or `halted`.
3. Run with `UPDATE_SNAPSHOTS=true`.
4. Review the new snapshot under `expected/`.
5. Run again without update mode.

## Fixture Rules

The converter intentionally supports only the node types covered by these
regressions:

- `http`
- `if`
- `switch`
- `split`
- `aggregator`
- `merge`
- `filter`
- `sort`
- `limit`
- `edit`
- `log`
- `dateTimeNow`
- `dateTimeAdd`
- `dateTimeSubtract`
- `dateTimeFormat`
- `dateTimeParse`
- `trigger`

Unsupported or intentionally excluded node types should stay out of these
fixtures: `agent`, `webhookTrigger`, `scheduledTrigger`, integration nodes, and
`smtp`.

HTTP fixtures may use `https://httpbin.org/status/{code}`. During tests, the
harness rewrites those URLs to a local in-process test server, so the suite does
not depend on external network access.

Fixtures should reference real upstream node outputs, the same way the app's
variable picker does. Use paths such as `$FetchProducts.body.products`,
`$InStockOnly.$json`, `$item.sku`, or the current working `$json` inside edit
assignments. Do not add synthetic manifest-only globals such as `$risk_score` or
`$priority`.

## Snapshot Normalization

Snapshots omit or normalize unstable implementation details:

- running status messages are excluded;
- status messages are sorted by node id and split item index;
- dynamic date/time output is replaced with `<dynamic>`;
- HTTP output keeps status only;
- conditional and switch snapshots preserve authored expressions/rules;
- merge and aggregator outputs are reduced to behavior-relevant fields.
