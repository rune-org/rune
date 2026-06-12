import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { DocsCopyPage } from '@/components/layout/DocsCopyPage';

const docsComponents = getDocsMDXComponents();
const DocsWrapper = docsComponents.wrapper;

export function useMDXComponents(components = {}) {
  return {
    ...docsComponents,
    wrapper({ sourceCode, children, ...props }: React.ComponentProps<typeof DocsWrapper>) {
      return (
        <DocsWrapper {...props} sourceCode="">
          {sourceCode && <DocsCopyPage sourceCode={sourceCode} />}
          {children}
        </DocsWrapper>
      );
    },
    ...components,
  };
}
