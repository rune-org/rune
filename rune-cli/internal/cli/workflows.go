/*
Package cli - workflows.go provides workflow management commands.

All workflow commands require user authentication.

Commands:
  - workflows list: List all workflows
  - workflows get: Get workflow details
  - workflows run: Execute a workflow
  - workflows delete: Delete a workflow
  - workflows executions: List recent executions
*/
package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/helpers"
	"github.com/rune-org/rune-cli/internal/theme"
)

var workflowsCmd = &cobra.Command{
	Use:     "workflows",
	Aliases: []string{"wf", "workflow"},
	Short:   "Workflow management",
	Long: `Manage RUNE workflows.

Workflows are the core automation units in RUNE. Each workflow consists
of a series of nodes that process data and perform actions.

Examples:
  rune workflows list
  rune workflows get 123
  rune workflows run 123 -i '{"key": "value"}'`,
	PersistentPreRunE: requireAuth,
}

var workflowsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all workflows",
	Long:  `List all workflows with their status and details.`,
	RunE:  runWorkflowsList,
}

var workflowsGetCmd = &cobra.Command{
	Use:   "get [workflow-id]",
	Short: "Get workflow details",
	Long:  `Get detailed information about a specific workflow.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runWorkflowsGet,
}

var workflowsRunCmd = &cobra.Command{
	Use:   "run [workflow-id]",
	Short: "Execute a workflow",
	Long:  `Execute a workflow with optional input data.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runWorkflowsRun,
}

