#!/usr/bin/env python3
"""Terminal chat interface for testing the Smith agent.

Usage:
    python -m smith.cli
    python -m smith.cli --model groq/llama-3.1-70b-versatile
    python -m smith.cli --model ollama/llama3.1
    python -m smith.cli --debug

Supported LLM providers (via LiteLLM):
    FREE OPTIONS:
    - Ollama (local): ollama/llama3.1, ollama/mistral (no API key needed)
    - Groq (free tier): groq/llama-3.1-70b-versatile, groq/mixtral-8x7b-32768

    PAID OPTIONS:
    - OpenAI: openai/gpt-4o, openai/gpt-4o-mini
    - Anthropic: anthropic/claude-sonnet-4-20250514
    - Google: gemini/gemini-2.5-flash, gemini/gemini-2.5-pro
    - OpenRouter: openrouter/<provider>/<model>

Environment variables:
    GROQ_API_KEY: Groq API key
    OPENAI_API_KEY: OpenAI API key
    ANTHROPIC_API_KEY: Anthropic API key
    GEMINI_API_KEY: Google API key
    OPENROUTER_API_KEY: OpenRouter API key
"""

import argparse
import json
import os
import sys
from typing import Optional

# Enable readline for better input handling (backspace, arrows, history)
try:
    import readline  # noqa: F401 - imported for side effects
except ImportError:
    pass  # Windows doesn't have readline by default

# Import dspy BEFORE modifying sys.path to avoid shadowing stdlib modules
import dspy

# Add src directory to path for smith imports (append, don't prepend to avoid shadowing stdlib)
src_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if src_dir not in sys.path:
    sys.path.append(src_dir)

from smith.agent import SmithAgentWithMemory
from smith.prompts import SMITH_GREETING


def setup_llm(model: str, api_key: Optional[str] = None) -> dspy.LM:
    """Configure the language model.

    Args:
        model: Model identifier (e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", "gemini/gemini-2.5-flash")
        api_key: Optional API key (falls back to environment variables)

    Returns:
        Configured dspy.LM instance
    """
    # Determine API key based on provider
    if api_key:
        key = api_key
    elif model.startswith("ollama/"):
        key = "ollama"  # Ollama doesn't need a key
    elif model.startswith("groq/"):
        key = os.getenv("GROQ_API_KEY")
    elif model.startswith("openai/"):
        key = os.getenv("OPENAI_API_KEY")
    elif model.startswith("anthropic/"):
        key = os.getenv("ANTHROPIC_API_KEY")
    elif model.startswith("gemini/"):
        key = os.getenv("GEMINI_API_KEY")
    elif model.startswith("azure/"):
        key = os.getenv("AZURE_API_KEY")
    elif model.startswith("openrouter/"):
        key = os.getenv("OPENROUTER_API_KEY")
    else:
        # Try generic key or provider-specific
        provider = model.split("/")[0] if "/" in model else "llm"
        key = os.getenv(f"{provider.upper()}_API_KEY") or os.getenv("LLM_API_KEY")

    if not key:
        provider = model.split("/")[0] if "/" in model else "LLM"
        print(f"Error: No API key found for {provider}")
        print(f"Set {provider.upper()}_API_KEY environment variable or use --api-key")
        sys.exit(1)

    return dspy.LM(model, api_key=key)


def print_trace(n: int = 1):
    """Print the last n LLM call traces showing prompts and responses."""
    try:
        history = dspy.settings.lm.history
        if not history:
            print("No LLM history available yet.\n")
            return

        # Get last n entries
        entries = history[-n:] if len(history) >= n else history

        for i, entry in enumerate(entries):
            print(f"\n{'='*60}")
            print(f"LLM CALL {len(history) - len(entries) + i + 1}")
            print("=" * 60)

            # Print prompt/messages
            if "messages" in entry:
                print("\n--- PROMPT ---")
                for msg in entry["messages"]:
                    role = msg.get("role", "unknown").upper()
                    content = msg.get("content", "")
                    # Truncate very long content
                    if len(content) > 2000:
                        content = content[:2000] + "\n... [truncated]"
                    print(f"\n[{role}]:")
                    print(content)

            # Print response
            if "response" in entry:
                print("\n--- RESPONSE ---")
                response = entry["response"]
                if hasattr(response, "choices") and response.choices:
                    for choice in response.choices:
                        if hasattr(choice, "message"):
                            print(choice.message.content)
                        elif hasattr(choice, "text"):
                            print(choice.text)
                else:
                    print(str(response)[:2000])

            # Print token usage if available
            if "usage" in entry:
                usage = entry["usage"]
                print(f"\n--- TOKENS ---")
                print(f"Prompt: {usage.get('prompt_tokens', '?')}, Completion: {usage.get('completion_tokens', '?')}, Total: {usage.get('total_tokens', '?')}")

        print("\n" + "=" * 60 + "\n")

    except Exception as e:
        print(f"Error getting trace: {e}")
        # Fallback to dspy.inspect_history
        print("Falling back to dspy.inspect_history():\n")
        dspy.inspect_history(n=n)


