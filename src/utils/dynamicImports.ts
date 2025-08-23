// Dynamic imports for ESM modules using eval to bypass TypeScript compilation
export async function importOpenAIAgents() {
  return await eval('import("@openai/agents-core")');
}

export async function importOpenAIAgentsPackage() {
  return await eval('import("@openai/agents")');
}