var workflowsDeleteCmd = &cobra.Command{
	Use:   "delete [workflow-id]",
	Short: "Delete a workflow",
	Long:  `Delete a workflow permanently. This action cannot be undone.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runWorkflowsDelete,
}

var executionsCmd = &cobra.Command{
	Use:   "executions",
	Short: "List recent executions",
	Long:  `List recent workflow executions.`,
	RunE:  runExecutionsList,
}

func init() {
	// NOTE: workflowsCmd is registered in root.go — do NOT add it again here
	workflowsCmd.AddCommand(workflowsListCmd)
	workflowsCmd.AddCommand(workflowsGetCmd)
	workflowsCmd.AddCommand(workflowsRunCmd)
	workflowsCmd.AddCommand(workflowsDeleteCmd)
	workflowsCmd.AddCommand(executionsCmd)

	// Run flags
	workflowsRunCmd.Flags().StringP("input", "i", "", "Input data as JSON string")
	workflowsRunCmd.Flags().StringP("file", "f", "", "Input data from JSON file")

	// Delete flags
	workflowsDeleteCmd.Flags().BoolP("force", "f", false, "Force delete without confirmation")
}

func runWorkflowsList(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	fmt.Println(theme.SectionHeader("Workflows"))

	// Show loading indicator
	spinnerStyle := lipgloss.NewStyle().Foreground(theme.PrimaryColor)
	fmt.Printf("%s Fetching workflows...\r", spinnerStyle.Render("◆"))

	workflows, err := client.ListWorkflows()
	if err != nil {
		fmt.Println() // Clear spinner line
		printError("Failed to list workflows: " + err.Error())
		return err
	}

	// Clear loading message
	fmt.Print("\033[K")

	if outputJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(workflows)
	}

	if len(workflows) == 0 {
		printInfo("No workflows found")
		fmt.Println()
		fmt.Println(theme.DimStyle.Render("  Create your first workflow in the web editor"))
		return nil
	}

	// Table output
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	fmt.Fprintf(w, "  %s\t%s\t%s\t%s\n",
		headerStyle.Render("ID"),
		headerStyle.Render("NAME"),
		headerStyle.Render("STATUS"),
		headerStyle.Render("UPDATED"),
	)
	fmt.Fprintf(w, "  %s\n", theme.Divider(60))

	for _, wf := range workflows {
		statusStyle := getPublishedStatusStyle(wf.IsPublished)
		status := "draft"
		if wf.IsPublished {
			status = "published"
		}

		updatedAt := helpers.FormatRelativeTime(wf.UpdatedAt)

		fmt.Fprintf(w, "  %d\t%s\t%s\t%s\n",
			wf.ID,
			helpers.TruncateString(wf.Name, 30),
			statusStyle.Render(status),
			theme.MutedStyle.Render(updatedAt),
		)
	}

	w.Flush()
	fmt.Println()
	fmt.Printf("  %s\n", theme.DimStyle.Render(fmt.Sprintf("Total: %d workflows", len(workflows))))

	return nil
}

func runWorkflowsGet(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workflowID, err := strconv.Atoi(args[0])
	if err != nil {
		printError("Invalid workflow ID: " + args[0])
		return err
	}

	workflow, err := client.GetWorkflow(workflowID)
	if err != nil {
		printError("Failed to get workflow: " + err.Error())
		return err
	}

	if outputJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(workflow)
	}

	fmt.Println(theme.SectionHeader("Workflow Details"))

	labelStyle := lipgloss.NewStyle().Foreground(theme.MutedColor).Width(14)
	valueStyle := lipgloss.NewStyle().Foreground(theme.TextColor)

	fmt.Printf("  %s %s\n", labelStyle.Render("ID:"), valueStyle.Render(fmt.Sprintf("%d", workflow.ID)))
	fmt.Printf("  %s %s\n", labelStyle.Render("Name:"), theme.Bold.Foreground(theme.PrimaryColor).Render(workflow.Name))

	if workflow.Description != "" {
		fmt.Printf("  %s %s\n", labelStyle.Render("Description:"), valueStyle.Render(workflow.Description))
	}

	statusStyle := getPublishedStatusStyle(workflow.IsPublished)
	status := "draft"
	if workflow.IsPublished {
		status = "published"
	}
	fmt.Printf("  %s %s\n", labelStyle.Render("Status:"), statusStyle.Render(status))

	fmt.Printf("  %s %d\n", labelStyle.Render("Owner ID:"), workflow.OwnerID)
	fmt.Printf("  %s %s\n", labelStyle.Render("Created:"), theme.MutedStyle.Render(workflow.CreatedAt.Format(time.RFC3339)))
	fmt.Printf("  %s %s\n", labelStyle.Render("Updated:"), theme.MutedStyle.Render(workflow.UpdatedAt.Format(time.RFC3339)))

	if workflow.LatestVersionID != nil {
		fmt.Printf("  %s %d\n", labelStyle.Render("Latest Ver:"), *workflow.LatestVersionID)
	}
	if workflow.PublishedVersionID != nil {
		fmt.Printf("  %s %d\n", labelStyle.Render("Published:"), *workflow.PublishedVersionID)
	}

	return nil
}

func runWorkflowsRun(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workflowID, err := strconv.Atoi(args[0])
	if err != nil {
		printError("Invalid workflow ID: " + args[0])
		return err
	}

	inputStr, _ := cmd.Flags().GetString("input")
	inputFile, _ := cmd.Flags().GetString("file")

	// Parse input data
	var inputData map[string]interface{}
	if inputFile != "" {
		data, err := os.ReadFile(inputFile)
		if err != nil {
			printError("Failed to read input file: " + err.Error())
			return err
		}
		if err := json.Unmarshal(data, &inputData); err != nil {
			printError("Failed to parse input file: " + err.Error())
			return err
		}
	} else if inputStr != "" {
		if err := json.Unmarshal([]byte(inputStr), &inputData); err != nil {
			printError("Failed to parse input data: " + err.Error())
			return err
		}
	}

	fmt.Println(theme.SectionHeader("Execute Workflow"))

	spinnerStyle := lipgloss.NewStyle().Foreground(theme.PrimaryColor)
	fmt.Printf("%s Running workflow...\r", spinnerStyle.Render("◆"))

	execution, err := client.TriggerWorkflow(workflowID, inputData)
	if err != nil {
		fmt.Println()
		printError("Failed to run workflow: " + err.Error())
		return err
	}

	fmt.Print("\033[K")

	if outputJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(execution)
	}

	printSuccess("Workflow triggered successfully!")
	fmt.Println()

	labelStyle := lipgloss.NewStyle().Foreground(theme.MutedColor).Width(14)
	fmt.Printf("  %s %s\n", labelStyle.Render("Execution ID:"), execution.ID)
	fmt.Printf("  %s %d\n", labelStyle.Render("Workflow ID:"), execution.WorkflowID)
	fmt.Printf("  %s %s\n", labelStyle.Render("Status:"), getExecutionStatusStyle(execution.Status).Render(execution.Status))
	fmt.Printf("  %s %s\n", labelStyle.Render("Started:"), theme.MutedStyle.Render(execution.StartedAt.Format(time.RFC3339)))

	return nil
}

func runWorkflowsDelete(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	workflowID, err := strconv.Atoi(args[0])
	if err != nil {
		printError("Invalid workflow ID: " + args[0])
		return err
	}

	force, _ := cmd.Flags().GetBool("force")

	if !force {
		fmt.Printf("%s Are you sure you want to delete workflow %d? [y/N] ",
			theme.WarningStyle.Render("!"),
			workflowID,
		)
		var response string
		fmt.Scanln(&response)
		if strings.ToLower(response) != "y" && strings.ToLower(response) != "yes" {
			fmt.Println(theme.DimStyle.Render("Cancelled"))
			return nil
		}
	}

	spinnerStyle := lipgloss.NewStyle().Foreground(theme.PrimaryColor)
	fmt.Printf("%s Deleting workflow...\r", spinnerStyle.Render("◆"))

	if err := client.DeleteWorkflow(workflowID); err != nil {
		fmt.Println()
		printError("Failed to delete workflow: " + err.Error())
		return err
	}

	fmt.Print("\033[K")
	printSuccess("Workflow deleted successfully")

	return nil
}

func runExecutionsList(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	fmt.Println(theme.SectionHeader("Recent Executions"))

	spinnerStyle := lipgloss.NewStyle().Foreground(theme.PrimaryColor)
	fmt.Printf("%s Fetching executions...\r", spinnerStyle.Render("◆"))

	executions, err := client.ListExecutions()
	if err != nil {
		fmt.Println()
		printError("Failed to list executions: " + err.Error())
		return err
	}

	fmt.Print("\033[K")

	if outputJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(executions)
	}

	if len(executions) == 0 {
		printInfo("No executions found")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	fmt.Fprintf(w, "  %s\t%s\t%s\t%s\t%s\n",
		headerStyle.Render("ID"),
		headerStyle.Render("WORKFLOW"),
		headerStyle.Render("STATUS"),
		headerStyle.Render("TRIGGER"),
		headerStyle.Render("STARTED"),
	)
	fmt.Fprintf(w, "  %s\n", theme.Divider(70))

	for _, ex := range executions {
		fmt.Fprintf(w, "  %s\t%d\t%s\t%s\t%s\n",
			helpers.TruncateString(ex.ID, 12),
			ex.WorkflowID,
			getExecutionStatusStyle(ex.Status).Render(ex.Status),
			ex.TriggerType,
			theme.MutedStyle.Render(helpers.FormatRelativeTime(ex.StartedAt)),
		)
	}

	w.Flush()
	fmt.Println()

	return nil
}

// Helper functions

func getPublishedStatusStyle(isPublished bool) lipgloss.Style {
	if isPublished {
		return lipgloss.NewStyle().Foreground(theme.SuccessColor)
	}
	return lipgloss.NewStyle().Foreground(theme.MutedColor)
}

func getExecutionStatusStyle(status string) lipgloss.Style {
	switch strings.ToLower(status) {
	case "completed", "success":
		return lipgloss.NewStyle().Foreground(theme.SuccessColor)
	case "running", "pending":
		return lipgloss.NewStyle().Foreground(theme.InfoColor)
	case "failed", "error":
		return lipgloss.NewStyle().Foreground(theme.ErrorColor)
	case "cancelled":
		return lipgloss.NewStyle().Foreground(theme.WarningColor)
	default:
		return lipgloss.NewStyle().Foreground(theme.MutedColor)
	}
}