def print_trajectory(result):
    """Print the ReAct agent's reasoning trajectory."""
    if not hasattr(result, "trajectory") or not result.trajectory:
        print("No trajectory available.\n")
        return

    traj = result.trajectory
    print("\n" + "=" * 60)
    print("AGENT TRAJECTORY (Reasoning + Actions)")
    print("=" * 60)

    step = 0
    while True:
        thought_key = f"thought_{step}"
        tool_key = f"tool_name_{step}"
        args_key = f"tool_args_{step}"
        obs_key = f"observation_{step}"

        if thought_key not in traj:
            break

        print(f"\n--- Step {step + 1} ---")

        # Thought
        if thought_key in traj:
            print(f"Thought: {traj[thought_key]}")

        # Action
        if tool_key in traj:
            tool_name = traj[tool_key]
            tool_args = traj.get(args_key, {})
            print(f"Action: {tool_name}({json.dumps(tool_args, indent=2) if tool_args else ''})")

        # Observation
        if obs_key in traj:
            obs = traj[obs_key]
            obs_str = str(obs)
            if len(obs_str) > 500:
                obs_str = obs_str[:500] + "... [truncated]"
            print(f"Observation: {obs_str}")

        step += 1

    print("\n" + "=" * 60 + "\n")


def print_workflow(workflow_json: str):
    """Pretty print the generated workflow (worker DSL format)."""
    try:
        workflow = json.loads(workflow_json)
        nodes = workflow.get("nodes", [])
        edges = workflow.get("edges", [])

        print("\n" + "=" * 60)
        print("GENERATED WORKFLOW")
        print("=" * 60)

        print(f"\nNodes ({len(nodes)}):")
        for node in nodes:
            node_type = node.get("type", "unknown")
            name = node.get("name", "Unnamed")
            node_id = node.get("id", "?")
            trigger = " [TRIGGER]" if node.get("trigger") else ""
            print(f"  - {name} ({node_type}){trigger}")
            print(f"    ID: {node_id}")
            params = node.get("parameters", {})
            if params:
                print(f"    Params: {json.dumps(params)}")

        print(f"\nEdges ({len(edges)}):")
        for edge in edges:
            src = edge.get("src", "?")
            dst = edge.get("dst", "?")
            label = f" [{edge['label']}]" if edge.get("label") else ""
            print(f"  - {src} -> {dst}{label}")

        print("\n" + "-" * 60)
        print("Copy this JSON to canvas:")
        print("-" * 60)
        print(json.dumps(workflow, indent=2))
        print("=" * 60 + "\n")

    except json.JSONDecodeError:
        print("\n[Raw workflow output]")
        print(workflow_json)
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Smith AI Agent - Terminal Chat Interface",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_smith.py --model groq/llama-3.1-70b-versatile  # Free (fast)
  python run_smith.py --model ollama/llama3.1               # Free (local)
  python run_smith.py --model openai/gpt-4o                 # Paid
  python run_smith.py --debug                               # Show reasoning

Commands during chat:
  /clear      - Clear conversation history
  /workflow   - Show last generated workflow
  /trace [n]  - Show last n LLM calls with full prompts/responses
  /trajectory - Show agent's reasoning steps (thoughts + tool calls)
  /debug      - Toggle debug mode (auto-show trajectory)
  /help       - Show help
  exit/quit   - Exit the program
        """,
    )
    parser.add_argument(
        "--model",
        default="openai/gpt-4o",
        help="LLM model to use (default: openai/gpt-4o)",
    )
    parser.add_argument(
        "--api-key",
        help="API key for the LLM provider",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Show agent reasoning and tool calls",
    )
    parser.add_argument(
        "--max-iters",
        type=int,
        default=10,
        help="Maximum ReAct iterations (default: 10)",
    )

    args = parser.parse_args()

    # Setup LLM
    print(f"Configuring LLM: {args.model}")
    try:
        lm = setup_llm(args.model, args.api_key)
        dspy.configure(lm=lm)
    except Exception as e:
        print(f"Error configuring LLM: {e}")
        sys.exit(1)

    # Create agent
    agent = SmithAgentWithMemory(max_iters=args.max_iters)
    debug_mode = args.debug

    # Print greeting
    print("\n" + "=" * 60)
    print(SMITH_GREETING)
    print("=" * 60)
    print("\nType 'exit' to quit, '/help' for commands\n")

    # Main chat loop
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        # Handle commands
        if user_input.lower() in ["exit", "quit", "/exit", "/quit"]:
            print("Goodbye!")
            break

        if user_input.lower() == "/clear":
            agent.clear()
            print("Conversation history cleared.\n")
            continue

        if user_input.lower() == "/workflow":
            if agent.last_workflow:
                print_workflow(agent.last_workflow)
            else:
                print("No workflow generated yet.\n")
            continue

        if user_input.lower() == "/debug":
            debug_mode = not debug_mode
            print(f"Debug mode: {'ON' if debug_mode else 'OFF'}\n")
            continue

        if user_input.lower() == "/help":
            print("""
Commands:
  /clear      - Clear conversation history
  /workflow   - Show last generated workflow
  /trace [n]  - Show last n LLM calls with prompts/responses (default: 1)
  /trajectory - Show agent's reasoning steps (thoughts + actions)
  /debug      - Toggle debug mode (auto-show trajectory after each response)
  /help       - Show this help
  exit/quit   - Exit the program
            """)
            continue

        if user_input.lower().startswith("/trace"):
            parts = user_input.split()
            n = int(parts[1]) if len(parts) > 1 else 1
            print_trace(n)
            continue

        if user_input.lower() == "/trajectory":
            if agent.last_result:
                print_trajectory(agent.last_result)
            else:
                print("No trajectory available yet. Send a message first.\n")
            continue

        # Process message
        print("\nSmith: ", end="", flush=True)

        try:
            result = agent.chat(user_input)

            # Print response
            print(result["response"])

            # Show workflow if generated
            if result.get("workflow"):
                print_workflow(result["workflow"])

            # Debug output - show trajectory when debug mode is on
            if debug_mode and agent.last_result:
                print_trajectory(agent.last_result)

            print()

        except Exception as e:
            print(f"\n[Error: {e}]")
            if debug_mode:
                import traceback

                traceback.print_exc()
            print()


if __name__ == "__main__":
    main()
