# Scheduler Module

This module is responsible for **background daemon operations only**.

## Purpose

The scheduler directory contains:

- **daemon.py** - Background daemon that polls for due schedules and triggers workflow executions
- **service.py** - Internal service used by daemon for database operations

## What This Module Does NOT Do

- ❌ API endpoints for schedule management
- ❌ Schemas for schedule operations
- ❌ User-facing schedule CRUD operations

## Where Schedule Management Lives

All API operations for managing schedules are in:

- **`src/workflow/triggers/`** - Schedule trigger management
  - `schemas.py` - Request/response schemas
  - `schedule_service.py` - Schedule trigger CRUD service
  - Integrated into workflow router at `/workflows/{id}/schedule`

## Architecture

```
┌─────────────────────────────────────────────┐
│         Workflow APIs                        │
│  (src/workflow/router.py)                   │
│  - Create/update/delete workflows           │
│  - Automatically manage schedules            │
│  - Uses: ScheduleTriggerService              │
└──────────────────┬──────────────────────────┘
                   │
                   │ Writes schedule records
                   ▼
┌─────────────────────────────────────────────┐
│         Database                             │
│  - workflows table                           │
│  - scheduled_workflows table                 │
└──────────────────┬──────────────────────────┘
                   │
                   │ Polls for due schedules
                   ▼
┌─────────────────────────────────────────────┐
│    Scheduler Daemon                          │
│  (src/scheduler/daemon.py)                   │
│  - Polls database every 30s                  │
│  - Publishes workflow runs to RabbitMQ       │
│  - Uses: ScheduledWorkflowService            │
└─────────────────────────────────────────────┘
```

## Running the Daemon

```bash
python -m src.scheduler.daemon
```

## Key Difference

- **ScheduleTriggerService** (in workflow/triggers) - Used by APIs for schedule management
- **ScheduledWorkflowService** (in scheduler) - Used by daemon for polling and execution

Both services work with the same `ScheduledWorkflow` model but have different responsibilities.
