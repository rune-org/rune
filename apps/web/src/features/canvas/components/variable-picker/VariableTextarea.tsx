"use client";

import { VariableInput } from "./VariableInput";

type VariableTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  nodeId: string;
};

export function VariableTextarea(props: VariableTextareaProps) {
  return <VariableInput {...props} multiline />;
}
