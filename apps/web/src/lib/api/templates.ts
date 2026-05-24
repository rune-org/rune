/* eslint-disable react-hooks/rules-of-hooks */
import {
  listTemplatesTemplatesGet,
  listCategoriesTemplatesCategoriesGet,
  getTemplateTemplatesTemplateIdGet,
  createTemplateTemplatesPost,
  deleteTemplateTemplatesTemplateIdDelete,
  useTemplateTemplatesTemplateIdUsePost,
} from "@/client";

import type {
  TemplateCreate,
  TemplateScope,
  TemplateSort,
} from "@/client/types.gen";

// Readable wrappers for template-related SDK functions
// Note: The generated SDK function names start with "use" but are not React Hooks

export type ListTemplatesFilters = {
  category?: string;
  scope?: TemplateScope;
  tags?: string[];
  search?: string;
  sort?: TemplateSort;
};

export const listTemplates = (filters: ListTemplatesFilters = {}) =>
  listTemplatesTemplatesGet({
    query: {
      category: filters.category,
      scope: filters.scope,
      tags: filters.tags,
      search: filters.search,
      sort: filters.sort,
    },
  });

export const listTemplateCategories = (scope?: TemplateScope) =>
  listCategoriesTemplatesCategoriesGet({
    query: scope ? { scope } : undefined,
  });

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
