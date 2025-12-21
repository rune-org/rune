import { generateWorkflowFromPromptWorkflowsSmithGeneratePost } from "@/client";
import type {
  GenerateWorkflowFromPromptWorkflowsSmithGeneratePostResponse,
  GenerateWorkflowRequest,
} from "@/client/types.gen";

export type SmithGenerateRequest = GenerateWorkflowRequest & {
  include_trace?: boolean;
};
export type SmithGenerateApiResponse =
  GenerateWorkflowFromPromptWorkflowsSmithGeneratePostResponse;

// Wrapper around the generated SDK function for consistency with other API helpers
export const generateWorkflow = (payload: SmithGenerateRequest) =>
  generateWorkflowFromPromptWorkflowsSmithGeneratePost({ body: payload });
