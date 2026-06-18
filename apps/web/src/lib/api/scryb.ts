import { generateWorkflowDocsScrybWorkflowIdPost } from "@/client";

import type {
  GenerateWorkflowDocsRequest,
  GenerateWorkflowDocsScrybWorkflowIdPostResponse,
} from "@/client/types.gen";

export const generateWorkflowDocs = (
  workflow_id: number,
  target_audience: GenerateWorkflowDocsRequest["target_audience"] = "Technical Developer",
  custom_style?: string,
) =>
  generateWorkflowDocsScrybWorkflowIdPost({
    path: { workflow_id },
    body: { target_audience, custom_style: custom_style ?? null },
  });

export type GenerateWorkflowDocsResponse = GenerateWorkflowDocsScrybWorkflowIdPostResponse;
