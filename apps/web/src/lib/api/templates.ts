import {
    listTemplatesTemplatesGet,
    getTemplateTemplatesTemplateIdGet,
    createTemplateTemplatesPost,
    deleteTemplateTemplatesTemplateIdDelete,
    useTemplateTemplatesTemplateIdUsePost,
} from "@/client";

import type { TemplateCreate } from "@/client/types.gen";

// Readable wrappers for template-related SDK functions

export async function listTemplates() {
    return listTemplatesTemplatesGet();
}

export async function getTemplate(templateId: number) {
    return getTemplateTemplatesTemplateIdGet({ path: { template_id: templateId } });
}

export async function createTemplate(payload: TemplateCreate) {
    return createTemplateTemplatesPost({ body: payload });
}

export async function deleteTemplate(templateId: number) {
    return deleteTemplateTemplatesTemplateIdDelete({
        path: { template_id: templateId },
    });
}

export async function useTemplate(templateId: number) {
    return useTemplateTemplatesTemplateIdUsePost({
        path: { template_id: templateId },
    });
}
