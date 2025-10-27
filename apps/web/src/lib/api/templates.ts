/* eslint-disable react-hooks/rules-of-hooks */
import {
    listTemplatesTemplatesGet,
    getTemplateTemplatesTemplateIdGet,
    createTemplateTemplatesPost,
    deleteTemplateTemplatesTemplateIdDelete,
    useTemplateTemplatesTemplateIdUsePost,
} from "@/client";

import type { TemplateCreate } from "@/client/types.gen";

// Readable wrappers for template-related SDK functions
// Note: The generated SDK function names start with "use" but are not React Hooks

export const listTemplates = () => listTemplatesTemplatesGet();

export const getTemplate = (templateId: number) =>
    getTemplateTemplatesTemplateIdGet({ path: { template_id: templateId } });

export const createTemplate = (payload: TemplateCreate) =>
    createTemplateTemplatesPost({ body: payload });

export const deleteTemplate = (templateId: number) =>
    deleteTemplateTemplatesTemplateIdDelete({
        path: { template_id: templateId },
    });

export const applyTemplate = (templateId: number) =>
    useTemplateTemplatesTemplateIdUsePost({
        path: { template_id: templateId },
    });
